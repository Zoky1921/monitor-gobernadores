let gobernadoresBase = [];

// =========================================
// FUNCIÓN PARA OBTENER FECHA ARGENTINA
// =========================================
function obtenerFechaFormateada(diasRestados = 0) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasRestados);
    return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); 
}

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Web iniciada. Cargando base de gobernadores...");
    const inputFecha = document.getElementById("fecha-select");
    
    try {
        const res = await fetch("./gobernadores.json");
        if (!res.ok) throw new Error("No se pudo cargar gobernadores.json");
        gobernadoresBase = await res.json();
        console.log("Base de gobernadores cargada con éxito.");
        
        // Lógica de fecha inteligente
        let fechaIntento = obtenerFechaFormateada(0); 
        let cargaExitosa = await cargarTablero(fechaIntento);
        
        if (!cargaExitosa) {
            console.log("El informe de hoy aún no está listo. Cargando el de AYER...");
            fechaIntento = obtenerFechaFormateada(1);
            await cargarTablero(fechaIntento);
        }
        
        inputFecha.value = fechaIntento;

    } catch (error) {
        console.error("Error crítico al iniciar:", error);
        document.getElementById("resumen-ejecutivo").innerHTML = "Error al cargar la base de datos.";
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
        const resAnalisis = await fetch(`./data/${fecha}_analisis.json`);
        const resCrudo = await fetch(`./data/${fecha}_crudo.json`);

        if (!resAnalisis.ok || !resCrudo.ok) {
            console.warn(`Archivos no encontrados para la fecha ${fecha}`);
            cajaEjecutivo.innerHTML = `<b>No hay informes para el ${fecha}.</b>`;
            cajaProfundo.innerHTML = `El robot procesa datos todos los días a las 20:30 hs (Arg).`;
            temasLista.innerHTML = "<li>Sin datos</li>";
            return false; 
        }

        const analisis = await resAnalisis.json();
        const crudo = await resCrudo.json();

        // 1. DOBLE VELOCIDAD DE LECTURA
        cajaEjecutivo.textContent = analisis.resumen_ejecutivo || "Resumen ejecutivo no disponible.";
        
        if (analisis.analisis_profundo) {
            const textoConParrafos = analisis.analisis_profundo.replace(/\. /g, '.<br><br>');
            cajaProfundo.innerHTML = textoConParrafos;
        } else {
            cajaProfundo.innerHTML = "Análisis profundo no disponible.";
        }

        // 2. TENDENCIAS
        temasLista.innerHTML = "";
        if (analisis.temas_calientes) {
            analisis.temas_calientes.slice(0, 5).forEach(tema => {
                let li = document.createElement("li");
                li.textContent = tema;
                temasLista.appendChild(li);
            });
        }

        // 3. EL POST DEL DÍA
        if (analisis.tweet_destacado) {
            document.getElementById("tweet-destacado-texto").textContent = `"${analisis.tweet_destacado.texto}"`;
            document.getElementById("tweet-destacado-autor").textContent = `- ${analisis.tweet_destacado.usuario}`;
        }

        // 4. GRILLA DE GOBERNADORES
        gobernadoresBase.forEach(gob => {
            const analisisGob = analisis.analisis_por_gobernador.find(
                a => a.gobernador.toLowerCase().includes(gob.usuario_x.toLowerCase())
            );
            const crudoGob = crudo[gob.usuario_x] || [];

            let tarjeta = document.createElement("div");
            tarjeta.className = "tarjeta-gob";
            tarjeta.innerHTML = `
                <img src="${gob.foto_url}" alt="${gob.nombre}" onerror="this.src='https://via.placeholder.com/80'">
                <h4>${gob.nombre}</h4>
                <p>${gob.provincia}</p>
            `;
            // ACÁ ES DONDE LLAMA A LA FUNCIÓN QUE "NO EXISTÍA"
            tarjeta.addEventListener("click", () => abrirModal(gob, analisisGob, crudoGob));
            grilla.appendChild(tarjeta);
        });

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
// (Asegurate de que esto quede hasta el final del archivo)
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

    // Soporte para variables nuevas y viejas
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

// 1. Copiar al portapapeles
function copiarTexto(idElemento) {
    const texto = document.getElementById(idElemento).innerText;
    
    // API moderna del portapapeles
    navigator.clipboard.writeText(texto).then(() => {
        // Podés cambiar este alert por algo más lindo después si querés
        alert("¡Cita copiada al portapapeles!"); 
    }).catch(err => {
        console.error('Error al copiar: ', err);
    });
}

// 2. Compartir en WhatsApp
function compartirWhatsApp(idElemento) {
    const texto = document.getElementById(idElemento).innerText;
    // Armamos el mensaje sumándole la marca del proyecto
    const mensaje = `Mirá este textual en El Radar Federal:\n\n${texto}\n\n👉 radarfederal.com.ar`;
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// 3. Compartir en X (Twitter)
function compartirX(idElemento) {
    const texto = document.getElementById(idElemento).innerText;
    // Armamos el tweet. Ojo con el límite de caracteres (X corta en 280)
    let tweetTexto = `"${texto}"\n\n📊 Vía El Radar Federal`;
    
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetTexto)}`;
    window.open(url, '_blank');
}
/* =========================================
   MOTOR DEL SEMÁFORO DE CLIMA POLÍTICO
========================================= */
function actualizarSemaforo(estadoClima) {
    const semaforo = document.getElementById('semaforo-clima');
    
    // Primero, limpiamos cualquier color que tuviera antes
    semaforo.classList.remove('gris', 'rojo', 'amarillo', 'verde');

    // Leemos el estado que nos manda Python (lo pasamos a mayúsculas por las dudas)
    const estado = estadoClima ? estadoClima.toUpperCase() : "DESCONOCIDO";

    // Asignamos el color según el nivel de tensión
    if (estado === "TENSO" || estado === "NEGATIVO") {
        semaforo.classList.add('rojo');
        semaforo.title = "Clima Político: TENSO";
    } else if (estado === "NEUTRAL" || estado === "MODERADO") {
        semaforo.classList.add('amarillo');
        semaforo.title = "Clima Político: NEUTRAL / MODERADO";
    } else if (estado === "POSITIVO" || estado === "COOPERATIVO") {
        semaforo.classList.add('verde');
        semaforo.title = "Clima Político: POSITIVO / COOPERATIVO";
    } else {
        semaforo.classList.add('gris'); // Si no hay dato, queda apagado
        semaforo.title = "Clima Político: Sin datos";
    }
}
