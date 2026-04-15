# 📡 El Radar Federal

Una plataforma de análisis estratégico que utiliza Inteligencia Artificial (Google Gemini) para monitorear, sistematizar y analizar el discurso público de los 24 gobernadores argentinos.

## Características

* **Análisis Ejecutivo con IA:** Generación de resúmenes diarios (versiones "Rápida" y "Extensa") que sintetizan la postura política detectada por modelos LLM.
* **Semáforo de Clima Político:** Indicador visual que mide la tensión o cooperación federal mediante análisis de sentimiento.
* **Efecto Terono (Filtros Interactivos):** Motor que permite filtrar la grilla de gobernadores según las tendencias del día, resaltándolos en la grilla.
* **Layout adaptable con scroll interno:** El panel de análisis mantiene altura natural y agrega scroll interno para textos extensos sin recortes.
* **Compartibilidad Integrada:** Botones para exportar citas a WhatsApp y X (Twitter) con atribución de autoría automática.

## Instalación

1. **Cloná el repositorio:**
   ```bash
   git clone [https://github.com/zoky1921/radar-federal.git](https://github.com/tu-usuario/radar-federal.git)
   cd radar-federal
   ```

2. **Configuración del Robot (Python):**
   * Instalá las dependencias necesarias:
     ```bash
     pip install google-generativeai requests
     ```
   * Configurá tu `GEMINI_API_KEY` en las variables de entorno.

3. **Visualización:**
   * Abrí `index.html` mediante un servidor local (ej: Live Server en VS Code) para permitir la carga de archivos JSON locales sin errores de seguridad.

## Arquitectura

### Estructura de Componentes
* **`index.html`**: Estructura del dashboard con secciones para clima político, tendencias y grilla.
* **`script.js`**: Control de carga asíncrona y motor de filtrado "Terono".
* **`style.css`**: Sistema de diseño basado en variables de modo oscuro y Flexbox dinámico.

### Pipeline de Datos
El sistema utiliza un "Robot" en Python (`main.py`) que genera archivos diarios en la carpeta `data/`:
* **`YYYY-MM-DD_analisis.json`**: Análisis detallado, tendencias y clima general.
* **`YYYY-MM-DD_crudo.json`**: Historial de tweets procesados en la jornada.

## Tecnologías

* **Google Gemini API**: Motor de inteligencia artificial para procesamiento de lenguaje natural.
* **Python**: Automatización de la extracción y procesamiento de datos.
* **Vanilla JavaScript (ES6+)**: Gestión de la interactividad y manipulación del DOM.
* **CSS3 Custom Properties**: Estilizado dinámico y adaptativo.

## Notas sobre el Proyecto

* **Origen de Datos**: Extracción mediante técnicas de scraping sobre las cuentas oficiales de los mandatarios provinciales de Argentina.
* **Propósito**: Herramienta de transparencia institucional y análisis de políticas públicas.

## Autor

**X**:
* Politólogo.
* U.

## Licencia

Este proyecto está bajo la Licencia MIT.
