import os
import json
from datetime import datetime
from apify_client import ApifyClient
from google import genai

# 1. Cargar llaves
APIFY_TOKEN = os.environ.get('APIFY_API_TOKEN')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')

# 2. Inicializar
apify_client = ApifyClient(APIFY_TOKEN)
client = genai.Client(api_key=GEMINI_KEY)

def ejecutar_monitoreo():
    with open('gobernadores.json', 'r', encoding='utf-8') as f:
        gobernadores = json.load(f)

    handles = [g['usuario_x'] for g in gobernadores]
    print(f"--- Iniciando extracción para {len(handles)} perfiles ---")

    # 3. Extraer tweets (Corregido: "Latest" con mayúscula)
    run_input = {
        "handle": handles,
        "maxItems": 3, 
        "sort": "Latest" 
    }
    
    run = apify_client.actor("apidojo/tweet-scraper").call(run_input=run_input)
    tweets_raw = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())

    data_context = ""
    for t in tweets_raw:
        user = t.get('user', {}).get('screen_name', 'Desconocido')
        text = t.get('full_text', '')
        data_context += f"[@{user}]: {text}\n---\n"

    # 4. Generar Resumen con Gemini 2.0 (la más nueva)
    prompt = f"Eres un analista político. Analiza estos tweets de gobernadores del {datetime.now().strftime('%d/%m/%Y')} y haz un resumen JSON con: resumen_general (párrafo), tweet_destacado (usuario y texto), temas_calientes (lista) y gobernador_mas_activo. TWEETS: {data_context}"
    
    response = client.models.generate_content(
        model="gemini-2.0-flash", 
        contents=prompt,
        config={'response_mime_type': 'application/json'}
    )
    
    resumen_data = json.loads(response.text)

    # 5. Guardar
    fecha_hoy = datetime.now().strftime('%Y-%m-%d')
    if not os.path.exists('data'):
        os.makedirs('data')

    with open(f'data/{fecha_hoy}.json', 'w', encoding='utf-8') as f:
        json.dump(resumen_data, f, ensure_ascii=False, indent=4)
    
    print(f"✅ Archivo data/{fecha_hoy}.json creado.")

if __name__ == "__main__":
    ejecutar_monitoreo()
