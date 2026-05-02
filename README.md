# 📡 El Radar Federal

**Plataforma de Inteligencia Política y Análisis Discursivo de la Argentina Federal.**

El Radar Federal es un sistema de monitoreo estratégico que procesa, sistematiza y disecciona el discurso público de los 24 gobernadores argentinos en tiempo real. Utiliza una arquitectura de **Pipeline Dual** para separar la gestión institucional de la "subtrama" del poder[cite: 1].

## 🚀 Características Principales

*   **Análisis de Doble Vía:**
    *   **Camino Institucional (Gemini 2.5 Flash):** Resumen ejecutivo y técnico de medidas de gestión, obras y anuncios oficiales[cite: 1].
    *   **Camino de Subtrama (Grok 4.1 Fast):** Análisis descarnado con "Estilo Pagni" sobre tensiones fiscales, diplomacia de la caja y posicionamientos simbólicos[cite: 1].
*   **🔍 Francotirador OpenArg:** Integración con la API de OpenArg para la verificación fáctica de datos económicos y sociales mencionados en los posteos destacados[cite: 1].
*   **🚥 Semáforo de Clima Político:** Indicador de tensión federal (Nación vs. Provincias) basado en análisis de sentimiento de la jornada[cite: 1].
*   **🎯 Efecto Terono:** Motor de filtrado interactivo que resalta tendencias y agrupa mandatarios según la agenda del día.
*   **🛠️ Blindaje Anti-Alucinación:** Sistema de validación de esquemas JSON con reintentos automáticos, backoff incremental y logs de auditoría raw[cite: 1].

## 🛠️ Stack Tecnológico

*   **Motores de IA:** Google Gemini 2.5 Flash, xAI Grok 4.1 (vía OpenRouter) y DeepSeek V3/R1[cite: 1].
*   **Backend:** Python 3.11+ con `google-genai` y `json_repair`[cite: 1].
*   **Base de Datos:** SQLite para el logueo de consumo de tokens y auditoría de costos[cite: 1].
*   **Frontend:** Vanilla JS (ES6+), CSS3 con variables dinámicas y HTML5.
*   **Automatización:** Integrado con GitHub Actions para ejecuciones programadas (Mañana/Noche).

## 📋 Requisitos e Instalación

1.  **Clonado de Repositorio:**
    ```bash
    git clone [https://github.com/zoky1921/monitor-gobernadores.git](https://github.com/zoky1921/monitor-gobernadores.git)
    cd monitor-gobernadores
    ```

2.  **Configuración del Entorno:**
    Instalar dependencias[cite: 1]:
    ```bash
    pip install google-genai requests json_repair
    ```

3.  **Variables de Entorno (Secrets):**
    Es necesario configurar las siguientes keys[cite: 1]:
    *   `TWITTERAPI_KEY`: Extracción de datos de X.
    *   `GEMINI_API_KEY`: Motor institucional.
    *   `OPENROUTER_API_KEY`: Acceso a Grok y modelos de backup.
    *   `OPENARG_API_KEY`: Verificación de datos.

## 🏗️ Arquitectura de Datos

El sistema opera mediante un proceso de **Hardening Estructural**[cite: 1]:
1.  **Extracción:** Recolección de tweets mediante TwitterAPI.io con persistencia en `json` crudo[cite: 1].
2.  **Validación:** La función `_parsear_y_validar_resumen()` garantiza que la IA entregue objetos JSON íntegros y tipados[cite: 1].
3.  **Auditoría:** Fallos de formato son almacenados en archivos `.txt` individuales para mejora del prompt[cite: 1].
4.  **Despliegue:** Generación de archivos `analisis_manana.json` y `analisis_noche.json` para consumo del dashboard[cite: 1].

## ✍️ Autor

**Politólogo** 
*   Licenciado en Ciencia Política (UDESA) y Maestría en politicas públicas (UTDT) 
*   Desarrollador de herramientas de transparencia de datos y archivos digitales.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
