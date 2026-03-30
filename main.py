import os
import json
import time
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
    try:
        with open('gobernadores.json', 'r', encoding='utf-8') as f:
            gobernadores = json.load(f)

        # Probamos con 5 para que el plan gratis de Apify no nos rebote
        seleccion = gobernadores[:5] 
        handles = [g['usuario_x'] for g in seleccion]
        
        print(f"--- Iniciando extracción para: {', '.join(handles)} ---")

        # 3. Usamos 'apidojo/twitter-scraper-lite' (Suele ser el más estable)
        run_input = {
            "twitterHandles": handles,
            "maxItems": 2,
            "sort": "Latest"
        }
        
        run = apify_client.actor("apidojo/twitter-scraper-lite").call(run_input=run_input)
        tweets_raw = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())

        if not tweets_raw:
            print("⚠️ No se recuperaron tweets. Puede que el scraper esté saturado.")
            return

        data_context = ""
        for t in tweets_raw:
            user = t.get('user', {}).get('screen_name', 'Desconocido')
            text = t.get('full_text', t.get('text', ''))
            data_context += f"[@{user}]: {text}\n---\n"

        # 4. Gemini 1.5 Flash (Más generoso con la cuota gratis)
        prompt = f"Analiza estos tweets de gobernadores del {datetime.now().strftime('%d/%m/%Y')} y haz un resumen JSON: resumen_general, tweet_destacado, temas_calientes. TWEETS: {data_context}"
        
        # Pausa de seguridad para no saturar la API
        time.sleep(5) 

        response = client.models.generate_content(
            model="gemini-1.5-flash", 
            contents=prompt,
            config={'response_mime_type': 'application/json'}
        )
        
        resumen_data = json.loads(response.text)

        # 5. Guardar resultados
        fecha_hoy = datetime.now().strftime('%Y-%m-%d')
        if not os.path.exists('data'):
            os.makedirs('data')

        archivo_final = f'data/{fecha_hoy}.json'
        with open(archivo_final, 'w', encoding='utf-8') as f:
            json.dump(resumen_data, f, ensure_ascii=False, indent=4)
        
        print(f"✅ ¡LO LOGRAMOS! Revisá la carpeta data/ y vas a ver el archivo.")

    except Exception as e:
        print(f"❌ Error detallado: {str(e)}")
        raise e

if __name__ == "__main__":
    ejecutar_monitoreo()
