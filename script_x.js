/* =========================================
   ESTILOS Y CONFIGURACIÓN VISUAL (MODO X)
   Tema: Rojo / Rosca Política
========================================= */

let gobernadoresBase = [];
let turnoActual = 'manana'; // Mañana por defecto

const AVATAR_PLACEHOLDER_LOCAL = "./assets/img/avatar-placeholder.svg";
const UNAVATAR_TWITTER_BASE = "https://unavatar.io/twitter/";
const UNAVATAR_X_BASE = "https://unavatar.io/x/";

/* --- MOTOR DE AVATARES UNIFICADO CON FALLBACKS --- */
function obtenerFuentesAvatar(gobernador = {}) {
    const fuentes = [];
    
    // 1. Limpiar el handle de X (quitar @ y espacios)
    const handleClean = gobernador.usuario_x 
        ? String(gobernador.usuario_x).replace(/^@/, "").trim() 
        : null;

    // 2. Prioridad 1: URL de foto explícita en gobernadores.json
    if (gobernador.foto_url) {
        fuentes.push(gobernador.foto_url);
    }

    // 3. Prioridad 2: Unavatar (Twitter y X son lo mismo, probamos ambos endpoints)
    if (handleClean) {
        fuentes.push(`${UNAVATAR_TWITTER_BASE}${encodeURIComponent(handleClean)}`);
        fuentes.push(`${UNAVATAR_X_BASE}${encodeURIComponent(handleClean)}`);
    }

    // 4. Prioridad Final: Placeholder local
    fuentes.push(AVATAR_PLACEHOLDER_LOCAL);

    // Devolver array único sin nulos/vacíos
    return [...new Set(fuentes.filter(Boolean))];
}

function aplicarAvatarConFallback(imgElement, gobernador) {
    if (!imgElement) return;

    const fuentes = obtenerFuentesAvatar(gobernador);
    let indexActual = 0;

    // Función que intenta cargar la siguiente fuente si la actual falla
    const intentarSiguienteFuente = () => {
        indexActual++;
        if (indexActual < fuentes.length) {
            console.log(`Fallback avatar p/ ${gobernador.provincia}: intentando fuente ${indexActual}`);
            imgElement.src = fuentes[indexActual];
        } else {
            // Si todas fallan (raro), quitar el onerror para evitar bucles
            imgElement.onerror = null;
            console.warn(`No se pudo cargar avatar p/ ${gobernador.provincia} tras ${fuentes.length} intentos.`);
        }
    };

    // Configurar el manejador de errores ANTES de setear el src
    imgElement.onerror = intentarSiguienteFuente;

    // Iniciar la carga con la primera fuente
    imgElement.src = fuentes[0];
}


/* --- UTILIDADES --- */
// Función para escapar HTML y prevenir XSS en textos planos
function escaparHtml(texto) {
    if (!texto) return '';
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Función para formatear fecha como YYYY-MM-DD (con timezone Argentina)
function obtenerFechaFormateada(diasRestados = 0) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasRestados);
    return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}


/* --- RENDERIZADO DEL DASHBOARD --- */

// Renderiza el estado inicial de carga
function renderEstadoInicial() {
    const cajaEjecutivo = document.getElementById('resumen-ejecutivo');
    const cajaProfundo = document.getElementById('analisis-profundo');
    const temasLista = document.getElementById('temas-lista');
    const grilla = document.getElementById('grilla-gobernadores');

    if (cajaEjecutivo) cajaEjecutivo.innerHTML = '<p class="loading-text">Buscando resumen ejecutivo...</p>';
    if (cajaProfundo) cajaProfundo.innerHTML = '<p class="loading-text">Buscando análisis profundo...</p>';
    if (grilla) grilla.innerHTML = ''; // Limpiar grilla
    if (temasLista) temasLista.innerHTML = '<li>A la espera del procesamiento...</li>';
}

// Renderiza el post destacado
function renderTweetDestacado(tweetDestacado) {
    const tText = document.getElementById('tweet-destacado-texto');
    const tAutor = document.getElementById('tweet-destacado-autor');

    if (!tText || !tAutor) return;

    if (tweetDestacado && tweetDestacado.texto) {
        tText.textContent = `“${tweetDestacado.texto}”`;
        tAutor.textContent = tweetDestacado.usuario ? `- ${tweetDestacado.usuario}` : '';
    } else {
        tText.textContent = "Sin post destacado para este turno.";
        tAutor.textContent = "";
    }
}

// Renderiza la lista de temas calientes
function renderTemas(temas) {
    const temasLista = document.getElementById('temas-lista');
    if (!temasLista) return;

    temasLista.innerHTML = ''; // Limpiar lista

    if (!temas || !Array.isArray(temas) || temas.length === 0) {
        temasLista.innerHTML = '<li>Sin temas destacados para esta fecha.</li>';
        return;
    }

    // Tomar solo los primeros 5 temas
    temas.slice(0, 5).forEach(temaItem => {
        const li = document.createElement('li');
        
        // Soporte para formato viejo (string) y nuevo (objeto con involucrados)
        if (typeof temaItem === 'string') {
            li.textContent = temaItem;
        } else if (temaItem && temaItem.tema) {
            const numGobs = (temaItem.gobernadores_involucrados && Array.isArray(temaItem.gobernadores_involucrados)) 
                ? temaItem.gobernadores_involucrados.length 
                : 0;
            li.textContent = `${temaItem.tema} · ${numGobs} gobs`;
        } else {
            li.textContent = "Tema no disponible";
        }
        
        temasLista.appendChild(li);
    });
}

// Renderiza la grilla de tarjetas de gobernadores
function renderGrilla(analisis, crudo) {
    const grilla = document.getElementById('grilla-gobernadores');
    if (!grilla) return;

    grilla.innerHTML = ''; // Limpiar grilla
    
    // Normalizar el análisis por gobernador
    const analisisPorGobernador = (analisis && Array.isArray(analisis.analisis_por_gobernador)) 
        ? analisis.analisis_por_gobernador 
        : [];

    gobernadoresBase.forEach(gob => {
        // Buscar análisis específico para este gobernador
        const analisisGob = analisisPorGobernador.find(item => {
            if (!item || !item.gobernador) return false;
            const itemGobNormalizado = String(item.gobernador).toLowerCase();
            const usuarioNormalizado = gob.usuario_x ? String(gob.usuario_x).toLowerCase() : '---';
            const provinciaNormalizado = gob.provincia ? String(gob.provincia).toLowerCase() : '---';
            
            return itemGobNormalizado.includes(usuarioNormalizado) || 
                   (provinciaNormalizado !== '---' && itemGobNormalizado.includes(provinciaNormalizado));
        });

        // Buscar tweets crudos específicos (soporta @handle, handle sin @ y usuario_x crudo)
        let crudoGob = [];
        if (crudo && typeof crudo === 'object') {
            const handleSinArroba = gob.usuario_x ? String(gob.usuario_x).replace(/^@/, "") : null;
            crudoGob = crudo[gob.usuario_x] || 
                       crudo[handleSinArroba] || 
                       crudo[`@${handleSinArroba}`] || 
                       [];
        }

        // Crear Tarjeta HTML
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-gob';
        
        // Fallback p/ resumen: usar postura o cargo si no hay análisis
        const resumen = analisisGob ? (analisisGob.resumen || analisisGob.postura_politica) : (gob.cargo || "Sin resumen disponible.");

        tarjeta.innerHTML = `
            <div class="tarjeta-gob-header">
                <img alt="Avatar de ${escaparHtml(gob.provincia)}" class="tarjeta-gob-avatar">
                <div>
                    <h4>${escaparHtml(gob.provincia)}</h4>
                    <p>${escaparHtml(gob.usuario_x)}</p>
                </div>
            </div>
            <div class="tarjeta-gob-body">
                <p>${escaparHtml(resumen)}</p>
            </div>
        `;

        // Aplicar avatar con motor de fallback
        const imagenGobernador = tarjeta.querySelector('.tarjeta-gob-avatar');
        aplicarAvatarConFallback(imagenGobernador, gob);

        // Evento clic para abrir modal
        tarjeta.addEventListener('click', () => abrirModal(gob, analisisGob, crudoGob));

        grilla.appendChild(tarjeta);
    });
}


/* --- FUNCIONES DE CARGA DE DATOS (FETCH) --- */

// Carga el tablero completo para una fecha y turno dados
async function cargarTablero(fecha) {
    console.log(`Iniciando carga de tablero p/ fecha: ${fecha} (${turnoActual})...`);
    renderEstadoInicial();

    const cajaEjecutivo = document.getElementById('resumen-ejecutivo');
    const cajaProfundo = document.getElementById('analisis-profundo');

    try {
        // Definir rutas de archivos JSON basados en la fecha y turno
        const urlAnalisis = `./data/${fecha}_analisis_subtrama_${turnoActual}.json`;
        const urlCrudo = `./data/${fecha}_crudo_${turnoActual}.json`;

        console.log(`Buscando archivos: \n1. ${urlAnalisis}\n2. ${urlCrudo}`);

        // Fetch en paralelo de ambos archivos
        const [respAnalisis, respCrudo] = await Promise.all([
            fetch(urlAnalisis, { cache: "no-store" }),
            fetch(urlCrudo, { cache: "no-store" }).catch(e => {
                console.warn("Archivo crudo no encontrado (es opcional). Usando array vacío.");
                return { ok: false };
            })
        ]);

        if (!respAnalisis.ok) throw new Error(`Archivo de análisis no encontrado p/ ${fecha} (${turnoActual})`);
        const analisis = await respAnalisis.json();
        
        // El crudo es opcional, si falla usamos objeto vacío
        let crudo = {};
        if (respCrudo.ok) {
            try { crudo = await respCrudo.json(); } catch(e) { console.warn("Error al parsear JSON crudo."); }
        }

        console.log("Datos JSON cargados con éxito.");

        // --- Actualizar Interfaz (Macro) ---
        if (cajaEjecutivo) {
            const rEjecutivo = analisis ? (analisis.resumen_ejecutivo || analisis.resumen) : null;
            cajaEjecutivo.innerHTML = rEjecutivo 
                ? `<p>${escaparHtml(rEjecutivo)}</p>` 
                : '<p class="error-text">Resumen ejecutivo no disponible en el JSON.</p>';
        }

        if (cajaProfundo) {
            const rProfundo = analisis ? (analisis.analisis_profundo || analisis.analisis) : null;
            cajaProfundo.innerHTML = rProfundo 
                ? `<p>${escaparHtml(rProfundo)}</p>` 
                : '<p class="error-text">Análisis profundo no disponible en el JSON.</p>';
        }

        // Semáforo, Temas y Tweet Destacado
        actualizarSemaforo(analisis ? analisis.clima_general : null);
        renderTemas(analisis ? analisis.temas_calientes : null);
        renderTweetDestacado(analisis ? analisis.tweet_destacado : null);

        // --- Actualizar Grilla (Micro) ---
        renderGrilla(analisis, crudo);

    } catch (error) {
        console.error("Error crítico al cargar el tablero:", error);
        if (cajaEjecutivo) cajaEjecutivo.innerHTML = `<p class="error-text">Error al leer los archivos JSON para la fecha ${fecha} (${turnoActual}). Verificá que existan en la carpeta 'data/'.</p>`;
        if (cajaProfundo) cajaProfundo.innerHTML = '';
        actualizarSemaforo(null); // Gris
    }
}


/* --- MODAL DE DETALLE POR GOBERNADOR --- */

function abrirModal(gobernador, analisisGob, crudoGob) {
    const modal = document.getElementById('modal-detalle');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalContenido = document.getElementById('modal-contenido');

    if (!modal) return;

    // Setear Título (Provincia | Handle)
    if (modalTitulo) {
        modalTitulo.innerText = `${gobernador.provincia} ${gobernador.usuario_x ? `| ${gobernador.usuario_x}` : ""}`;
    }

    // Preparar contenido HTML del modal
    if (modalContenido) {
        // Análisis individual (escapado)
        const resumen = analisisGob ? (analisisGob.resumen || analisisGob.postura_politica) : "Sin análisis individual disponible.";
        
        // Tweets crudos (HTML PURO, SIN ESCAPAR)
        let htmlTweets = '';
        if (crudoGob && Array.isArray(crudoGob) && crudoGob.length > 0) {
            // Unimos los tweets (que ya vienen como HTML) envolviéndolos en divs
            // --- PARCHE 1: NO ESCAPAR EL HTML DE LOS TWEETS ---
            htmlTweets = crudoGob.map(t => `<div class="tweet-item">${t}</div>`).join(''); 
        } else {
            htmlTweets = '<p class="no-tweets-text">No hay tweets crudos disponibles para este gobernador en esta fecha.</p>';
        }

        // Inyectar HTML estructurado
        modalContenido.innerHTML = `
            <div class="modal-analisis">
                <h3>Análisis Subtrama</h3>
                <p>${escaparHtml(resumen)}</p>
            </div>
            <div class="modal-tweets">
                <h3>Tweets Crudos (X/Twitter)</h3>
                ${htmlTweets}
            </div>
        `;
    }

    // Mostrar modal (quitando clase 'oculta' o agregando 'activa')
    modal.classList.add('activa');

    // --- PARCHE 2: ACTIVAR GLOBITOS DE X ---
    // Cuando inyectamos HTML dinámicamente vía innerHTML, el script oficial de Twitter (widgets.js)
    // que cargamos en el index.html no se entera de que hay nuevos tweets por renderizar.
    // Usamos setTimeout para dar un respiro de 100ms y asegurar que el navegador ya dibujó el HTML crudo.
    setTimeout(() => {
        if (window.twttr && window.twttr.widgets) {
            console.log("Iniciando renderizado de globitos de X en Modal (Modo Rosca)...");
            // Pedimos a la librería de X que re-escanee el DOM buscando blockquotes.twitter-tweet
            window.twttr.widgets.load();
        } else {
            console.warn("Librería twttr.widgets no cargada. Los tweets se verán planos.");
        }
    }, 100); 
}


/* --- EVENTOS UI (Selectores, Botones, Modal) --- */

// Motor del Semáforo de Clima Político
function actualizarSemaforo(estadoClima) {
    const semaforo = document.getElementById('semaforo-clima');
    if (!semaforo) return;

    semaforo.classList.remove('gris', 'rojo', 'amarillo', 'verde');
    const estado = estadoClima ? String(estadoClima).toUpperCase() : "DESCONOCIDO";

    // Mismos criterios que prompt de Grok (main.py)
    if (estado.includes("TENSO") || estado.includes("CONFLICTO") || estado.includes("NEGATIVO")) {
        semaforo.classList.add('rojo');
        semaforo.title = `Clima Político: ${estado}`;
    } else if (estado.includes("NEUTRAL") || estado.includes("MODERADO") || estado.includes("SILENCIO")) {
        semaforo.classList.add('amarillo');
        semaforo.title = `Clima Político: ${estado}`;
    } else if (estado.includes("POSITIVO") || estado.includes("COOPERATIVO") || estado.includes("ACUERDO")) {
        semaforo.classList.add('verde');
        semaforo.title = `Clima Político: ${estado}`;
    } else {
        semaforo.classList.add('gris'); // Fallback o "DESCONOCIDO"
        semaforo.title = "Clima Político: Sin datos";
    }
}

// Alternar entre Turno Mañana y Noche
function cambiarTurno() {
    const btn = document.getElementById('btn-turno');
    const inputFecha = document.getElementById('fecha-select');
    if (!btn || !inputFecha) return;

    const fechaSeleccionada = inputFecha.value;

    // Animación visual de clic
    btn.classList.add('activo');
    setTimeout(() => btn.classList.remove('activo'), 300);

    // Cambiar estado
    if (turnoActual === 'manana') {
        turnoActual = 'noche';
        btn.innerHTML = '🌙 Turno Noche';
        document.body.classList.add('turno-noche'); // Opcional p/ CSS
    } else {
        turnoActual = 'manana';
        btn.innerHTML = '☀️ Turno Mañana';
        document.body.classList.remove('turno-noche');
    }

    // Recargar tablero con nuevo turno
    cargarTablero(fechaSeleccionada);
}


/* --- INICIALIZACIÓN --- */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Iniciando Web Modo X...");
    renderEstadoInicial();

    const inputFecha = document.getElementById('fecha-select');
    const btnTurno = document.getElementById('btn-turno');
    const closeBtn = document.querySelector('.close-btn');

    // 1. Detectar turno automático por hora (Ar)
    const ahoraArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const horaArg = ahoraArg.getHours();
    turnoActual = (horaArg >= 20 || horaArg < 6) ? 'noche' : 'manana';
    if (btnTurno) btnTurno.innerHTML = turnoActual === 'noche' ? '🌙 Turno Noche' : '☀️ Turno Mañana';

    // 2. Configurar fecha por defecto (Hoy)
    const fechaHoy = obtenerFechaFormateada(0);
    if (inputFecha) {
        inputFecha.value = fechaHoy;
        // Evento change p/ recargar al cambiar fecha
        inputFecha.addEventListener('change', (e) => cargarTablero(e.target.value));
    }

    // 3. Eventos UI
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('modal-detalle')?.classList.remove('activa');
        });
    }

    // Cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('modal-detalle');
        if (e.target === modal) {
            modal.classList.remove('activa');
        }
    });

    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('modal-detalle')?.classList.remove('activa');
        }
    });


    // 4. Cargar Base de Gobernadores y luego el tablero
    try {
        const res = await fetch('./gobernadores.json', { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo cargar gobernadores.json");
        gobernadoresBase = await res.json();
        console.log(`Base de ${gobernadoresBase.length} gobernadores cargada.`);

        // Cargar tablero inicial (Hoy + Turno Detectado)
        await cargarTablero(fechaHoy);

    } catch (error) {
        console.error("Error crítico al iniciar:", error);
        const cajaEj = document.getElementById('resumen-ejecutivo');
        const cajaProf = document.getElementById('analisis-profundo');
        if (cajaEj) cajaEj.innerHTML = '<p class="error-text">Error crítico al cargar la base de datos de gobernadores.</p>';
        if (cajaProf) cajaProf.innerHTML = '<p class="error-text">Asegurate de que el archivo "gobernadores.json" exista en la raíz.</p>';
    }
});
