let gobernadoresBase = [];
let turnoActual = "manana"; // Memoria global del turno
const AVATAR_PLACEHOLDER_LOCAL = "./assets/img/avatar-placeholder.svg";
const UNAVATAR_TWITTER_BASE = "https://unavatar.io/twitter/";
const UNAVATAR_X_BASE = "https://unavatar.io/x/";

function obtenerUsuarioSinArroba(usuarioX = "") {
    return usuarioX.replace(/^@/, "").trim();
}

function obtenerFuentesAvatar(gobernador = {}) {
    const fuentes = [];
    const handle = obtenerUsuarioSinArroba(gobernador.usuario_x || "");

    if (gobernador.foto_url) fuentes.push(gobernador.foto_url);

    if (handle) {
        const fallbackTwitter = `${UNAVATAR_TWITTER_BASE}${encodeURIComponent(handle)}`;
        const fallbackX = `${UNAVATAR_X_BASE}${encodeURIComponent(handle)}`;

        if (!fuentes.includes(fallbackTwitter)) fuentes.push(fallbackTwitter);
        if (!fuentes.includes(fallbackX)) fuentes.push(fallbackX);
    }

    fuentes.push(AVATAR_PLACEHOLDER_LOCAL);
    return [...new Set(fuentes)];
}

function escaparHtml(texto = "") {
    return texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function aplicarAvatarConFallback(img, gobernador) {
    if (!img) return;

    const fuentes = obtenerFuentesAvatar(gobernador);
    const limpiarEstadoFallback = () => {
        delete img.dataset.fallbackIndex;
        img.onerror = null;
        img.onload = null;
    };

    img.dataset.fallbackIndex = "0";
    img.onload = limpiarEstadoFallback;
    img.onerror = () => {
        const proximoIndex = Number(img.dataset.fallbackIndex || "0") + 1;
        if (proximoIndex >= fuentes.length) {
            limpiarEstadoFallback();
            return;
        }

        img.dataset.fallbackIndex = String(proximoIndex);
        const proximaFuente = fuentes[proximoIndex];
        img.src = proximaFuente;
    };
    img.src = fuentes[0];
}

function obtenerFechaFormateada(diasRestados = 0) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasRestados);
    return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); 
}

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Web iniciada. Cargando base de gobernadores...");
    const inputFecha = document.getElementById("fecha-select");
    
    const ahoraArg = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"}));
    const horaArg = ahoraArg.getHours();
    
    if (horaArg >= 20) {
        turnoActual = "noche";
        document.getElementById("btn-turno").innerHTML = "🌙 Turno Noche";
    } else {
        turnoActual = "manana";
        document.getElementById("btn-turno").innerHTML = "☀️ Turno Mañana";
    }
    
    try {
        const res = await fetch("./gobernadores.json");
        if (!res.ok) throw new Error("No se pudo cargar gobernadores.json");
        gobernadoresBase = await res.json();
        console.log("Base de gobernadores cargada con éxito.");
        
        let fechaHoy = obtenerFechaFormateada(0); 
        await cargarTablero(fechaHoy);
        
        if(inputFecha) inputFecha.value = fechaHoy;

    } catch (error) {
        console.error("Error crítico al iniciar:", error);
        const cajaEj = document.getElementById("resumen-ejecutivo");
        if(cajaEj) cajaEj.innerHTML = "Error al cargar la base de datos.";
    }

    if(inputFecha) {
        inputFecha.addEventListener("change", (e) => cargarTablero(e.target.value));
    }
    
    const closeBtn = document.querySelector(".close-btn");
    if(closeBtn) {
        closeBtn.addEventListener("click", () => {
            document.getElementById("modal-detalle").classList.add("oculta");
        });
    }
});

async function cargarTablero(fecha) {
    console.log(`Intentando cargar datos para la fecha: ${fecha}`);
    
    const cajaEjecutivo = document.getElementById("resumen-ejecutivo");
    const cajaProfundo = document.getElementById("analisis-profundo");
    const temasLista = document.getElementById("temas-lista");
    const grilla = document.getElementById("grilla-gobernadores");

    if(cajaEjecutivo) cajaEjecutivo.innerHTML = "<i>Buscando resumen ejecutivo...</i>";
    if(cajaProfundo) cajaProfundo.innerHTML = "<i>Buscando análisis profundo...</i>";
    if(grilla) grilla.innerHTML = "";
    if(temasLista) temasLista.innerHTML = "<li>Cargando...</li>";

    try {
        // CAMBIO 1: Agregamos _subtrama_ a la ruta
        const resAnalisis = await fetch(`./data/${fecha}_analisis_subtrama_${turnoActual}.json`);
        const resCrudo = await fetch(`./data/${fecha}_crudo_${turnoActual}.json`);

        if (!resAnalisis.ok || !resCrudo.ok) {
            console.warn(`Archivos no encontrados para la fecha ${fecha}`);
            const turnoVisual = turnoActual === "manana" ? "mañana" : "noche";
            
            if(cajaEjecutivo) {
                cajaEjecutivo.innerHTML = `
                    <div style="text-align: center; padding: 25px; color: #cbd5e1; background-color: rgba(30, 41, 59, 0.5); border-radius: 8px; border: 1px dashed #334155;">
                        <h4 style="color: #38bdf8; margin-bottom: 10px;">No hay informes para el ${fecha} (${turnoVisual}).</h4>
                        <p style="margin: 0; font-size: 0.95rem;">Los datos se procesan en dos turnos:</p>
                        <p style="margin: 0; font-size: 0.95rem;">Por la <strong>mañana (10:45 aprox)</strong> y por la <strong>noche (20:15 aprox)</strong>.</p>
                    </div>
                `;
            }
            if(cajaProfundo) cajaProfundo.innerHTML = "<p style='text-align:center; color:#94a3b8; margin-top:20px;'><i>A la espera del procesamiento...</i></p>";
            if(temasLista) temasLista.innerHTML = "<li>Sin datos registrados</li>";
            
            const tweetTexto = document.getElementById("tweet-destacado-texto");
            const tweetAutor = document.getElementById("tweet-destacado-autor");
            if(tweetTexto) tweetTexto.textContent = "Sin posteos destacados en este turno.";
            if(tweetAutor) tweetAutor.textContent = "";
            
            actualizarSemaforo(null); 
            return false; 
        }

        const analisis = await resAnalisis.json();
        const crudo = await resCrudo.json();

        actualizarSemaforo(analisis.clima_general);

        if(cajaEjecutivo) cajaEjecutivo.textContent = analisis.resumen_ejecutivo || "Resumen ejecutivo no disponible.";
        
        if (analisis.analisis_profundo) {
            const textoSeguro = escaparHtml(analisis.analisis_profundo);
            const textoConParrafos = textoSeguro
                .split(/(?:\r?\n|\\n)+/) 
                .filter(parrafo => parrafo.trim() !== '') 
                .map(parrafo => `<p>${parrafo}</p>`) 
                .join('');
            if(cajaProfundo) cajaProfundo.innerHTML = textoConParrafos;
        } else {
            if(cajaProfundo) cajaProfundo.innerHTML = "Análisis profundo no disponible.";
        }

        if(temasLista) {
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
        }

        if (analisis.tweet_destacado) {
            const tText = document.getElementById("tweet-destacado-texto");
            const tAutor = document.getElementById("tweet-destacado-autor");
            if(tText) tText.textContent = `"${analisis.tweet_destacado.texto}"`;
            if(tAutor) tAutor.textContent = `- ${analisis.tweet_destacado.usuario}`;
        }

        if(grilla && gobernadoresBase) {
            gobernadoresBase.forEach(gob => {
                // CAMBIO 2: Buscador inteligente para arreglar el bug de Jorge Macri
                const analisisGob = analisis.analisis_por_gobernador.find(a => {
                    const strGob = String(a.gobernador).toLowerCase();
                    const handle = obtenerUsuarioSinArroba(gob.usuario_x).toLowerCase();
                    const prov = String(gob.provincia).toLowerCase();
                    return strGob.includes(handle) || strGob.includes(prov);
                });
                
                // Aseguramos leer bien los tuits crudos
                const crudoGob = crudo[gob.usuario_x] || crudo[obtenerUsuarioSinArroba(gob.usuario_x)] || [];

                let tarjeta = document.createElement("div");
                tarjeta.className = "tarjeta-gob";
                tarjeta.dataset.usuario = obtenerUsuarioSinArroba(gob.usuario_x).toLowerCase(); 

                tarjeta.innerHTML = `
                    <img alt="${gob.nombre}">
                    <h4>${gob.nombre}</h4>
                    <p>${gob.provincia}</p>
                `;
                const imagenGobernador = tarjeta.querySelector("img");
                aplicarAvatarConFallback(imagenGobernador, gob);

                tarjeta.addEventListener("click", () => abrirModal(gob, analisisGob, crudoGob));
                grilla.appendChild(tarjeta);
            });
        }

        return true; 

    } catch (error) {
        console.error("Error al cargar el tablero:", error);
        if(cajaEjecutivo) cajaEjecutivo.innerHTML = "Hubo un error al leer los archivos JSON.";
        if(cajaProfundo) cajaProfundo.innerHTML = "";
        return false;
    }
}

function abrirModal(gobernador, analisisGob, crudoGob) {
    const modal = document.getElementById("modal-detalle");
    const modalBio = document.getElementById("modal-bio");
    
    modalBio.innerHTML = `
        <img alt="${gobernador.nombre}">
        <div>
            <h2>${gobernador.nombre} (@${gobernador.usuario_x})</h2>
            <p><strong>${gobernador.provincia}</strong> | ${gobernador.partido || 'Gobernador'}</p>
            <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 10px;">${gobernador.bio || ''}</p>
        </div>
    `;
    const imagenModal = modalBio.querySelector("img");
    aplicarAvatarConFallback(imagenModal, gobernador);

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

    // CAMBIO 4: Activar los globitos de X al abrir el modal
    setTimeout(() => {
        if (window.twttr && window.twttr.widgets) {
            window.twttr.widgets.load();
        }
    }, 100);
}

function copiarTexto(idElemento, botonPresionado) {
    let texto = document.getElementById(idElemento).innerText;
    if (idElemento === 'tweet-destacado-texto') {
        const autor = document.getElementById('tweet-destacado-autor').innerText;
        texto = `"${texto}"\n${autor}`;
    } else {
        texto = `"${texto}"`;
    }
    texto += `\n\n📌 Vía El Radar Federal\n👉 radarfederal.ar`;
    const iconoOriginal = botonPresionado.innerHTML;
    navigator.clipboard.writeText(texto).then(() => {
        botonPresionado.innerHTML = "✅";
        botonPresionado.style.color = "#4ade80"; 
        botonPresionado.style.borderColor = "#4ade80";
        setTimeout(() => {
            botonPresionado.innerHTML = iconoOriginal;
            botonPresionado.style.color = ""; 
            botonPresionado.style.borderColor = "";
        }, 1500); 
    }).catch(err => console.error('Error al copiar: ', err));
}

function compartirWhatsApp(idElemento) {
    const texto = document.getElementById(idElemento).innerText;
    let mensaje = `📌 *Vía El Radar Federal:*\n\n"${texto}"`;
    if (idElemento === 'tweet-destacado-texto') {
         const autor = document.getElementById('tweet-destacado-autor').innerText;
         mensaje += `\n${autor}`;
    }
    mensaje += `\n\n👉 radarfederal.ar`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
}

function compartirX(idElemento) {
    const texto = document.getElementById(idElemento).innerText;
    let tweetTexto = `"${texto}"`;
    if (idElemento === 'tweet-destacado-texto') {
         const autor = document.getElementById('tweet-destacado-autor').innerText;
         tweetTexto += `\n${autor}`;
    }
    tweetTexto += `\n\n📊 Vía El Radar Federal\n👉 radarfederal.ar`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetTexto)}`, '_blank');
}

// CAMBIO 3: Motor del Semáforo actualizado con palabras de Grok
function actualizarSemaforo(estadoClima) {
    const semaforo = document.getElementById('semaforo-clima');
    if(!semaforo) return; 
    semaforo.classList.remove('gris', 'rojo', 'amarillo', 'verde');

    const estado = estadoClima ? estadoClima.toUpperCase() : "DESCONOCIDO";

    if (estado.includes("TENSO") || estado.includes("TENSION") || estado.includes("GUERRA") || estado.includes("NEGATIVO") || estado.includes("CONFLICTO")) {
        semaforo.classList.add('rojo');
        semaforo.title = "Clima Político: " + estado;
    } else if (estado.includes("NEUTRAL") || estado.includes("NEGOCIACION") || estado.includes("SILENCIO") || estado.includes("MODERADO") || estado.includes("AMBIVALENTE")) {
        semaforo.classList.add('amarillo');
        semaforo.title = "Clima Político: " + estado;
    } else if (estado.includes("POSITIVO") || estado.includes("ALIANZA") || estado.includes("COOPERATIVO") || estado.includes("ACUERDO")) {
        semaforo.classList.add('verde');
        semaforo.title = "Clima Político: " + estado;
    } else {
        semaforo.classList.add('gris'); 
        semaforo.title = "Clima Político: Sin datos";
    }
}

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

function sincronizarAlturas() {
    const sidebar = document.querySelector('.sidebar');
    const resumenCard = document.querySelector('.resumen-card');
    if (sidebar && resumenCard) {
        resumenCard.style.height = 'auto';
        if (window.innerWidth > 768) {
            const alturaDerecha = sidebar.offsetHeight;
            resumenCard.style.height = alturaDerecha + 'px';
        }
    }
}

function cambiarTurno() {
    const btn = document.getElementById("btn-turno");
    const fechaSeleccionada = document.getElementById("fecha-select").value;
    btn.classList.add("activo");
    setTimeout(() => btn.classList.remove("activo"), 300);
    if (turnoActual === "manana") {
        turnoActual = "noche";
        btn.innerHTML = "🌙 Turno Noche";
    } else {
        turnoActual = "manana";
        btn.innerHTML = "☀️ Turno Mañana";
    }
    cargarTablero(fechaSeleccionada);
}
