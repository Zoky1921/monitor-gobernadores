let gobernadoresBase = [];
let turnoActual = "manana"; // Memoria global del turno

// =========================================
// FUNCIÓN PARA OBTENER FECHA ARGENTINA
// =========================================
function obtenerFechaFormateada(diasRestados = 0) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasRestados);
    return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); 
}



    inputFecha.addEventListener("change", (e) => cargarTablero(e.target.value));
    
    document.querySelector(".close-btn").addEventListener("click", () => {
        document.getElementById("modal-detalle").classList.add("oculta");
    });
});

async function cargarTablero(fecha) {
    console.log(`Intentando cargar datos para la fecha: ${fecha}`);
    
    const cajaEjecutivo = document.getElementById("resumen-ejecutivo");
    const cajaProfundo = document.getElementById("analisis-profundo");
    const temasLista = document.getElementById("temas-lista");
    const grilla = document.getElementById("grilla-gobernadores");

    cajaEjecutivo.innerHTML = "<i>Buscando resumen ejecutivo...</i>";
    cajaProfundo.innerHTML = "<i>Buscando análisis profundo...</i>";
    grilla.innerHTML = "";
    temasLista.innerHTML = "<li>Cargando...</li>";

    try {
        const resAnalisis = await fetch(`./data/${fecha}_analisis_${turnoActual}.json`);
        const resCrudo = await fetch(`./data/${fecha}_crudo_${turnoActual}.json`);

if (!resAnalisis.ok || !resCrudo.ok) {
            console.warn(`Archivos no encontrados para la fecha ${fecha}`);
            
            // EL NUEVO CARTEL ELEGANTE (SIN ALERTAS)
            cajaEjecutivo.innerHTML = `
                <div style="text-align: center; padding: 25px; color: #cbd5e1; background-color: rgba(30, 41, 59, 0.5); border-radius: 8px; border: 1px dashed #334155;">
                    <h4 style="color: #38bdf8; margin-bottom: 10px;">No hay informes para el ${fecha} (${turnoActual}).</h4>
                    <p style="margin: 0; font-size: 0.95rem;">Los datos se procesan en dos turnos:</p>
                    <p style="margin: 0; font-size: 0.95rem;">Por la <strong>mañana (10:45 aprox)</strong> y por la <strong>noche (20:15 aprox)</strong>.</p>
                </div>
            `;
            
            // Limpiamos el resto de las cajas para que no quede "basura" visual
            cajaProfundo.innerHTML = "<p style='text-align:center; color:#94a3b8; margin-top:20px;'><i>A la espera del procesamiento...</i></p>";
            temasLista.innerHTML = "<li>Sin datos registrados</li>";
            document.getElementById("tweet-destacado-texto").textContent = "Sin posteos destacados en este turno.";
            document.getElementById("tweet-destacado-autor").textContent = "";
            actualizarSemaforo(null); 
            
            return false; 
        }

        const analisis = await resAnalisis.json();
        const crudo = await resCrudo.json();

        // 0. ACTUALIZAR SEMÁFORO 
        actualizarSemaforo(analisis.clima_general);

        // 1. DOBLE VELOCIDAD DE LECTURA
        cajaEjecutivo.textContent = analisis.resumen_ejecutivo || "Resumen ejecutivo no disponible.";
        
        if (analisis.analisis_profundo) {
            const textoConParrafos = analisis.analisis_profundo.replace(/\. /g, '.<br><br>');
            cajaProfundo.innerHTML = textoConParrafos;
        } else {
            cajaProfundo.innerHTML = "Análisis profundo no disponible.";
        }

        // 2. TENDENCIAS (CON EFECTO TERONO INTEGRADO)
        temasLista.innerHTML = "";
        if (analisis.temas_calientes) {
            analisis.temas_calientes.slice(0, 5).forEach(temaItem => {
                let li = document.createElement("li");
                
                if (typeof temaItem === 'string') {
                    li.textContent = temaItem; 
                } else {
                    li.innerHTML = `<span>${temaItem.tema}</span> <span style="float:right; font-size:0.7rem; background:#3b82f6; color:#0f172a; padding:2px 8px; border-radius:10px; font-weight:bold;">${temaItem.gobernadores_involucrados.length} gobs</span>`;
                    li.style.cursor = "pointer";
                    li.style.transition = "all 0.2s ease";
                    li.title = "Clic para ver quiénes hablaron de esto";
                    
                    li.onmouseover = () => li.style.borderColor = "#3b82f6";
                    li.onmouseout = () => li.style.borderColor = "transparent";
                    li.style.border = "1px solid transparent";

                    li.onclick = () => aplicarFiltroTerono(temaItem.gobernadores_involucrados);
                }
                temasLista.appendChild(li);
            });
        }

        // 3. EL POST DEL DÍA
        if (analisis.tweet_destacado) {
            document.getElementById("tweet-destacado-texto").textContent = `"${analisis.tweet_destacado.texto}"`;
            document.getElementById("tweet-destacado-autor").textContent = `- ${analisis.tweet_destacado.usuario}`;
        }

        // 4. GRILLA DE GOBERNADORES (CON DATASET DE USUARIO)
        gobernadoresBase.forEach(gob => {
            const analisisGob = analisis.analisis_por_gobernador.find(
                a => a.gobernador.toLowerCase().includes(gob.usuario_x.toLowerCase())
            );
            const crudoGob = crudo[gob.usuario_x] || [];

            let tarjeta = document.createElement("div");
            tarjeta.className = "tarjeta-gob";
            
            tarjeta.dataset.usuario = gob.usuario_x.toLowerCase().replace('@', ''); 

            tarjeta.innerHTML = `
                <img src="${gob.foto_url}" alt="${gob.nombre}" onerror="this.src='https://via.placeholder.com/80'">
                <h4>${gob.nombre}</h4>
                <p>${gob.provincia}</p>
            `;
            tarjeta.addEventListener("click", () => abrirModal(gob, analisisGob, crudoGob));
            grilla.appendChild(tarjeta);
        });

        // NUEVO: Disparamos el sincronizador de altura con un leve retraso para asegurar que los textos ya se dibujaron
        setTimeout(sincronizarAlturas, 150);

        return true; 

    } catch (error) {
        console.error("Error al cargar el tablero:", error);
        cajaEjecutivo.innerHTML = "Hubo un error al leer los archivos JSON.";
        cajaProfundo.innerHTML = "";
        return false;
    }
}

// =========================================
// FUNCIÓN PARA ABRIR LA VENTANA FLOTANTE 
// =========================================
function abrirModal(gobernador, analisisGob, crudoGob) {
    const modal = document.getElementById("modal-detalle");
    const modalBio = document.getElementById("modal-bio");
    
    modalBio.innerHTML = `
        <img src="${gobernador.foto_url}" alt="${gobernador.nombre}" onerror="this.src='https://via.placeholder.com/100'">
        <div>
            <h2>${gobernador.nombre} (@${gobernador.usuario_x})</h2>
            <p><strong>${gobernador.provincia}</strong> | ${gobernador.partido || 'Gobernador'}</p>
            <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 10px;">${gobernador.bio || ''}</p>
        </div>
    `;

    let textoAnalisis = "Sin actividad política registrada para la fecha seleccionada.";
    let textoCita = "Sin citas textuales hoy.";

    if (analisisGob) {
        textoAnalisis = analisisGob.postura_politica || analisisGob.analisis || textoAnalisis;
        textoCita = analisisGob.frase_fuerte || analisisGob.cita_textual_relevante || textoCita;
    }

    document.getElementById("modal-analisis").textContent = textoAnalisis;
    document.getElementById("modal-cita-textual").textContent = textoCita;

    const divCrudo = document.getElementById("modal-tweets-crudos");
    divCrudo.innerHTML = "";
    if (crudoGob && crudoGob.length > 0) {
        crudoGob.forEach(tweet => {
            let div = document.createElement("div");
            div.className = "tweet-item";
            div.innerHTML = tweet;
            divCrudo.appendChild(div);
        });
    } else {
        divCrudo.innerHTML = "<p style='color: #94a3b8; font-style: italic;'>No hay tweets para mostrar en esta fecha.</p>";
    }
    
    modal.classList.remove("oculta");
}

/* =========================================
   FUNCIONES DE ACCIÓN RÁPIDA (COMPARTIR)
========================================= */
function copiarTexto(idElemento, botonPresionado) {
    let texto = document.getElementById(idElemento).innerText;
    
    // 1. Armamos el texto base
    if (idElemento === 'tweet-destacado-texto') {
        const autor = document.getElementById('tweet-destacado-autor').innerText;
        texto = `"${texto}"\n${autor}`;
    } else {
        // Si es un análisis o resumen, lo envolvemos en comillas
        texto = `"${texto}"`;
    }

    // 2. Le inyectamos SIEMPRE la firma del Radar al final
    texto += `\n\n📌 Vía El Radar Federal\n👉 radarfederal.com.ar`;

    const iconoOriginal = botonPresionado.innerHTML;
    
    // 3. Mandamos al portapapeles
    navigator.clipboard.writeText(texto).then(() => {
        botonPresionado.innerHTML = "✅";
        botonPresionado.style.color = "#4ade80"; 
        botonPresionado.style.borderColor = "#4ade80";
        
        setTimeout(() => {
            botonPresionado.innerHTML = iconoOriginal;
            botonPresionado.style.color = ""; 
            botonPresionado.style.borderColor = "";
        }, 1500); 
    }).catch(err => {
        console.error('Error al copiar: ', err);
    });
}

function compartirWhatsApp(idElemento) {
    const texto = document.getElementById(idElemento).innerText;
    let mensaje = `📌 *Vía El Radar Federal:*\n\n"${texto}"`;

    if (idElemento === 'tweet-destacado-texto') {
         const autor = document.getElementById('tweet-destacado-autor').innerText;
         mensaje += `\n${autor}`;
    }
    
    mensaje += `\n\n👉 radarfederal.com.ar`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

function compartirX(idElemento) {
    const texto = document.getElementById(idElemento).innerText;
    let tweetTexto = `"${texto}"`;
    
    if (idElemento === 'tweet-destacado-texto') {
         const autor = document.getElementById('tweet-destacado-autor').innerText;
         tweetTexto += `\n${autor}`;
    }
    
tweetTexto += `\n\n📊 Vía El Radar Federal\n👉 radarfederal.com.ar`;
    
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetTexto)}`;
    window.open(url, '_blank');
}

/* =========================================
   MOTOR DEL SEMÁFORO DE CLIMA POLÍTICO
========================================= */
function actualizarSemaforo(estadoClima) {
    const semaforo = document.getElementById('semaforo-clima');
    semaforo.classList.remove('gris', 'rojo', 'amarillo', 'verde');

    const estado = estadoClima ? estadoClima.toUpperCase() : "DESCONOCIDO";

    if (estado.includes("TENSO") || estado.includes("NEGATIVO") || estado.includes("CONFLICTO")) {
        semaforo.classList.add('rojo');
        semaforo.title = "Clima Político: TENSO";
    } else if (estado.includes("NEUTRAL") || estado.includes("MODERADO") || estado.includes("AMBIVALENTE")) {
        semaforo.classList.add('amarillo');
        semaforo.title = "Clima Político: NEUTRAL / MODERADO";
    } else if (estado.includes("POSITIVO") || estado.includes("COOPERATIVO") || estado.includes("ACUERDO")) {
        semaforo.classList.add('verde');
        semaforo.title = "Clima Político: POSITIVO / COOPERATIVO";
    } else {
        semaforo.classList.add('gris'); 
        semaforo.title = "Clima Político: Sin datos";
    }
}

/* =========================================
   FILTRO DE GOBERNADORES EN TIEMPO REAL (Buscador)
========================================= */
function filtrarGobernadores() {
    const textoBusqueda = document.getElementById('buscador-gobernadores').value.toLowerCase();
    const tarjetas = document.querySelectorAll('.tarjeta-gob');

    tarjetas.forEach(tarjeta => {
        const contenidoTarjeta = tarjeta.innerText.toLowerCase();

        if (contenidoTarjeta.includes(textoBusqueda)) {
            tarjeta.style.display = ''; 
        } else {
            tarjeta.style.display = 'none'; 
        }
    });
}

/* =========================================
   EFECTO TERONO: FILTROS INTERACTIVOS
========================================= */
function aplicarFiltroTerono(gobernadoresInvolucrados) {
    const tarjetas = document.querySelectorAll('.tarjeta-gob');
    const involucradosLimpios = gobernadoresInvolucrados.map(g => g.toLowerCase().replace('@', ''));
    let hayResultados = false;

    tarjetas.forEach(tarjeta => {
        const usuarioTarjeta = tarjeta.dataset.usuario;
        if (involucradosLimpios.includes(usuarioTarjeta)) {
            tarjeta.style.display = ''; 
            tarjeta.style.borderColor = '#3b82f6'; 
            hayResultados = true;
        } else {
            tarjeta.style.display = 'none'; 
            tarjeta.style.borderColor = '#334155'; 
        }
    });

    if (hayResultados) {
        document.getElementById("seccion-mapa").scrollIntoView({ behavior: 'smooth' });
        
        let btnVolver = document.getElementById('btn-rescate-terono');
        
        if (!btnVolver) {
            btnVolver = document.createElement('button');
            btnVolver.id = 'btn-rescate-terono';
            btnVolver.innerHTML = '⬆️ Limpiar y volver';
            btnVolver.className = 'btn-rescate'; 
            
            btnVolver.onclick = () => {
                limpiarFiltrosTerono();
                document.querySelector('.dashboard-macro').scrollIntoView({ behavior: 'smooth' });
            };
            
            const contenedorControles = document.querySelector('.controles-grilla');
            contenedorControles.appendChild(btnVolver);
        }
        
        btnVolver.style.display = 'inline-block';
    }
}

function limpiarFiltrosTerono() {
    const tarjetas = document.querySelectorAll('.tarjeta-gob');
    
    tarjetas.forEach(tarjeta => {
        tarjeta.style.display = ''; 
        tarjeta.style.borderColor = '#334155'; 
    });
    
    document.getElementById('buscador-gobernadores').value = ''; 
    
    const btnVolver = document.getElementById('btn-rescate-terono');
    if (btnVolver) {
        btnVolver.style.display = 'none';
    }
}

/* =========================================
   SINCRONIZADOR DE ALTURAS (EFECTO ESPEJO)
========================================= */
function sincronizarAlturas() {
    const sidebar = document.querySelector('.sidebar');
    const resumenCard = document.querySelector('.resumen-card');
    
    if (sidebar && resumenCard) {
        // 1. Apagamos la altura forzada para medir al natural
        resumenCard.style.height = 'auto';
        
        // 2. Si estamos en PC, copiamos la medida exacta
        if (window.innerWidth > 768) {
            // Tomamos la altura del jefe (columna derecha)
            const alturaDerecha = sidebar.offsetHeight;
            
            // Obligamos al esclavo (columna izquierda) a medir EXACTAMENTE eso
            resumenCard.style.height = alturaDerecha + 'px';
        }
    }
}
/* =========================================
   SELECTOR DE TURNO (MAÑANA / NOCHE)
========================================= */
function cambiarTurno() {
    const btn = document.getElementById("btn-turno");
    const fechaSeleccionada = document.getElementById("fecha-select").value;
    
    // 1. Feedback Visual Rápido: Le ponemos la clase activo y se la sacamos para el "destello"
    btn.classList.add("activo");
    setTimeout(() => btn.classList.remove("activo"), 300);
    
    // 2. Alternamos el estado lógicamente (SIN ALERTS)
    if (turnoActual === "manana") {
        turnoActual = "noche";
        btn.innerHTML = "🌙 Turno Noche";
    } else {
        turnoActual = "manana";
        btn.innerHTML = "☀️ Turno Mañana";
    }
    
    // 3. Mandamos a cargar. Si el archivo no existe, el nuevo cartel hermoso se encarga.
    cargarTablero(fechaSeleccionada);
}
