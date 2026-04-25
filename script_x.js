let gobernadoresBase = [];
let turnoActual = "manana";

const AVATAR_PLACEHOLDER_LOCAL = "./assets/img/avatar-placeholder.svg";
const UNAVATAR_TWITTER_BASE = "https://unavatar.io/twitter/";
const UNAVATAR_X_BASE = "https://unavatar.io/x/";

function obtenerUsuarioSinArroba(usuarioX = "") {
  return String(usuarioX || "").replace(/^@/, "").trim();
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
  return [...new Set(fuentes.filter(Boolean))];
}

function escaparHtml(texto = "") {
  return String(texto)
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
    img.src = fuentes[proximoIndex];
  };

  img.src = fuentes[0];
}

function obtenerFechaFormateada(diasRestados = 0) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - diasRestados);
  return fecha.toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function markdownBasicoAHtml(texto = "") {
  const textoSeguro = String(texto || "").trim();
  if (!textoSeguro) return "";

  return textoSeguro
    .split(/(?:\r?\n|\\n){2,}/)
    .map(parrafo => `<p>${escaparHtml(parrafo).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`)
    .join("");
}

function normalizarArray(valor) {
  return Array.isArray(valor) ? valor : [];
}

async function fetchJSONSeguro(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  return res.json();
}

/* --- PARCHE 1: RUTAS CORRECTAS --- */
function obtenerRutasDatos(fecha) {
  return {
    analisis: `./data/${fecha}_analisis_subtrama_${turnoActual}.json`,
    crudo: `./data/${fecha}_crudo_${turnoActual}.json`
  };
}

function buscarAnalisisGobernador(analisisPorGobernador, gob) {
  const items = normalizarArray(analisisPorGobernador);
  const usuario = obtenerUsuarioSinArroba(gob.usuario_x || "").toLowerCase();
  const provincia = String(gob.provincia || "").toLowerCase();

  return items.find(item => {
    const gobernador = String(item?.gobernador || "").toLowerCase();
    return gobernador.includes(usuario) || (provincia && gobernador.includes(provincia));
  }) || null;
}

function obtenerTweetsCrudos(crudo, gob) {
  if (!crudo || typeof crudo !== "object") return [];
  const claves = [gob.usuario_x, obtenerUsuarioSinArroba(gob.usuario_x), `@${obtenerUsuarioSinArroba(gob.usuario_x)}`].filter(Boolean);
  for (const clave of claves) {
    if (Array.isArray(crudo[clave])) return crudo[clave];
  }
  return [];
}

function renderEstadoInicial() {
  const cajaEjecutivo = document.getElementById("resumen-ejecutivo");
  const cajaProfundo = document.getElementById("analisis-profundo");
  const temasLista = document.getElementById("temas-lista");
  const grilla = document.getElementById("grilla-gobernadores");

  if (cajaEjecutivo) cajaEjecutivo.innerHTML = "Buscando resumen ejecutivo...";
  if (cajaProfundo) cajaProfundo.innerHTML = "Buscando análisis profundo...";
  if (grilla) grilla.innerHTML = "";
  if (temasLista) temasLista.innerHTML = "<li>A la espera del procesamiento...</li>";
}

function renderTweetDestacado(tweetDestacado) {
  const tText = document.getElementById("tweet-destacado-texto");
  const tAutor = document.getElementById("tweet-destacado-autor");

  if (!tText || !tAutor) return;

  if (tweetDestacado?.texto) {
    tText.textContent = `“${tweetDestacado.texto}”`;
    tAutor.textContent = tweetDestacado.usuario ? `- ${tweetDestacado.usuario}` : "";
  } else {
    tText.textContent = "Sin post destacado para este turno.";
    tAutor.textContent = "";
  }
}

function renderTemas(temas) {
  const temasLista = document.getElementById("temas-lista");
  if (!temasLista) return;

  temasLista.innerHTML = "";
  const items = normalizarArray(temas);

  if (!items.length) {
    temasLista.innerHTML = "<li>Sin temas destacados para esta fecha.</li>";
    return;
  }

  items.slice(0, 5).forEach(temaItem => {
    const li = document.createElement("li");

    if (typeof temaItem === "string") {
      li.textContent = temaItem;
    } else {
      const tema = temaItem?.tema || "Tema sin nombre";
      const involucrados = normalizarArray(temaItem?.gobernadores_involucrados);
      li.textContent = `${tema} · ${involucrados.length} gobs`;
      li.style.cursor = involucrados.length ? "pointer" : "default";
      li.title = involucrados.length ? "Clic para ver quiénes hablaron de esto" : "";
      if (involucrados.length) {
        li.onclick = () => aplicarFiltroTerono(involucrados);
      }
    }

    temasLista.appendChild(li);
  });
}

function renderGrilla(analisis, crudo) {
  const grilla = document.getElementById("grilla-gobernadores");
  if (!grilla) return;

  grilla.innerHTML = "";
  const analisisPorGobernador = normalizarArray(analisis?.analisis_por_gobernador);

  gobernadoresBase.forEach(gob => {
    const analisisGob = buscarAnalisisGobernador(analisisPorGobernador, gob);
    const crudoGob = obtenerTweetsCrudos(crudo, gob);

    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-gob";
    tarjeta.dataset.usuario = obtenerUsuarioSinArroba(gob.usuario_x).toLowerCase();

    const resumen = analisisGob?.resumen || analisisGob?.postura_politica || gob.cargo || "Sin resumen para esta fecha.";

    tarjeta.innerHTML = `
      <div class="tarjeta-gob-header">
        <img alt="${escaparHtml(gob.provincia || "Gobernador")}" class="tarjeta-gob-avatar">
        <div>
          <h4>${escaparHtml(gob.provincia || "Provincia")}</h4>
          <p>${escaparHtml(gob.usuario_x || "")}</p>
        </div>
      </div>
      <div class="tarjeta-gob-body">
        <p>${escaparHtml(resumen)}</p>
      </div>
    `;

    const imagenGobernador = tarjeta.querySelector("img");
    aplicarAvatarConFallback(imagenGobernador, gob);
    tarjeta.addEventListener("click", () => abrirModal(gob, analisisGob, crudoGob));
    grilla.appendChild(tarjeta);
  });
}

async function cargarTablero(fecha) {
  console.log(`Intentando cargar datos para la fecha: ${fecha} (${turnoActual})`);
  renderEstadoInicial();

  const cajaEjecutivo = document.getElementById("resumen-ejecutivo");
  const cajaProfundo = document.getElementById("analisis-profundo");

  try {
    const rutas = obtenerRutasDatos(fecha);
    const [analisis, crudo] = await Promise.all([
      fetchJSONSeguro(rutas.analisis),
      fetchJSONSeguro(rutas.crudo).catch(() => ({}))
    ]);

    if (cajaEjecutivo) {
      cajaEjecutivo.innerHTML = markdownBasicoAHtml(
        analisis?.resumen_ejecutivo || analisis?.resumen || "Resumen ejecutivo no disponible."
      );
    }

    if (cajaProfundo) {
      cajaProfundo.innerHTML = markdownBasicoAHtml(
        analisis?.analisis_profundo || analisis?.analisis || "Análisis profundo no disponible."
      );
    }

    actualizarSemaforo(analisis?.clima_general || analisis?.clima_politico || analisis?.estado_clima || "DESCONOCIDO");
    renderTemas(analisis?.temas_calientes);
    renderTweetDestacado(analisis?.tweet_destacado);
    renderGrilla(analisis, crudo);
    sincronizarAlturas();
    return true;
  } catch (error) {
    console.error("Error al cargar el tablero:", error);
    if (cajaEjecutivo) cajaEjecutivo.innerHTML = `Error al leer archivos JSON para ${fecha} (${turnoActual}).`;
    if (cajaProfundo) cajaProfundo.innerHTML = "";
    return false;
  }
}

/* --- PARCHE 2: HTML PURO PARA LOS TWEETS --- */
function abrirModal(gobernador, analisisGob, crudoGob) {
  const modal = document.getElementById("modal-detalle");
  const modalBio = document.getElementById("modal-bio");
  const modalTitulo = document.getElementById("modal-titulo");
  const modalContenido = document.getElementById("modal-contenido");

  if (!modal) return;

  if (modalTitulo) {
    modalTitulo.textContent = `${gobernador.provincia || "Provincia"} ${gobernador.usuario_x ? `· ${gobernador.usuario_x}` : ""}`;
  }

  if (modalBio) {
    modalBio.innerHTML = `
      <p><strong>${escaparHtml(gobernador.provincia || "")}</strong> | ${escaparHtml(gobernador.partido || "Gobernador")}</p>
      <p>${escaparHtml(gobernador.bio || "")}</p>
    `;
  }

  if (modalContenido) {
    const resumen = analisisGob?.resumen || analisisGob?.postura_politica || analisisGob?.sintesis || "Sin análisis individual disponible.";
    const tweets = normalizarArray(crudoGob);

    modalContenido.innerHTML = `
      <div class="modal-analisis">
        <p>${escaparHtml(resumen)}</p>
      </div>
      <div class="modal-tweets">
        ${tweets.length ? tweets.map(t => `<div class="tweet-item">${t}</div>`).join("") : "<p style='color: #94a3b8; font-style: italic;'>No hay tweets para mostrar en esta fecha.</p>"}
      </div>
    `;
  }

  modal.classList.remove("oculta");
}

function copiarTexto(idElemento, botonPresionado) {
  const nodo = document.getElementById(idElemento);
  if (!nodo) return;

  let texto = nodo.innerText || "";
  if (idElemento === "tweet-destacado-texto") {
    const autor = document.getElementById("tweet-destacado-autor")?.innerText || "";
    texto = `${texto}\n${autor}`.trim();
  }

  texto += "\n\n📌 Vía El Radar Federal\n👉 radarfederal.ar";
  const iconoOriginal = botonPresionado?.innerHTML;

  navigator.clipboard.writeText(texto).then(() => {
    if (!botonPresionado) return;
    botonPresionado.innerHTML = "✅";
    botonPresionado.style.color = "#4ade80";
    botonPresionado.style.borderColor = "#4ade80";
    setTimeout(() => {
      botonPresionado.innerHTML = iconoOriginal;
      botonPresionado.style.color = "";
      botonPresionado.style.borderColor = "";
    }, 1500);
  }).catch(err => console.error("Error al copiar:", err));
}

function compartirWhatsApp(idElemento) {
  const nodo = document.getElementById(idElemento);
  if (!nodo) return;

  const texto = nodo.innerText || "";
  const autor = idElemento === "tweet-destacado-texto"
    ? (document.getElementById("tweet-destacado-autor")?.innerText || "")
    : "";

  let mensaje = `📌 *Vía El Radar Federal:*\n\n${texto}`;
  if (autor) mensaje += `\n${autor}`;
  mensaje += "\n\n👉 radarfederal.ar";
  window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank");
}

function compartirX(idElemento) {
  const nodo = document.getElementById(idElemento);
  if (!nodo) return;

  const texto = nodo.innerText || "";
  const autor = idElemento === "tweet-destacado-texto"
    ? (document.getElementById("tweet-destacado-autor")?.innerText || "")
    : "";

  let tweetTexto = `${texto}`;
  if (autor) tweetTexto += `\n${autor}`;
  tweetTexto += "\n\n📊 Vía El Radar Federal\n👉 radarfederal.ar";
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetTexto)}`, "_blank");
}

/* --- MOTOR DE SEMÁFOROS CORREGIDO --- */
function actualizarSemaforo(estadoClima) {
  const semaforo = document.getElementById("semaforo-clima");
  if (!semaforo) return;

  semaforo.classList.remove("gris", "rojo", "amarillo", "verde");
  const estado = estadoClima ? String(estadoClima).toUpperCase() : "DESCONOCIDO";

  if (
    estado.includes("TENSO") ||
    estado.includes("TENSION") ||
    estado.includes("GUERRA") ||
    estado.includes("NEGATIVO") ||
    estado.includes("CONFLICTO")
  ) {
    semaforo.classList.add("rojo");
    semaforo.title = "Clima Político: " + estado;
  } else if (
    estado.includes("NEUTRAL") ||
    estado.includes("NEGOCIACION") ||
    estado.includes("SILENCIO") ||
    estado.includes("MODERADO") ||
    estado.includes("AMBIVALENTE")
  ) {
    semaforo.classList.add("amarillo");
    semaforo.title = "Clima Político: " + estado;
  } else if (
    estado.includes("POSITIVO") ||
    estado.includes("ALIANZA") ||
    estado.includes("COOPERATIVO") ||
    estado.includes("ACUERDO")
  ) {
    semaforo.classList.add("verde");
    semaforo.title = "Clima Político: " + estado;
  } else {
    semaforo.classList.add("gris");
    semaforo.title = "Clima Político: Sin datos";
  }
}

function filtrarGobernadores() {
  const input = document.getElementById("buscador-gobernadores");
  const textoBusqueda = (input?.value || "").toLowerCase();
  const tarjetas = document.querySelectorAll(".tarjeta-gob");

  tarjetas.forEach(tarjeta => {
    const contenidoTarjeta = (tarjeta.innerText || "").toLowerCase();
    tarjeta.style.display = contenidoTarjeta.includes(textoBusqueda) ? "" : "none";
  });
}

function aplicarFiltroTerono(gobernadoresInvolucrados = []) {
  const tarjetas = document.querySelectorAll(".tarjeta-gob");
  const involucradosLimpios = gobernadoresInvolucrados.map(g => String(g).toLowerCase().replace("@", ""));
  let hayResultados = false;

  tarjetas.forEach(tarjeta => {
    const usuarioTarjeta = tarjeta.dataset.usuario;
    if (involucradosLimpios.includes(usuarioTarjeta)) {
      tarjeta.style.display = "";
      tarjeta.style.borderColor = "#3b82f6";
      hayResultados = true;
    } else {
      tarjeta.style.display = "none";
      tarjeta.style.borderColor = "#334155";
    }
  });

  if (hayResultados) {
    document.getElementById("seccion-mapa")?.scrollIntoView({ behavior: "smooth" });
    let btnVolver = document.getElementById("btn-rescate-terono");

    if (!btnVolver) {
      btnVolver = document.createElement("button");
      btnVolver.id = "btn-rescate-terono";
      btnVolver.innerHTML = "⬆️ Limpiar y volver";
      btnVolver.className = "btn-rescate";
      btnVolver.onclick = () => {
        limpiarFiltrosTerono();
        document.querySelector(".dashboard-macro")?.scrollIntoView({ behavior: "smooth" });
      };
      document.querySelector(".controles-grilla")?.appendChild(btnVolver);
    }

    btnVolver.style.display = "inline-block";
  }
}

function limpiarFiltrosTerono() {
  const tarjetas = document.querySelectorAll(".tarjeta-gob");
  tarjetas.forEach(tarjeta => {
    tarjeta.style.display = "";
    tarjeta.style.borderColor = "#334155";
  });

  const buscador = document.getElementById("buscador-gobernadores");
  if (buscador) buscador.value = "";

  const btnVolver = document.getElementById("btn-rescate-terono");
  if (btnVolver) btnVolver.style.display = "none";
}

function sincronizarAlturas() {
  const sidebar = document.querySelector(".sidebar");
  const resumenCard = document.querySelector(".resumen-card");
  if (sidebar && resumenCard) {
    resumenCard.style.height = "auto";
    if (window.innerWidth > 768) {
      resumenCard.style.height = `${sidebar.offsetHeight}px`;
    }
  }
}

function cambiarTurno() {
  const btn = document.getElementById("btn-turno");
  const fechaSeleccionada = document.getElementById("fecha-select")?.value || obtenerFechaFormateada(0);
  if (btn) {
    btn.classList.add("activo");
    setTimeout(() => btn.classList.remove("activo"), 300);
  }

  if (turnoActual === "manana") {
    turnoActual = "noche";
    if (btn) btn.innerHTML = "🌙 Turno Noche";
  } else {
    turnoActual = "manana";
    if (btn) btn.innerHTML = "☀️ Turno Mañana";
  }

  cargarTablero(fechaSeleccionada);
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Web iniciada. Cargando base de gobernadores...");

  const inputFecha = document.getElementById("fecha-select");
  const btnTurno = document.getElementById("btn-turno");
  const closeBtn = document.querySelector(".close-btn");

  const ahoraArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const horaArg = ahoraArg.getHours();

  turnoActual = horaArg >= 20 ? "noche" : "manana";
  if (btnTurno) btnTurno.innerHTML = turnoActual === "noche" ? "🌙 Turno Noche" : "☀️ Turno Mañana";

  inputFecha?.addEventListener("change", e => cargarTablero(e.target.value));
  closeBtn?.addEventListener("click", () => {
    document.getElementById("modal-detalle")?.classList.add("oculta");
  });

  try {
    const res = await fetch("./gobernadores.json", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar gobernadores.json");
    gobernadoresBase = await res.json();

    const fechaHoy = obtenerFechaFormateada(0);
    if (inputFecha) inputFecha.value = fechaHoy;
    await cargarTablero(fechaHoy);
  } catch (error) {
    console.error("Error crítico al iniciar:", error);
    const cajaEj = document.getElementById("resumen-ejecutivo");
    const cajaProf = document.getElementById("analisis-profundo");
    if (cajaEj) cajaEj.innerHTML = "Error al cargar la base de datos.";
    if (cajaProf) cajaProf.innerHTML = "Revisá que exista gobernadores.json y que las rutas de datos sean correctas.";
  }

  window.addEventListener("resize", sincronizarAlturas);
});
