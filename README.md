# 📡 El Radar Federal

Una plataforma de análisis estratégico que utiliza Inteligencia Artificial (Google Gemini) para monitorear, sistematizar y analizar el discurso público de los 24 gobernadores argentinos.

## Características

* **Análisis Ejecutivo con IA:** Resúmenes diarios generados por modelos de lenguaje avanzado que sintetizan la postura política del día en versiones "Rápida" (ejecutiva) y "Extensa" (profunda).
* **Semáforo de Clima Político:** Indicador visual dinámico que mide el nivel de tensión, neutralidad o cooperación en el discurso federal mediante análisis de sentimiento.
* **Efecto Terono (Filtros Interactivos):** Motor de filtrado que permite seleccionar tendencias "calientes" y visualizar instantáneamente qué gobernadores están impulsando ese tema, resaltándolos en la grilla.
* **Compartibilidad:** Funciones integradas para exportar citas destacadas a WhatsApp y X (Twitter) incluyendo automáticamente la autoría y el enlace al monitor.

## Instalación

1. **Cloná el repositorio:**
   ```bash
   git clone [https://github.com/tu-usuario/radar-federal.git](https://github.com/tu-usuario/radar-federal.git)
   cd radar-federal
   Configuración del Robot (Python):

Instalá las dependencias: pip install google-generativeai requests.

Configurá tu GEMINI_API_KEY en las variables de entorno.

Visualización:

No requiere compilación. Abrí index.html con cualquier servidor local (ej: Live Server en VS Code) para evitar problemas de CORS al cargar los JSON.

Arquitectura
Estructura de Componentes
index.html: Estructura semántica del dashboard. Incluye el contenedor del clima político, la barra lateral de tendencias y la grilla interactiva.

script.js: Maneja la lógica de carga asíncrona de datos, el motor de filtrado del "Efecto Terono" y el sincronizador de alturas entre columnas.

style.css: Diseño basado en variables de modo oscuro (CSS Variables). Implementa un sistema de Grid y Flexbox elástico para garantizar la simetría visual.

Carga de Datos
El sistema opera de forma estática en runtime para maximizar la velocidad. El "Robot" (main.py) genera dos archivos por día en la carpeta data/:

YYYY-MM-DD_analisis.json: Contiene el resumen ejecutivo, extenso, tendencias y análisis por gobernador.

YYYY-MM-DD_crudo.json: Contiene el archivo histórico de tweets procesados en esa jornada.

Formato de Datos
clima_general: String ("Tenso", "Cooperativo", etc.) que activa el semáforo.

temas_calientes: Objetos con el tema y el array de @usuarios involucrados para el filtrado dinámico.

tweet_destacado: Objeto con la cita del día y el autor para la sección de impacto.

Tecnologías
Google Gemini API: Procesamiento de lenguaje natural y generación de análisis.

Python: Automatización del robot de scraping y procesamiento de datos.

Vanilla JavaScript (ES6+): Lógica de interfaz y manipulación del DOM.

CSS3 Custom Properties: Gestión de temas y estilos dinámicos.

HTML5: Estructura del dashboard con enfoque en accesibilidad.

Notas sobre el Proyecto
Origen de datos: Extracción mediante técnicas de scraping sobre cuentas oficiales de los 24 mandatarios provinciales.

Enfoque: Diseñado como un insumo para la transparencia institucional y el análisis de políticas públicas.

Autor
X

Licencia
Este proyecto está bajo la Licencia MIT.
