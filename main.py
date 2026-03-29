import os
import json
from datetime import datetime
import apify_client
from apify_client import ApifyClient
import google.generativeai as genai

# 1. Cargar llaves desde Secrets de GitHub
APIFY_TOKEN = os.environ.get('APIFY_API_TOKEN')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')

# 2. Inicializar
apify_client = ApifyClient(APIFY_TOKEN)
genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

def ejecutar_monitoreo():
    # Leer base de datos
    with open('gobernadores.json', 'r', encoding='utf-8') as f:
        gobernadores = json.load(f)

    handles = [g['usuario_x'] for g in gobernadores]
    
    print(f"--- Iniciando extracción para {len(handles)} perfiles ---")

    # 3. Extraer tweets con Apify (Actor: apidojo/tweet-scraper)
    run_input = {
        "handle": handles,
        "maxItems": 3, 
        "sort": "latest"
    }
    
    run = apify_client.actor("apidojo/tweet-scraper").call(run_input=run_input)
    tweets_raw = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())

    # 4. Formatear datos para la IA
    data_context = ""
    for t in tweets_raw:
        user = t.get('user', {}).get('screen_name', 'Desconocido')
        text = t.get('full_text', '')
        data_context += f"[@{user}]: {text}\n---\n"

    # 5. Prompt para Gemini (Diseñado para Textual Político)
    prompt = f"""
    Eres un analista político especializado en Argentina. 
    Analiza los tweets de los gobernadores del {datetime.now().strftime('%d/%m/%Y')}.
    Produce un JSON con esta estructura:
    {{
        "resumen_general": "Párrafo breve con la tendencia del día",
        "tweet_destacado": {{ "usuario": "@handle", "texto": "contenido" }},
        "temas_calientes": ["Tema 1", "Tema 2", "Tema 3"],
        "gobernador_mas_activo": "@handle"
    }}
    
    TWEETS:
    {data_context}
    """

    # 6. Generar Resumen
    response = model.generate_content(prompt)
    clean_json = response.text.replace('```json', '').replace('```', '').strip()
    resumen_data = json.loads(clean_json)

    # 7. Guardar Histórico en carpeta 'data'
    fecha_hoy = datetime.now().strftime('%Y-%m-%d')
    if not os.path.exists('data'):
        os.makedirs('data')

    with open(f'data/{fecha_hoy}.json', 'w', encoding='utf-8') as f:
        json.dump(resumen_data, f, ensure_ascii=False, indent=4)
    
    print(f"✅ Archivo data/{fecha_hoy}.json creado.")

if __name__ == "__main__":
    ejecutar_monitoreo()
