// Variable global para almacenar la base de gobernadores
let gobernadoresBase = [];

// Cuando la página carga, ejecutamos esto
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Poner el calendario en la fecha de hoy
    const inputFecha = document.getElementById("fecha-select");
    const fechaHoy = new Date().toISOString().split('T')[0];
    inputFecha.value = fechaHoy;

    // 2. Cargar la base de gobernadores con las fotos y biografías
    try {
        const res = await fetch("gobernadores.json");
        gobernadoresBase = await res.json();
    } catch (error) {
        console.error("Error al cargar la base de gobernadores:", error);
    }

    // 3. Cargar los datos del día seleccionado
    cargarTablero(fechaHoy);

    // 4. Si el usuario cambia la fecha, recargamos el tablero
    inputFecha.addEventListener("change", (e) => {
        cargarTablero(e.target.value);
    });

    // 5. Configurar el botón de cerrar de la ventana emergente (Modal)
    document.querySelector(".close-btn").addEventListener("click", () => {
        document.getElementById("modal-detalle").classList.add("oculta");
    });
});

// Función principal que va a buscar los JSON del robot
async function cargarTablero(fecha) {
    const resumenGral = document.getElementById("resumen-general");
    const temasLista = document.getElementById("temas-lista");
    const grilla = document.getElementById("grilla-gobernadores");

    resumenGral.innerHTML = "<i>Buscando archivos en el servidor...</i>";
    grilla.innerHTML = "";
    temasLista.innerHTML = "<li>Cargando...</li>";

    try {
        // Vamos a buscar los dos archivos del día
        const resAnalisis = await fetch(`data/${fecha}_analisis.json`);
        const resCrudo = await fetch(`data/${fecha}_crudo.json`);

        // Si el archivo no existe (error 404), tiramos alerta
        if (!resAnalisis.ok || !resCrudo.ok) {
            resumenGral.innerHTML = `<b>No hay informes para el ${fecha}.</b><br>Recordá que el robot procesa la información a las 23:30 hs.`;
            temasLista.innerHTML = "<li>Sin datos</li>";
            alert(`No se encontraron archivos del día ${fecha}.`);
            return;
        }

        // Si existen, los convertimos a variables legibles
        const analisis = await resAnalisis.json();
        const crudo = await resCrudo.json();

        // --- LLENAMOS LA SECCIÓN MACRO ---
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

        // --- LLENAMOS LA SECCIÓN MICRO (La Grilla) ---
