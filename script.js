let gobernadoresBase = [];

// =========================================
// FUNCIÓN PARA OBTENER FECHA ARGENTINA
// =========================================
function obtenerFechaFormateada(diasRestados = 0) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasRestados);
    // Forzamos el uso horario de Buenos Aires para evitar saltos raros
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
        
        // --- LÓGICA DE FECHA INTELIGENTE ---
        let fechaIntento = obtenerFechaFormateada(0); // Intentamos con HOY
        let cargaExitosa = await cargarTablero(fechaIntento);
        
        if (!cargaExitosa) {
            console.log("El informe de hoy aún no está listo. Cargando el de AYER...");
            fechaIntento = obtenerFechaFormateada(1); // Intentamos con AYER
            await cargarTablero(fechaIntento);
        }
        
        // Fijamos el calendario en la fecha que finalmente se mostró en pantalla
        inputFecha.value = fechaIntento;

    } catch (error) {
        console.error("Error crítico al iniciar:", error);
        document.getElementById("resumen-ejecutivo").innerHTML = "Error al cargar la base de datos.";
    }

    // Si el usuario cambia la fecha a mano en el calendario
    inputFecha.addEventListener("change", (e) => cargarTablero(e.target.value));
    
    // Cerrar la ventana flotante
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

    // Mensajes de carga
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
            return false; // Retorna false para que el sistema intente con el día anterior
        }

        const analisis = await resAnalisis.json();
        const crudo = await resCrudo.json();

        // 1. DOBLE VELOCIDAD DE LECTURA
        cajaEjecutivo.textContent = analisis.resumen_ejecutivo || "Resumen ejecutivo no disponible.";
        
        if (analisis.analisis_profundo) {
            // Reemplazamos los puntos seguidos por saltos de línea para que respire
            const textoConParrafos = analisis.analisis_profundo.replace(/\. /g, '.<br><br>');
            cajaProfundo.innerHTML = textoConParrafos;
        } else {
            cajaProfundo.innerHTML = "Análisis profundo no disponible.";
        }

        // 2. TENDENCIAS (Top 5)
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
            tarjeta.addEventListener("click", () => abrirModal(gob, analisisGob, crudoGob));
            grilla.appendChild(tarjeta);
        });

        return true; // Todo salió bien

    } catch (error) {
        console.error
