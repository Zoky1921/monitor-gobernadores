# 📡 El Radar Federal (Federal Radar)
> **Idiomas / Languages:** [Spanish](README.md) | [English]

**Strategic Intelligence & Discursive Analysis Platform for the Argentine Federal Landscape.**

Federal Radar is a strategic monitoring system designed to process, systematize, and dissect the public discourse of Argentina's 24 provincial governors in real-time. It utilizes a **Dual Pipeline** architecture to separate institutional management from political "undercurrents" and power dynamics[cite: 1].

## 🚀 Key Features

*   **Dual-Track Analysis:**
    *   **Institutional Track (Gemini 2.5 Flash):** Technical and executive summaries of management measures, public works, and official announcements[cite: 1].
    *   **Subplot Track (Grok 4.1 Fast):** Hard-hitting political analysis (Pagni-style) regarding fiscal tensions, "treasury diplomacy," and symbolic positioning[cite: 1].
*   **🔍 OpenArg Sniper:** Integration with the OpenArg API for factual verification of economic and social data mentioned in highlighted posts[cite: 1].
*   **🚥 Political Climate Semaphore:** A federal tension indicator (National Government vs. Provinces) based on daily sentiment analysis[cite: 1].
*   **🎯 Terono Effect:** An interactive filtering engine that highlights trends and groups governors according to the day's agenda.
*   **🛠️ Anti-Hallucination Shield:** A JSON schema validation system with automatic retries, incremental backoff, and raw audit logs[cite: 1].

## 🛠️ Tech Stack

*   **AI Engines:** Google Gemini 2.5 Flash, xAI Grok 4.1 (via OpenRouter), and DeepSeek V3/R1[cite: 1].
*   **Backend:** Python 3.11+ using `google-genai` and `json_repair`[cite: 1].
*   **Database:** SQLite for token consumption logging and cost auditing[cite: 1].
*   **Frontend:** Vanilla JS (ES6+), CSS3 with dynamic variables, and HTML5.
*   **Automation:** Integrated with GitHub Actions for scheduled executions (Morning/Evening).

## 📋 Requirements & Installation

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/zoky1921/monitor-gobernadores.git](https://github.com/zoky1921/monitor-gobernadores.git)
    cd monitor-gobernadores
    ```

2.  **Environment Setup:**
    Install dependencies[cite: 1]:
    ```bash
    pip install google-genai requests json_repair
    ```

3.  **Environment Variables (Secrets):**
    The following keys are required[cite: 1]:
    *   `TWITTERAPI_KEY`: For X data extraction.
    *   `GEMINI_API_KEY`: For the Institutional engine.
    *   `OPENROUTER_API_KEY`: For Grok and backup models access.
    *   `OPENARG_API_KEY`: For data verification.

## 🏗️ Data Architecture

The system operates through a **Structural Hardening** process[cite: 1]:
1.  **Extraction:** Tweet collection via TwitterAPI.io with raw `json` persistence[cite: 1].
2.  **Validation:** The `_parsear_y_validar_resumen()` function ensures the AI delivers complete and typed JSON objects[cite: 1].
3.  **Auditing:** Format failures are stored in individual `.txt` files for prompt engineering improvements[cite: 1].
4.  **Deployment:** Generation of `analisis_manana.json` and `analisis_noche.json` files for dashboard consumption[cite: 1].

## ✍️ Author

**Political Scientist** | Political Communication Researcher.
*   Master’s Candidate (UdeSA).
*   Professor at the Juan Vucetich Police School.
*   Developer of data transparency tools and digital archives.

## 📄 License

This project is licensed under the MIT License.
