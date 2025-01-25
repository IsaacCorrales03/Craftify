// Iniciar el servidor
const socket = io('http://https://craftify-7gl5.onrender.com/');
//const socket = io('http://localhost:3000');
socket.emit('connect_ssh');

// Ruta base para los archivos
let route = '/home/minecraft'

// configuración de tailwind
tailwind.config = {
  theme: {
    extend: {
      colors: {
        'custom-purple': '#8B5CF6',
        'custom-blue': '#60A5FA',
        'custom-pink': '#F472B6',
        'custom-dark': '#1E1B4B'
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out'
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      }
    }
  }
}

// Server stats //

// obtener
function fetchStats() {
  socket.emit('get_stats')
}

setInterval(() => { fetchStats() }, 1000);

socket.on('server_stats_response', (response) => {
  if (response.error) {
    console.error('Error al obtener estadísticas:', response.error);
    alert(`Error: ${response.error}`);
  } else {

    updateServerStats(response.stats)
  }
});


//editar
function updateServerStats(stats) {
  // Update RAM usage
  const ramBar = document.getElementById('ram-bar');
  const ramUsed = document.getElementById('ram-used');
  const ramValue = parseInt(stats.ram_used);
  const totalRam = 5120; // Assuming 6GB total RAM
  const ramPercentage = (ramValue / totalRam) * 100;

  ramBar.style.width = `${ramPercentage}%`;
  ramUsed.textContent = stats.ram_used;

  // Update TPS visualization
  const tpsValue = parseFloat(stats.tps) * 9;
  const tpsBars = document.querySelectorAll('.tps-bar');
  const maxHeight = 64; // Maximum height in pixels

  tpsBars.forEach((bar) => {
    const height = (tpsValue / 200) * maxHeight; // 20 is max TPS
    bar.style.height = `${height}px`;

    // Change color based on TPS value
    if (tpsValue >= 15) {
      bar.classList.add('bg-green-500');
      bar.classList.remove('bg-yellow-500', 'bg-red-500');
    } else if (tpsValue >= 10) {
      bar.classList.add('bg-yellow-500');
      bar.classList.remove('bg-green-500', 'bg-red-500');
    } else {
      bar.classList.add('bg-red-500');
      bar.classList.remove('bg-green-500', 'bg-yellow-500');
    }
  });

  // Update other stats
  document.getElementById('server-tps').textContent = stats.tps;
  document.getElementById('players-online').textContent = stats.players_online;
  document.getElementById('server-version').textContent = stats.version.slice(0, 6);
  document.getElementById('server-software').textContent = stats.software;
  const rawUptime = stats.uptime;

  // Divide el valor por los dos puntos
  const [days, hours, minutes] = rawUptime.split(':').map(Number);
  // Asegura que siempre tengan dos dígitos
  const formattedDays = String(days).padStart(2, '0');
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');

  // Junta el formato como dd:hh:mm
  const formattedUptime = `${formattedDays} Days / ${formattedHours} hours / ${formattedMinutes} minutes`;

  // Actualiza el DOM
  document.getElementById('server-uptime').textContent = formattedUptime;

  document.getElementById('status').textContent = stats.status;
  document.getElementById('ram-total').textContent = totalRam + "MB";
  document.getElementById("server-port").textContent = stats.port;
  document.getElementById('server-ip').textContent = stats.ip
  // Update status indicator
  const statusIndicator = document.getElementById('status-indicator');
  const button = document.getElementById('server_status');

  if (stats.status === 'Online') {
    button.textContent = 'Detener';
    button.className = 'px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-300';
    button.onclick = () => handleStopServer();
  } else {
    button.textContent = 'Iniciar';
    button.className = 'px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors duration-300';
    button.onclick = () => handleStartServer(); // Cambia el evento de clic
  }

  const tps = parseFloat(stats.tps);
  if (tps >= 15) {
    statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500 animate-pulse';
  } else if (tps >= 10) {
    statusIndicator.className = 'w-3 h-3 rounded-full bg-yellow-500 animate-pulse';
  } else {
    statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500 animate-pulse';
  }
}

function handleStopServer() {
  socket.emit('stop_server')
}

function handleStartServer() {
  // Elementos que mostrarán carga
  const loadingElements = {
    'ram-container': ['ram-used', 'ram-total'],
    'tps-container': ['server-tps'],
    // Agregar más elementos según necesidad
  };

  // Función para mostrar estado de carga
  function setLoadingState(isLoading) {
    const mainStatus = document.getElementById('main-status');
    if (!mainStatus) return;

    const statusText = mainStatus.querySelector('span');
    if (statusText) {
      statusText.textContent = isLoading ? 'Iniciando servidor' : 'Servidor en línea';
      statusText.className = isLoading ? 'loading-dots' : '';
    }

    // Aplicar estados de carga a los contenedores
    Object.keys(loadingElements).forEach(containerId => {
      const container = document.getElementById(containerId);
      if (container) {
        if (isLoading) {
          container.classList.add('loading');
        } else {
          container.classList.remove('loading');
        }
      }
    });
  }

  // Mostrar toast de inicio
  function showToast(type, message) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    if (type !== 'starting') {
      setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    return toast;
  }

  // Iniciar secuencia de carga
  setLoadingState(true);
  const startingToast = showToast('starting', 'Iniciando servidor...');

  // Emitir evento de inicio
  socket.emit('start_server');

  // Esperar respuesta del servidor
  waitForServerOnline()
    .then(() => {
      setLoadingState(false);
      startingToast.remove();
      showToast('success', '¡Servidor iniciado exitosamente!');

      // Actualizar estado visual
      const statusDot = document.querySelector('.status-dot');
      if (statusDot) {
        statusDot.style.background = '#22c55e';
      }
    })
    .catch((error) => {
      console.error("Error al iniciar el servidor:", error);
      setLoadingState(false);
      startingToast.remove();
      showToast('error', 'Error al iniciar el servidor');

      if (startButton) {
        startButton.disabled = false;
        startButton.classList.remove('opacity-50');
      }
    });
}

function waitForServerOnline() {
  return new Promise((resolve, reject) => {
    const maxRetries = 120; // Tiempo máximo de espera: 60 segundos
    let attempts = 0;

    const checkStatus = () => {
      socket.emit('get_server_status', (status) => {
        console.log(status)
        if (status === 'Online') {
          resolve(); // Resolver la promesa cuando el estado sea 'online'
        } else if (attempts >= maxRetries) {
          reject(new Error("Tiempo de espera excedido para que el servidor esté online."));
        } else {
          attempts++;
          setTimeout(checkStatus, 2000); // Reintentar después de 2 segundos
        }
      });
    };
    checkStatus();
  });
}
//consola

// Configuración inicial
const rows = 25; // Número fijo de filas
const rowHeightPercentage = 4; // Cada fila ocupa el 4% del alto del contenedor padre

// Obtener el contenedor padre y el terminal
const parentContainer = document.getElementById('linuxContent'); // Asegúrate de que tenga un ID válido
const container = document.getElementById('terminal');

// Inicializar el terminal con tema personalizado
const terminal = new Terminal({
  theme: {
    background: '#1E1B4B',
    foreground: '#E0E7FF',
    cursor: '#8B5CF6',
    selection: '#60A5FA',
    black: '#1E1B4B',
    blue: '#60A5FA',
    cyan: '#67E8F9',
    green: '#34D399',
    magenta: '#F472B6',
    red: '#EF4444',
    white: '#E0E7FF',
    yellow: '#FBBF24',
  },
});

// Función para ajustar dinámicamente el terminal
const fitTerminalToParent = () => {
  try {
    // Calcular el alto del contenedor padre
    const viewportHeight = window.innerHeight;
    const parentHeight = viewportHeight * 0.90; // 90vh

    // Calcular el alto de cada fila (4% del contenedor padre)
    const rowHeight = (parentHeight * rowHeightPercentage) / 100;

    // Ajustar el alto del terminal (25 filas)
    const terminalHeight = rows * rowHeight;
    container.style.height = `${terminalHeight}px`;
    const xtermScreen = document.querySelector('#terminal > div > div.xterm-screen');
    xtermScreen.style.height = `1222px`
    // Configurar el tamaño de las filas y columnas
    const cols = Math.floor(container.clientWidth / 9);
    terminal.resize(cols, rows);

    // Ajustar el tamaño de fuente proporcionalmente
    const fontSize = Math.max(Math.min(rowHeight * 0.6, 18), 12);
    terminal.options.fontSize = fontSize;

    terminal.refresh(0, terminal.rows - 1);
  } catch (error) {
    console.error('Error al ajustar el terminal:', error);
  }
};

// Observar cambios en el tamaño del contenedor padre
const resizeObserver = new ResizeObserver(fitTerminalToParent);
resizeObserver.observe(parentContainer);

// Inicializar el terminal
terminal.open(container);

// Manejo de salida del terminal
const processOutput = (data) => {
  terminal.write(data);
};

// Escuchar eventos de salida del socket
socket.on('terminal_output', processOutput);

// Manejo de entrada de usuario
terminal.onData(data => {
  socket.emit('input', data);
});

socket.on('uuids_response', (data) => {
  if (data.players) {
    renderPlayerCards(data.players);
  } else {
    console.error('No se recibieron datos de jugadores:', data);
    document.getElementById('uuidContent').innerHTML = '<p>No hay datos de jugadores disponibles</p>';
  }
});
function renderPlayerCards(players) {
  console.log('Rendering player cards, total players:', Object.keys(players).length);

  const container = document.getElementById('uuidContent');
  if (!container) {
    console.error('Container element not found');
    return;
  }
  container.innerHTML = '';

  // Ensure modal exists
  let modalContainer = document.getElementById('duplicateNametageModal');
  if (!modalContainer) {
    console.log('Creating modal container');
    modalContainer = document.createElement('div');
    modalContainer.id = 'duplicateNametageModal';
    modalContainer.className = 'fixed inset-0 z-50 hidden items-center justify-center p-4 bg-black bg-opacity-50';
    modalContainer.innerHTML = `
      <div class="bg-custom-dark rounded-xl max-w-md w-full p-8 relative border border-purple-800/20 shadow-lg">
        <button id="closeModalBtn" class="absolute top-4 right-4 text-custom-purple hover:text-custom-blue transition-colors duration-300">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div id="duplicateNametageContent" class="text-white"></div>
      </div>
    `;
    document.body.appendChild(modalContainer);
    console.log('Modal added to body');

    // Close modal logic
    modalContainer.addEventListener('click', (e) => {
      console.log('Modal click event', e.target);
      if (e.target.id === 'duplicateNametageModal' || e.target.closest('#closeModalBtn')) {
        modalContainer.classList.remove('flex');
        modalContainer.classList.add('hidden');
      }
    });
  }


  Object.entries(players).forEach(([uuid, player], index) => {
    const isPremium = player.premium;
    const statusColor = isPremium ? 'text-green-400' : 'text-red-400';
    const statusText = isPremium ? 'Premium' : 'No Premium';

    // Check for duplicate nametags
    const duplicateNametags = Object.values(players)
      .filter(p => p.nametag === player.nametag && p.uuid !== uuid);
    const hasDuplicateNametag = duplicateNametags.length > 0;

    // Parse and format registration time
    let formattedRegisterTime = 'N/A';
    try {
      const timeParts = player.register_in.replace('pm', '').split(/[\/\-:]/);
      const [registerMonth, registerDay, registerHour, registerMinute] = timeParts;
      formattedRegisterTime = `${registerMonth}/${registerDay} ${registerHour}:${registerMinute}`;
    } catch (timeParseError) {
      console.warn(`Could not parse registration time for player ${player.nametag}:`, timeParseError);
    }

    const card = document.createElement('div');
    card.className = `animate-cards bg-purple-800/10 rounded-xl border border-purple-800/20 p-6 backdrop-blur-sm transition-all duration-300 hover:bg-purple-800/20 hover:shadow-lg hover:shadow-purple-500/20 group relative mb-6 ${hasDuplicateNametag ? 'border-red-500 cursor-pointer' : ''}`;
    card.style.animationDelay = `${index * 100}ms`;

    card.innerHTML = `
      <div class="flex items-center gap-4 mg">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-custom-purple to-custom-blue p-0.5">
          <div class="w-full h-full rounded-xl bg-gray-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <svg class="w-6 h-6 text-custom-purple group-hover:text-custom-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
        <div>
          <h3 class="text-lg font-medium text-white group-hover:text-custom-blue transition-colors">${player.nametag}</h3>
          <p class="text-sm ${statusColor} flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${isPremium ? 'bg-green-400' : 'bg-red-400'} animate-pulse"></span>
            ${statusText}
          </p>
        </div>
      </div>
      <div class="space-y-3 pl-16">
        <div class="text-sm text-white/70">
          <span class="text-custom-purple">UUID:</span>
          <span class="font-mono text-xs ml-2 break-all group-hover:text-custom-blue transition-colors">${player.uuid}</span>
        </div>
        <div class="text-sm text-white/70">
          <span class="text-custom-purple">Registered:</span>
          <span class="ml-2">${formattedRegisterTime}</span>
        </div>
      </div>
      
      ${hasDuplicateNametag ? `
        <div class="absolute top-4 right-4">
          <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-lienjoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
        </div>
      ` : ''}
    `;

    // Add click event for duplicate nametag warning
    if (hasDuplicateNametag) {
      card.addEventListener('click', () => {
        const modalContent = document.getElementById('duplicateNametageContent');
        modalContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-4 text-custom-purple">Duplicate Nametag Alert</h2>
        <p class="mb-4 text-white/80">The nametag "${player.nametag}" is used by multiple players:</p>
        <div class="space-y-3">
          ${[player, ...duplicateNametags].map(p => `
            <div class="bg-purple-800/10 rounded-lg p-4 border border-purple-800/20">
              <div class="flex justify-between mb-2">
                <span class="text-custom-purple font-semibold">Nametag:</span>
                <span class="text-white">${p.nametag}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-custom-purple font-semibold">UUID:</span>
                <span class="font-mono text-sm text-white break-all">${p.uuid}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

        const modalContainer = document.getElementById('duplicateNametageModal');
        modalContainer.classList.remove('hidden');
        modalContainer.classList.add('flex');
      });
    }


    container.appendChild(card);
  });
}



const consoleContainer = document.getElementById('console');

// Configuración inicial de la terminal
const consola = new Terminal({
  theme: {
    background: '#1E1B4B',
    foreground: '#E0E7FF',
    cursor: '#8B5CF6',
    selection: '#60A5FA',
    black: '#1E1B4B',
    blue: '#60A5FA',
    cyan: '#67E8F9',
    green: '#34D399',
    magenta: '#F472B6',
    red: '#EF4444',
    white: '#E0E7FF',
    yellow: '#FBBF24'
  },
  fontSize: 18,

});
const fitAddon = new FitAddon.FitAddon();
consola.loadAddon(fitAddon);

// Abrir la terminal en el wrapper
consola.open(consoleContainer);

window.addEventListener('resize', () => {
  fitAddon.fit();
});

// Input/Output handlers
consola.onData(data => {
  socket.emit('consoleInput', data);
});

const processOutputConsole = (data) => {
  consola.write(data);
};

socket.on('console_output', processOutputConsole);


// obtener
function fetchFiles() {
  const currentPath = route;
  const currentPathSpan = document.getElementById("currentPath")
  currentPathSpan.textContent = currentPath
  socket.emit('fetch_files', currentPath);

  socket.on('files_response', (data) => {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    if (data && data.files) {
      data.files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.classList.add(
          'file-item',
          'p-4',
          'bg-custom-dark',
          'border',
          'border-purple-800/20',
          'rounded-lg',
          'flex',
          'items-center',
          'justify-between',
          'group',
          'hover:bg-purple-800/10',
          'transition-all',
          'duration-300'
        );

        // Left side with icon and name
        const leftSide = document.createElement('div');
        leftSide.classList.add('flex', 'items-center', 'space-x-4', 'flex-1');

        // Enhanced Icon Container
        const iconContainer = document.createElement('div');
        iconContainer.classList.add(
          'flex',
          'items-center',
          'justify-center',
          'w-10',
          'h-10',
          'rounded-lg',
          'bg-purple-800/20',
          'group-hover:bg-purple-800/30',
          'transition-colors',
          'duration-300'
        );

        // Icon - Probamos con un enfoque diferente para el icono de directorio
        const icon = document.createElement('i');
        if (file.type == "d") {

          // Intentamos con un enfoque diferente para el icono de directorio
          icon.innerHTML = '<i class="fa-regular fa-folder text-2xl text-custom-purple"></i>';
          fileElement.addEventListener('click', (e) => {
            // Verificar si el click no vino de un botón de acción
            if (!e.target.closest('button')) {
              handleChange(file.name);
            }
          });
        } else {
          fileElement.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
              handleEditFile(file.name)
            }
          })
          const extension = file.name.split('.').pop()?.toLowerCase();
          let iconClass = 'file'; // icono por defecto

          const iconMap = {
            // Archivos de documento
            pdf: 'file-pdf',
            doc: 'file-word',
            docx: 'file-word',
            xls: 'file-excel',
            xlsx: 'file-excel',
            ppt: 'file-powerpoint',
            pptx: 'file-powerpoint',
            txt: 'file-alt',

            // Imágenes
            jpg: 'file-image',
            jpeg: 'file-image',
            png: 'file-image',
            gif: 'file-image',

            // Archivos comprimidos
            zip: 'file-archive',
            rar: 'file-archive',

            // Código y configuración
            js: 'file-code',
            py: 'file-code',
            html: 'file-code',
            css: 'file-code',
            json: 'file-code',
            yml: 'file-code',
            yaml: 'file-code',
            jar: 'file-archive',
            sh: 'file-code',
            properties: 'file-code'
          };

          iconClass = iconMap[extension] || 'file';
          icon.innerHTML = `<i class="fa-regular fa-${iconClass} text-2xl text-custom-purple"></i>`;
        }

        iconContainer.appendChild(icon);

        // Filename
        const fileName = document.createElement('span');
        fileName.classList.add('text-white', 'font-medium', 'text-lg');
        fileName.textContent = file.name;

        leftSide.appendChild(iconContainer);
        leftSide.appendChild(fileName);

        // El resto del código permanece igual...
        const rightSide = document.createElement('div');
        rightSide.classList.add('flex', 'items-center', 'space-x-6');

        const fileSize = document.createElement('span');
        fileSize.classList.add(
          'text-sm',
          'font-medium',
          'text-custom-purple',
          'min-w-[80px]',
          'text-right'
        );
        fileSize.textContent = formatFileSize(file.size);

        const actions = document.createElement('div');
        actions.classList.add(
          'flex',
          'items-center',
          'space-x-3'
        );

        const downloadBtn = document.createElement('button');
        downloadBtn.classList.add(
          'p-2',
          'rounded-lg',
          'text-emerald-400',
          'hover:bg-emerald-500/20',
          'transition-all',
          'duration-300',
          'transform',
          'hover:scale-110',
          'group/download'
        );
        file.downloadButton = downloadBtn;
        downloadBtn.onclick = () => handleDownload(file);
        downloadBtn.innerHTML = `
          <svg class="w-5 h-5 transition-transform duration-300 group-hover/download:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        `;

        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add(
          'p-2',
          'rounded-lg',
          'text-rose-400',
          'hover:bg-rose-500/20',
          'transition-all',
          'duration-300',
          'transform',
          'hover:scale-110',
          'group/delete'
        );
        deleteBtn.onclick = () => handleDelete(file);
        deleteBtn.innerHTML = `
          <svg class="w-5 h-5 transition-transform duration-300 group-hover/delete:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        `;

        actions.appendChild(downloadBtn);
        actions.appendChild(deleteBtn);

        rightSide.appendChild(fileSize);
        rightSide.appendChild(actions);

        fileElement.appendChild(leftSide);
        fileElement.appendChild(rightSide);
        fileList.appendChild(fileElement);
      });
    } else {
      const noFilesMessage = document.createElement('div');
      noFilesMessage.classList.add(
        'p-8',
        'text-center',
        'text-custom-purple',
        'font-medium',
        'text-lg'
      );
      noFilesMessage.textContent = 'No hay archivos en esta ruta';
      fileList.appendChild(noFilesMessage);
    }
  });
}

// Carga de archivos
// Abre el cuadro de selección de archivos
// Constantes y estado global
const CHUNK_SIZE = 512 * 1024; // 512KB por chunk
let uploadState = {};

// Event Listeners principales
document.addEventListener('DOMContentLoaded', () => {
  const uploadButton = document.getElementById('uploadButton');
  const fileInput = document.getElementById('fileInput');

  if (uploadButton && fileInput) {
    uploadButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
      console.log(event.target.files)
      const file = event.target.files[0];
      if (file) {
        console.log(`Archivo seleccionado: ${file.name}`);
        initializeUpload(file);

      }
    });
  }
});

// Función principal de inicialización de upload
async function initializeUpload(file) {
  if (!file) return;

  const fileName = file.name;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  console.log(`Iniciando upload de ${fileName} (${formatFileSize(file.size)})`);
  console.log(`Número total de chunks: ${totalChunks}`);

  const progressContainer = document.getElementById('uploadProgressContainer');
  if (!progressContainer) return;

  createProgressElement(fileName);

  uploadState[fileName] = {
    file,
    currentChunk: 0,
    totalChunks,
    aborted: false,
    startTime: Date.now(),
    lastUpdate: Date.now(),
    bytesUploaded: 0,
    retryCount: 0
  };

  try {
    await uploadNextChunk(fileName);
  } catch (error) {
    console.error(`Error inicial en upload de ${fileName}:`, error);
    handleUploadError(fileName, error);
  }
}

// Función principal de subida de chunks
async function uploadNextChunk(fileName) {
  const state = uploadState[fileName];
  if (!state || state.aborted) return;

  const { file, currentChunk, totalChunks } = state;
  const start = currentChunk * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const chunk = file.slice(start, end);

  try {
    console.log(`Preparando chunk ${currentChunk + 1}/${totalChunks} para ${fileName}`);
    const buffer = await chunk.arrayBuffer();
    const chunkSize = end - start;

    return new Promise((resolve, reject) => {
      socket.emit('upload_chunk', {
        fileName,
        chunk: new Uint8Array(buffer),
        chunkIndex: currentChunk,
        totalChunks,
        chunkSize,
        totalSize: file.size,
        path: route
      });

      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout en la subida del chunk'));
      }, 30000);

      const handleResponse = (response) => {
        clearTimeout(timeoutId);

        if (response.fileName === fileName && response.chunkIndex === currentChunk) {
          socket.off('chunk_uploaded', handleResponse);
          socket.off('upload_error', handleError);

          state.bytesUploaded += chunkSize;
          updateUploadStats(fileName);
          state.currentChunk++;

          console.log(`Chunk ${currentChunk + 1}/${totalChunks} subido para ${fileName}`);

          if (state.currentChunk < totalChunks) {
            uploadNextChunk(fileName).then(resolve).catch(reject);
          } else {
            console.log(`Todos los chunks subidos para ${fileName}, iniciando finalización`);
            socket.emit('upload_complete', {
              fileName: fileName,
              path: route
            });
            resolve();
          }
        }
      };

      const handleError = (error) => {
        clearTimeout(timeoutId);
        socket.off('chunk_uploaded', handleResponse);
        socket.off('upload_error', handleError);

        if (state.retryCount < 3) {
          console.log(`Reintentando chunk ${currentChunk + 1} para ${fileName}`);
          state.retryCount++;
          setTimeout(() => {
            uploadNextChunk(fileName).then(resolve).catch(reject);
          }, 1000);
        } else {
          reject(new Error(`Error después de 3 intentos: ${error.message}`));
        }
      };

      socket.on('chunk_uploaded', handleResponse);
      socket.on('upload_error', handleError);
    });

  } catch (error) {
    console.error(`Error en chunk ${currentChunk + 1}/${totalChunks} de ${fileName}:`, error);
    throw error;
  }
}
let editor = null;
let monacoLoading = false;
let pendingContent = null;

// Función para cargar Monaco
function loadMonaco() {
  return new Promise((resolve, reject) => {
    if (window.monaco) {
      resolve(window.monaco);
      return;
    }

    monacoLoading = true;
    require(['vs/editor/editor.main'], function () {
      monacoLoading = false;
      resolve(window.monaco);
    });
  });
}

// Socket handler para recibir el contenido del archivo
socket.on('file_content', async ({ filePath, content }) => {
  pendingContent = { filePath, content };

  // Obtener referencias a los elementos
  const fileListContainer = document.getElementById('fileListContainer');
  const editorContainer = document.getElementById('editorContainer');

  // Ocultar el explorador de archivos y mostrar el editor
  fileListContainer.classList.add('hidden');
  editorContainer.classList.remove('hidden');

  // Actualizar el nombre del archivo
  const editingFileName = document.getElementById('editingFileName');
  editingFileName.textContent = filePath;

  try {
    // Esperar a que Monaco se cargue
    const monaco = await loadMonaco();

    // Inicializar o actualizar el editor
    const codeEditorElement = document.getElementById('codeEditor');
    if (!editor) {
      editor = monaco.editor.create(codeEditorElement, {
        value: content,
        language: getLanguageFromFilePath(filePath),
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on'
      });
    } else {
      editor.setValue(content);
      editor.updateOptions({
        language: getLanguageFromFilePath(filePath)
      });
    }
  } catch (error) {
    console.error('Error loading Monaco:', error);
  }
});

// Event listener para el botón de cerrar
document.getElementById('closeEditorBtn').addEventListener('click', () => {
  const fileListContainer = document.getElementById('fileListContainer');
  const editorContainer = document.getElementById('editorContainer');

  editorContainer.classList.add('hidden');
  fileListContainer.classList.remove('hidden');
});

// Event listener para el botón de guardar
document.getElementById('saveFileBtn').addEventListener('click', () => {
  if (editor) {
    const filePath = document.getElementById('editingFileName').textContent;
    const content = editor.getValue();
    socket.emit('save_file', { filePath, content });
  }
});

// Función auxiliar para determinar el lenguaje
function getLanguageFromFilePath(filePath) {
  const extension = filePath.split('.').pop().toLowerCase();
  const languageMap = {
    'js': 'javascript',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'txt': 'plaintext',
    'properties': 'plaintext',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'sh': 'shell',
    'bash': 'shell',
    'conf': 'plaintext'
  };
  return languageMap[extension] || 'plaintext';
}

// Escuchar la confirmación de guardado
socket.on('file_saved', () => {
  showToast('Archivo guardado correctamente', 'success');
});

function showNotification(message, type = 'info') {
  // Implementa tu sistema de notificaciones aquí
  console.log(`${type}: ${message}`);
}
async function handleEditFile(filename) {
  let base_route = route
  const fullPath = base_route + '/' + filename;
  socket.emit('edit_file', fullPath)
}

// Función de actualización de estadísticas
function updateUploadStats(fileName) {
  const state = uploadState[fileName];
  if (!state) return;

  const now = Date.now();
  const elapsed = (now - state.startTime) / 1000;
  const speed = state.bytesUploaded / elapsed;

  const progress = Math.round((state.bytesUploaded / state.file.size) * 100);
  const speedText = formatFileSize(speed) + '/s';

  const remainingBytes = state.file.size - state.bytesUploaded;
  const estimatedSecondsLeft = speed > 0 ? remainingBytes / speed : 0;
  const timeLeft = formatTime(estimatedSecondsLeft);

  const progressText = document.getElementById(`progress-${fileName}`);
  const progressBar = document.getElementById(`progress-bar-${fileName}`);
  const speedElement = document.getElementById(`speed-${fileName}`);
  const timeElement = document.getElementById(`time-${fileName}`);

  if (progressText && progressBar && speedElement && timeElement) {
    progressText.textContent = `${progress}%`;
    progressBar.style.width = `${progress}%`;
    speedElement.textContent = speedText;
    timeElement.textContent = timeLeft;
  }
}

// Función de cancelación de upload
function cancelUpload(fileName) {
  if (uploadState[fileName]) {
    uploadState[fileName].aborted = true;
    const element = document.getElementById(`upload-progress-${fileName}`);
    if (element) {
      element.remove();
    }
    delete uploadState[fileName];
    showToast('Upload cancelado', 'info');
  }
}

// Función de manejo de errores
function handleUploadError(fileName, error) {
  console.error(`Error manejado para ${fileName}:`, error);
  const element = document.getElementById(`upload-progress-${fileName}`);
  if (element) {
    element.remove();
  }
  delete uploadState[fileName];
  showToast(`Error al subir el archivo: ${error.message}`, 'error');
}


function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Event listeners del socket
socket.on('upload_success', (data) => {
  const { fileName } = data;
  console.log(`Upload completado exitosamente para ${fileName}`);

  const element = document.getElementById(`upload-progress-${fileName}`);
  if (element) {
    setTimeout(() => {
      element.remove();
      showToast('Archivo subido exitosamente', 'success');
      fetchFiles();
    }, 1000);
  }
  delete uploadState[fileName];
});

socket.on('upload_error', (data) => {
  const { fileName, error } = data;
  console.error(`Error en upload de ${fileName}:`, error);
  handleUploadError(fileName, new Error(error));
});

// Descarga de archivos
function handleDownload(file) {
  socket.emit('download_file', file.name, route);

  const downloadBtn = file.downloadButton;

  // Guardar el HTML original del botón
  const originalHTML = downloadBtn.innerHTML;

  // Cambiar el botón a estado de carga
  downloadBtn.disabled = true;
  downloadBtn.classList.remove('text-emerald-400', 'hover:bg-emerald-500/20', 'hover:scale-110');
  downloadBtn.classList.add('text-custom-purple/50');

  // Cambiar el icono por el de carga
  downloadBtn.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
  `;


  // Restaurar el botón después de 3 segundos
  setTimeout(() => {
    downloadBtn.disabled = false;
    downloadBtn.classList.remove('text-custom-purple/50');
    downloadBtn.classList.add('text-emerald-400', 'hover:bg-emerald-500/20', 'hover:scale-110');
    downloadBtn.innerHTML = originalHTML;
  }, 3000);
}

let downloadFileName = '';

socket.on('start_download', (data) => {
  console.log("fsad")
  downloadFileName = data.fileName;
  console.log(`Iniciando descarga de ${downloadFileName} (${data.fileSize} bytes)`);
});

socket.on('fileData', (data) => {
  // Convertir los datos recibidos a un Uint8Array
  const uint8Array = new Uint8Array(data);

  // Crear un Blob con el tipo MIME adecuado
  const blob = new Blob([uint8Array], {
    type: getMimeType(downloadFileName)
  });

  // Crear URL y descargar
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFileName;
  document.body.appendChild(a); // Necesario en algunos navegadores
  a.click();
  document.body.removeChild(a); // Limpieza
  window.URL.revokeObjectURL(url);
});

socket.on('downloadError', (error) => {
  console.error('Error en la descarga:', error);
  alert('Error al descargar el archivo: ' + error);
});

// Función auxiliar para determinar el tipo MIME
function getMimeType(fileName) {
  const extension = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    'json': 'application/json',
    'js': 'text/javascript',
    'css': 'text/css',
    'html': 'text/html',
    'csv': 'text/csv'
    // Añadir más tipos según necesidad
  };
  return mimeTypes[extension] || 'application/octet-stream';
}
// eliminar
// Modal HTML template
const modalTemplate = `
<div id="deleteModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
  <div class="bg-custom-dark border border-purple-800/20 rounded-lg p-6 max-w-md w-full mx-4 transform transition-all duration-300 scale-95 opacity-0">
    <div class="text-center">
      <div class="mb-4">
        <i class="fa-solid fa-trash-alt text-red-500 text-4xl"></i>
      </div>
      <h3 class="text-lg font-medium text-white mb-2">Confirmar eliminación</h3>
      <p class="text-gray-300 mb-6">¿Estás seguro de que deseas eliminar <span id="fileName" class="font-medium text-custom-purple"></span>?</p>
      <div class="flex justify-center space-x-4">
        <button id="cancelDelete" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
          Cancelar
        </button>
        <button id="confirmDelete" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
          Eliminar
        </button>
      </div>
    </div>
  </div>
</div>
`;

// Add modal to the document
document.body.insertAdjacentHTML('beforeend', modalTemplate);

// Toast notification system
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center space-x-2 transition-all duration-500 transform translate-y-full opacity-0 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white`;

  const icon = document.createElement('i');
  icon.className = `fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`;

  toast.appendChild(icon);
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  toast.appendChild(messageSpan);

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-full', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-full', 'opacity-0');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// Función modificada solo para el estilo del elemento de progreso
function createProgressElement(fileName) {
  const progressContainer = document.getElementById('uploadProgressContainer');
  if (!progressContainer) return;

  const container = document.createElement('div');
  container.id = `upload-progress-${fileName}`;
  container.className = `fixed bottom-4 right-4 w-80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 
    rounded-lg shadow-lg transition-all duration-300 transform`;

  container.innerHTML = `
    <div class="p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <i class="fa-solid fa-file-arrow-up text-custom-purple"></i>
          <span class="font-medium text-sm text-gray-700 truncate max-w-[180px]">${fileName}</span>
        </div>
        <button onclick="cancelUpload('${fileName}')" 
                class="text-gray-400 hover:text-red-500 transition-colors">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      
      <div class="space-y-1">
        <div class="flex justify-between text-xs text-gray-500">
          <span id="progress-${fileName}">0%</span>
          <span id="speed-${fileName}">0 B/s</span>
        </div>
        <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div id="progress-bar-${fileName}" 
               class="h-full bg-custom-purple rounded-full transition-all duration-300 ease-out"
               style="width: 0%">
          </div>
        </div>
        <div class="flex justify-between text-xs text-gray-400">
          <span>Tiempo restante:</span>
          <span id="time-${fileName}">--:--</span>
        </div>
      </div>
    </div>
  `;

  progressContainer.appendChild(container);
}
// Function to animate element removal
function animateAndRemove(element) {
  element.style.overflow = 'hidden';
  element.classList.add('transition-all', 'duration-500');

  // First animate opacity and slide right
  element.style.transform = 'translateX(100%)';
  element.style.opacity = '0';

  // Then remove after animation
  setTimeout(() => {
    element.style.maxHeight = '0';
    element.style.padding = '0';
    element.style.margin = '0';

    setTimeout(() => {
      element.remove();
    }, 300);
  }, 500);
}

// Modal controller
const deleteModal = {
  modal: document.getElementById('deleteModal'),
  fileNameSpan: document.getElementById('fileName'),
  currentFile: null,

  show(file) {
    this.currentFile = file;
    this.fileNameSpan.textContent = file.name;
    this.modal.classList.remove('hidden');
    this.modal.classList.add('flex');

    requestAnimationFrame(() => {
      const modalContent = this.modal.querySelector('div');
      modalContent.classList.remove('scale-95', 'opacity-0');
    });
  },

  hide() {
    const modalContent = this.modal.querySelector('div');
    modalContent.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
      this.modal.classList.remove('flex');
      this.modal.classList.add('hidden');
      this.currentFile = null;
    }, 300);
  },

  init() {
    document.getElementById('cancelDelete').addEventListener('click', () => this.hide());
    document.getElementById('confirmDelete').addEventListener('click', () => {
      if (this.currentFile) {
        const fileElement = document.querySelector(`[data-filename="${this.currentFile.name}"]`);
        socket.emit('delete_file', this.currentFile.name, route);

        if (fileElement) {
          const deleteButton = fileElement.querySelector('.delete-button');
          if (deleteButton) {
            deleteButton.disabled = true;
            deleteButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
          }
        }
      }
      this.hide();
    });
  }
};

// Initialize modal
deleteModal.init();

// Updated delete handler
function handleDelete(file) {
  deleteModal.show(file);
}

// Updated socket listener
socket.on("file_deleted", (result) => {
  if (result.success) {
    setTimeout(() => {
      showToast("Archivo eliminado exitosamente");
    }, 500);
    fetchFiles(route);
  } else {
    showToast(`Error al eliminar el archivo: ${result.error}`, 'error');
  }
});

// cambiar de ruta
function handleBack() {
  // Verifica si la ruta ya es la raíz ('/')
  if (route !== '/') {
    // Si no es la raíz, elimina el último segmento de la ruta
    const pathSegments = route.split('/');
    pathSegments.pop();  // Elimina el último segmento de la ruta
    route = pathSegments.join('/') || '/';  // Si la ruta queda vacía, establece la ruta en '/'
  }
  fetchFiles();  // Recarga los archivos para la nueva ruta
}

function handleChange(filename) {
  route = route.replace(/\/+$/, '') + "/" + filename.replace(/^\/+/, '');  // Elimina barras finales en la ruta y barras iniciales en el archivo
  fetchFiles();

}
socket.on('non-edit', async () => {
  showToast("El archivo no es editable", "error")
  handleBack()
})
// log

const logContainer = document.getElementById('server-logs');

async function fetchLog() {
  socket.emit("log");
  socket.on('log_response', async (data) => {
    const logText = data.stdout;
    const formattedLog = logText.split('\n').map(line => {
      if (line.includes('ERROR')) {
        return `<span class="text-red-500">${line}</span>`;
      } else if (line.includes('WARN')) {
        return `<span class="text-yellow-400">${line}</span>`;
      } else if (line.includes('INFO')) {
        return `<span class="text-blue-400">${line}</span>`;
      }
      return `<span class="text-white/70">${line}</span>`;
    }).join('\n');

    document.getElementById('server-logs').innerHTML =
      `<pre class="font-['Fira_Code'] text-[18px] leading-relaxed">${formattedLog}</pre>`;
  });
}

// Codigo del DOM
function switchTab(tab) {
  // Remover la clase active de todas las pestañas y contenidos
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Agregar la clase active a la pestaña y el contenido seleccionados
  document.getElementById(`${tab}Tab`).classList.add('active');
  document.getElementById(`${tab}Content`).classList.add('active');
  // Si la pestaña activada es "files", hacer el fetch de los archivos
  console.log(tab)
  if (tab == 'files') {
    fetchFiles();  // Llamar a la función para obtener los archivos
  }
  if (tab == 'server') {
    fetchStats();
  }
  if (tab == 'log') {
    fetchLog()
  }
  if (tab == 'console') {
    socket.emit('console');
    fitAddon.fit();

  }
  if (tab == 'linux') {
    socket.emit('terminal')
  }
  if (tab == 'uuid') {
    socket.emit('get_uuids')
  }
}

function formatFileSize(bytes) {
  // Check for invalid input

  // Handle zero case
  if (bytes == 0) {

    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  // Safely calculate the appropriate unit
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
