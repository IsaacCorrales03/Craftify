// server.js
const express = require('express');
const app = express();

const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

let server_current_status;
let started_console = false;
let sftpConnection;
let started_terminal = false;
let sshConnected = false;
// Configuración básica de Express
app.use(express.static('public'));
app.use(express.json());
app.use('/node_modules', express.static('node_modules'));
// Configuración SSH
const SSH_CONFIG = {
  host: '161.132.40.243',
  username: 'root',
  password: '8^1Rcl67d7_3Fn'
};

// Variables globales para el estado de la conexión


// Función para obtener la conexión SFTP con reintentos
async function getSFTPConnection(ssh, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!sftpConnection || sftpConnection.closed) {
        sftpConnection = await ssh.requestSFTP();
      }
      return sftpConnection;
    } catch (error) {
      console.log(`Intento ${attempt} de ${maxRetries} para obtener conexión SFTP falló:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Espera exponencial
    }
  }
}

// Función para verificar si la conexión SSH está activa
async function checkSSHConnection(ssh) {
  try {
    await ssh.execCommand('pwd');
    return true;
  } catch (error) {
    console.error('La conexión SSH no está activa:', error);
    return false;
  }
}



io.on('connection', (socket) => {
  console.log('Cliente conectado');

  // Maneja la conexión SSH
  socket.on('connect_ssh', async () => {
    try {
      if (!sshConnected) {
        await ssh.connect(SSH_CONFIG);
        sshConnected = true;
      }
    } catch (error) {
      console.error('SSH connection error:', error);
      socket.emit('terminal_output', `Error de conexión: ${error.message}\r\n`);
    }
  });
  socket.on('terminal', async () => {
    if (!started_terminal) {
      socket.emit('terminal_output', 'Conectando al servidor SSH\r\n');

      // Inicia el shell
      const shell = await ssh.requestShell();
      started_terminal = true
      shell.on('data', (data) => {
        socket.emit('terminal_output', data.toString());
      });

      // Maneja input del terminal
      socket.on('input', (data) => {
        shell.write(data);
      });
    }
  })
  socket.on('console', async () => {
    if (!started_console) {
      try {
        // Obtener el ID de la sesión de screen de Minecraft
        const result = await ssh.execCommand('screen -ls | grep minecraft | cut -d. -f1');
        const screenId = result.stdout.trim();

        if (!screenId) {
          socket.emit('console_output', 'No se encontró una sesión de Minecraft activa\r\n');
          return;
        }
        console.log("Prueba")
        socket.emit('console_output', `Conectando a la sesión de Minecraft (ID: ${screenId})\r\n`);

        // Crear una sesión shell y ejecutar el comando screen
        const shell = await ssh.requestShell();
        shell.write(`screen -x ${screenId}.minecraft\r`);
        started_console = true;
        // Manejar la salida de la consola
        shell.on('data', (data) => {
          socket.emit('console_output', data.toString());
        });

        // Manejar errores
        shell.stderr?.on('data', (data) => {
          socket.emit('console_output', `Error: ${data.toString()}\r\n`);
        });

        // Manejar el input del usuario
        socket.on('consoleInput', (data) => {
          shell.write(data);
        });

      }
      catch (error) {
        console.error('Error al conectar con la consola de Minecraft:', error);
        socket.emit('console_output', `Error de conexión: ${error.message}\r\n`);
      }
    }
  });
  socket.on('get_server_status', (callback) => {
    // Devolver directamente el estado actual del servidor usando el callback
    callback(server_current_status);
  });
  // Escuchar el evento fetch_files enviado desde el cliente
  // Maneja listado de archivos
  socket.on('get_stats', async () => {
    if (!sshConnected) {
      socket.emit('get_stats', { error: 'No hay conexión SSH' });
      return;
    }
    try {
      const { stdout, stderr } = await ssh.execCommand('cat /home/minecraft/plugins/CherryAPI/server_stats.json');
      const stats = JSON.parse(stdout);
      server_current_status = stats.status
      socket.emit('server_stats_response', { stats });
    } catch (error) {
      console.error('Error getting stats:', error);
    }
  });
  socket.on('get_uuids', async () => {
    if (!sshConnected) {
      socket.emit('get_stats', { error: 'No hay conexión SSH' });
      return;
    }
    try {
      const { stdout, stderr } = await ssh.execCommand('cat /home/minecraft/plugins/CherryAPI/players.json');
      const data = JSON.parse(stdout);
      // Emitimos directamente el objeto players
      socket.emit('uuids_response', data);  // Aquí el cambio
    } catch (error) {
      console.error('Error getting uuids:', error);
      socket.emit('uuids_response', { error: 'Error al obtener UUIDs' });
    }
});

  let sftpConnection = null;
  let isProcessingUpload = false;


  socket.on('upload_chunk', async (data) => {
    const { fileName, chunk, chunkIndex, totalChunks, path } = data;

    try {
      // Verificar que no haya otra subida en proceso
      if (isProcessingUpload) {
        throw new Error('Ya hay una subida en proceso. Por favor espera.');
      }
      isProcessingUpload = true;

      // Verificar conexión SSH
      if (!(await checkSSHConnection(ssh))) {
        throw new Error('La conexión SSH no está disponible');
      }

      // Crear directorio temporal si no existe
      await ssh.execCommand('mkdir -p /tmp/uploads');

      // Obtener conexión SFTP con reintentos
      const sftp = await getSFTPConnection(ssh);

      // Escribir chunk en archivo temporal
      const chunkPath = `/tmp/uploads/${fileName}.part${chunkIndex}`;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

      await new Promise((resolve, reject) => {
        const writeStream = sftp.createWriteStream(chunkPath);

        const timeout = setTimeout(() => {
          writeStream.destroy();
          reject(new Error('Timeout al escribir el chunk'));
        }, 30000); // 30 segundos de timeout

        writeStream.on('close', () => {
          clearTimeout(timeout);
          console.log(`Chunk ${chunkIndex} escrito exitosamente`);
          resolve();
        });

        writeStream.on('error', (error) => {
          clearTimeout(timeout);
          console.error('Error al escribir el archivo:', error);
          reject(error);
        });

        writeStream.write(buffer);
        writeStream.end();
      });

      console.log(`Chunk ${chunkIndex} subido correctamente`);

      socket.emit('chunk_uploaded', {
        fileName,
        chunkIndex,
        totalChunks
      });
    } catch (error) {
      console.error('Error uploading chunk:', error);
      socket.emit('upload_error', {
        fileName,
        error: error.message
      });
    } finally {
      isProcessingUpload = false;
    }
  });

  socket.on('upload_complete', async (data) => {
    const { fileName, path } = data;

    try {
      // Verificar conexión SSH
      if (!(await checkSSHConnection(ssh))) {
        throw new Error('La conexión SSH no está disponible');
      }

      // Concatenar todos los chunks usando una estrategia más robusta
      const targetPath = `${path}/${fileName}`;
      const commands = [
        // Verificar que todos los chunks existan
        `if [ ! "$(ls -1 /tmp/uploads/${fileName}.part* 2>/dev/null)" ]; then exit 1; fi`,
        // Concatenar los archivos
        `cat /tmp/uploads/${fileName}.part* > "${targetPath}"`,
        // Verificar que el archivo final existe
        `if [ ! -f "${targetPath}" ]; then exit 1; fi`,
        // Eliminar los chunks temporales
        `rm /tmp/uploads/${fileName}.part*`
      ];

      for (const command of commands) {
        const result = await ssh.execCommand(command);
        if (result.code !== 0) {
          throw new Error(`Error ejecutando comando: ${result.stderr}`);
        }
      }

      // Cerrar la conexión SFTP si existe
      if (sftpConnection) {
        sftpConnection.end();
        sftpConnection = null;
      }

      socket.emit('upload_success', { fileName });
    } catch (error) {
      console.error('Error completing upload:', error);
      socket.emit('upload_error', {
        fileName,
        error: error.message
      });
    }
  });
  socket.on('stop_server', async () => {
    try {
      // Obtén la sesión activa
      const SessionId = await getScreenSessionId();
      if (SessionId) {
        // Construir el comando para enviar 'stop' a la sesión activa
        const command = `screen -S ${SessionId}.minecraft -X stuff "stop\n"`;
        console.log('Ejecutando:', command);

        // Ejecutar el comando usando SSH
        const { stdout, stderr } = await ssh.execCommand(command);
        if (stderr) {
          console.error('Error al enviar el comando a la sesión de screen:', stderr);
        } else {
          console.log('Comando enviado exitosamente.');
        }
      } else {
        console.log('No se encontró ninguna sesión activa.');
      }
    } catch (err) {
      console.error('Error en el manejo de stop_server:', err);
    }
  });

  socket.on('start_server', async () => {
    console.log("servidor iniciando");
    try {
      // Solución 1: Encadenar los comandos en una sola línea
      const command = 'cd /home/minecraft && chmod +x start.sh && screen -d -m -S minecraft ./start.sh';

      console.log(`Ejecutando: ${command}`);
      const { stdout, stderr } = await ssh.execCommand(command);

      if (stderr) {
        console.error(`Error: ${stderr}`);
        throw new Error(`Falló el comando: ${command}`);
      }

      console.log(`Salida: ${stdout}`);
      console.log('Servidor iniciado exitosamente.');

    } catch (err) {
      console.error('Error al iniciar el servidor:', err);
      socket.emit('server_error', { error: err.message });
    }
  });

  socket.on('fetch_files', async (requestedPath) => {
    if (!sshConnected) {
      socket.emit('files_response', { error: 'No hay conexión SSH' });
      return;
    }

    try {
      // Usar ls -la para obtener información detallada
      const { stdout, stderr } = await ssh.execCommand(`ls -la "${requestedPath}"`);

      if (stderr) {
        throw new Error(stderr);
      }

      // Parsear la salida de ls
      const files = stdout
        .split('\n')
        .slice(1) // Saltar la línea del total
        .map(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 9) {
            return {
              type: parts[0].charAt(0), // El primer carácter indica el tipo
              permissions: parts[0],
              size: parts[4],
              modified: `${parts[5]} ${parts[6]} ${parts[7]}`,
              name: parts.slice(8).join(' ') // Manejar nombres con espacios
            };
          }
          return null;
        })
        .filter(file => file && file.name && file.name !== '.' && file.name !== '..');

      socket.emit('files_response', { files });
    } catch (error) {
      console.error('Error al listar archivos:', error);
      socket.emit('files_response', { error: error.message });
    }
  });

  socket.on('download_file', async (filePath, currentPath) => {
    if (!sshConnected) {
      socket.emit('error', 'No hay conexión SSH');
      return;
    }
    try {
      const sftp = await ssh.requestSFTP();
      const remotePath = `${currentPath}/${filePath}`;
      const fileName = filePath.split('/').pop();

      // Primero intentamos obtener los stats
      let fileSize = 0;
      try {
        // Intentar obtener stats usando promesas
        const stats = await new Promise((resolve, reject) => {
          sftp.stat(remotePath, (err, stats) => {
            if (err) reject(err);
            else resolve(stats);
          });
        });
        fileSize = stats ? stats.size : 0;
      } catch (statError) {
        console.warn('No se pudo obtener el tamaño del archivo:', statError);
        // Continuamos con la descarga aunque no tengamos el tamaño
      }

      // Notificar el inicio de la descarga
      socket.emit('start_download', {
        fileName,
        fileSize
      });

      // Crear un buffer para acumular los datos
      let buffer = Buffer.from([]);
      let totalBytes = 0;

      const stream = sftp.createReadStream(remotePath);

      stream.on('data', (chunk) => {
        // Acumular los chunks en el buffer
        buffer = Buffer.concat([buffer, chunk]);
        totalBytes += chunk.length;

        // Emitir progreso
        socket.emit('download_progress', {
          fileName,
          bytesTransferred: totalBytes
        });
      });
      stream.on('end', () => {
        if (buffer.length === 0) {
          socket.emit('downloadError', 'El archivo está vacío o no se pudo leer');
          return;
        }
        // Enviar el archivo completo como un buffer
        socket.emit('fileData', buffer);
        console.log(`Archivo enviado completamente. Tamaño: ${buffer.length} bytes`);
        socket.emit('downloadComplete', {
          fileName,
          finalSize: buffer.length
        });
      });

      stream.on('error', (err) => {
        console.error('Error al leer el archivo:', err);
        socket.emit('downloadError', `Error al leer el archivo: ${err.message}`);
      });

    } catch (error) {
      console.error('Error en la descarga:', error);
      socket.emit('error', `Error al descargar: ${error.message}`);
    }
  });

  socket.on('delete_file', async (filePath, route) => {
    if (!sshConnected) {
      socket.emit('error', 'No hay conexión SSH');
      return;
    }

    try {
      const fullPath = `${route}/${filePath}`;  // Construye la ruta completa del archivo

      // Verificar si la ruta existe
      const { stdout: pathCheck, stderr: pathError } = await ssh.execCommand(`test -e "${fullPath}" && echo "exists"`);
      if (pathError) {
        throw new Error(pathError);
      }
      if (!pathCheck.includes('exists')) {
        throw new Error('El archivo o directorio no existe');
      }

      // Verificar si es un directorio
      const { stdout: dirCheck, stderr: dirError } = await ssh.execCommand(`test -d "${fullPath}" && echo "directory"`);
      if (dirError) {
        throw new Error(dirError);
      }

      // Eliminar según corresponda
      if (dirCheck.includes('directory')) {
        // Eliminar directorio de forma recursiva
        await ssh.execCommand(`rm -rf "${fullPath}"`);
      } else {
        // Eliminar archivo
        await ssh.execCommand(`rm "${fullPath}"`);
      }
      console.log("archivo eliminado: ", filePath)
      socket.emit('file_deleted', { success: true });
    } catch (error) {
      console.error('Error al eliminar:', error);
      socket.emit('file_deleted', { success: false, error: error.message });
    }
  });
  socket.on("save_file", async ({ filePath, content }) => {
    console.log("Solicitud para guardar archivo:", filePath);
  
    let sftp = null;
    try {
      sftp = await ssh.requestSFTP();
      
      // Convertir el contenido a Buffer si es necesario
      const fileBuffer = Buffer.from(content);
      
      // Usar writeFile con una Promise para manejar la escritura asíncrona
      await new Promise((resolve, reject) => {
        sftp.writeFile(filePath, fileBuffer, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
  
      // Emitir confirmación de éxito
      socket.emit("file_saved", {
        success: true,
        message: "Archivo guardado correctamente"
      });
  
    } catch (err) {
      console.error("Error al guardar el archivo:", err.message);
      socket.emit("error", { 
        message: "No se pudo guardar el archivo",
        error: err.message 
      });
    } finally {
      if (sftp) {
        sftp.end();
      }
    }
  });
  socket.on("edit_file", async (filePath) => {
    console.log("Solicitud para editar archivo:", filePath);
  
    let sftp = null;
    try {
      sftp = await ssh.requestSFTP();
      
      // Usamos readFile en lugar de get
      const fileContent = await new Promise((resolve, reject) => {
        sftp.readFile(filePath, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
  
      socket.emit("file_content", {
        filePath,
        content: fileContent.toString(), // Convertimos el buffer a string
      });
    } catch (err) {
      console.error("Error al leer el archivo:", err.message);
      socket.emit("error", { message: "No se pudo leer el archivo." });
    } finally {
      if (sftp) {
        sftp.end();
      }
    }
  });

  // Maneja la desconexión
  socket.on('disconnect', async () => {
    console.log('Cliente desconectado');
    if (sshConnected) {
      await ssh.dispose();
      sshConnected = false;
    }
  });
  socket.on('log', async () => {
    const log = await ssh.execCommand('cat /home/minecraft/logs/latest.log')
    socket.emit('log_response', log)
  })
  socket.on('fetch_players', async () => {
    fetTablePlayers()
  })
  function fetTablePlayers() {
    const db = new sqlite3.Database(dbPath);
    const query = 'SELECT * FROM Players';
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error al ejecutar la consulta:', err.message);
        socket.emit('player_data_response', {err, rows })
      }
      else {
        socket.emit('player_data_response', { err, rows })
      }
    })

  }
});

async function getScreenSessionId() {
  const { stdout, stderr } = await ssh.execCommand(`screen -ls`);
  const match = stdout.match(/(\d+)\.\w+/);
  if (match) {
    return match[1]
  } else {
    console.log('No hay sesiones activas.');
    return null
  }
}

// Inicia el servidor
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});