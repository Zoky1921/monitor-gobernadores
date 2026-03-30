let gobernadoresBase = [];

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Web iniciada. Cargando base de gobernadores...");
    const inputFecha = document.getElementById("fecha-select");
    
    // Forzamos la fecha de hoy (formato YYYY-MM-DD)
    const hoy = new Date();
    const fechaHoy = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    inputFecha.value = fechaHoy;

    try {
        // Usamos ./ para asegurar que busque en la misma carpeta
        const res = await fetch("./gobernadores.json");
        if (!res.ok) throw new Error("No se pudo cargar gobernadores.json");
        gobernadoresBase = await res.json();
        console.log("Base de gobernadores cargada con éxito.");
        
        // Cargamos el tablero
        cargarTablero(fechaHoy);
    } catch (error) {
        console.error("Error crítico al iniciar:", error);
        document.getElementById("resumen-general").innerHTML = "Error al cargar la base de datos de gobernadores.";
    }

    inputFecha.addEventListener("change", (e) => cargarTablero(e.target.value));
    document.querySelector(".close-btn").addEventListener("click", () => {
        document.getElementById("modal-detalle").classList.add("oculta");
    });
});

async function cargarTablero(fecha) {
    console.log(`Intentando cargar datos para la fecha: ${fecha}`);
    const resumenGral = document.getElementById("resumen-general");
    const temasLista = document.getElementById("temas-lista");
    const grilla = document.getElementById("grilla-gobernadores");

    resumenGral.innerHTML = "<i>Buscando archivos del día...</i>";
    grilla.innerHTML = "";
    temasLista.innerHTML = "<li>Cargando...</li>";

    try {
        const resAnalisis = await fetch(`./data/${fecha}_analisis.json`);
        const resCrudo = await fetch(`./data/${fecha}_crudo.json`);

        if (!resAnalisis.ok || !resCrudo.ok) {
            console.warn(`Archivos no encontrados para la fecha ${fecha}`);
            resumenGral.innerHTML = `<b>No hay informes para el ${fecha}.</b><br>El robot procesa datos a las 20:30 hs (Arg).`;
            temasLista.innerHTML = "<li>Sin datos</li>";
            return;
        }

        const analisis = await resAnalisis.json();
        const crudo = await resCrudo.json();

        resumenGral.textContent = analisis.resumen_general;

        // Temas calientes
        temasLista.innerHTML = "";
        analisis.temas_calientes.forEach(tema => {
            let li = document.createElement("li");
            li.textContent = tema;
            temasLista.appendChild(li);
        });

        // Tweet Destacado
        if (analisis.tweet_destacado) {
            document.getElementById("tweet-destacado-texto").textContent = `"${analisis.tweet_destacado.texto}"`;
            document.getElementById("tweet-destacado-autor").textContent = `- ${analisis.tweet_destacado.usuario}`;
        }

        // Grilla de Gobernadores
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

    } catch (error) {
        console.error("Error al cargar el tablero:", error);
        resumenGral.innerHTML = "Hubo un error al leer los archivos JSON. Puede que el formato sea incorrecto.";
    }
}

function abrirModal(gobernador, analisisGob, crudoGob) {
    const modal = document.getElementById("modal-detalle");
    document.getElementById("modal-bio").innerHTML = `
        <img src="${gobernador.foto_url}" alt="${gobernador.nombre}" onerror="this.src='https://via.placeholder.com/100'">
        <div>
            <h2>${gobernador.nombre} (@${gobernador.usuario_x})</h2>
            <p><strong>${gobernador.provincia}</strong> | ${gobernador.partido}</p>
            <p style="font-size: 0.85rem; color: #666;">${gobernador.bio}</p>
        </div>
    `;

    document.getElementById("modal-analisis").textContent = analisisGob ? analisisGob.analisis : "Sin análisis disponible.";
    document.getElementById("modal-cita-textual").textContent = analisisGob ? (analisisGob.cita_textual_relevante || "-") : "-";

    const divCrudo = document.getElementById("modal-tweets-crudos");
    divCrudo.innerHTML = "";
    if (crudoGob.length > 0) {
        crudoGob.forEach(tweet => {
            let div = document.createElement("div");
            div.className = "tweet-item";
            div.innerHTML = tweet;
            divCrudo.appendChild(div);
        });
    } else {
        divCrudo.innerHTML = "<p>No hay tweets registrados.</p>";
    }
    modal.classList.remove("oculta");
}
