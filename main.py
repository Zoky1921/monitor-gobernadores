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

        # Para no saturar el plan gratis de Apify, probemos con los primeros 10 
        # Si esto funciona, mañana probamos con los 24.
        seleccion = gobernadores[:12] 
        handles = [g['usuario_x'] for g in seleccion]
        
        print(f"--- Iniciando extracción para {len(handles)} perfiles ---")

        # 3. Cambiamos a un Actor diferente: 'microworlds/twitter-scraper'
        # Es más liviano y suele permitir el plan gratis.
        run_input = {
            "searchMode": "live",
            "twitterHandles": handles,
            "maxTweetsPerQuery": 2,
            "addUserInfo": True
        }
        
        # Llamada al nuevo Actor
        run = apify_client.actor("microworlds/twitter-scraper").call(run_input=run_input)
        tweets_raw = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())

        if not tweets_raw:
            print("No se encontraron tweets nuevos hoy.")
            return

        data_context = ""
        for t in tweets_raw:
            user = t.get('user', {}).get('screen_name', 'Desconocido')
            text = t.get('full_text', t.get('text', ''))
            data_context += f"[@{user}]: {text}\n---\n"

        # 4. Gemini 1.5 Flash (Más estable para el plan gratis)
        prompt = f"Analiza estos tweets de gobernadores argentinos del {datetime.now().strftime('%d/%m/%Y')}. Resumen en JSON: resumen_general, tweet_destacado (usuario y texto), temas_calientes (lista). TWEETS: {data_context}"
        
        # Agregamos un pequeño delay para que la API no se asuste
        time.sleep(2) 

        response = client.models.generate_content(
            model="gemini-1.5-flash", 
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
        
        print(f"✅ ¡Éxito! Archivo data/{fecha_hoy}.json creado.")

    except Exception as e:
        print(f"❌ Error fatal: {str(e)}")
        # Si falla, tiramos el error para verlo en el log de GitHub
        raise e

if __name__ == "__main__":
    ejecutar_monitoreo()
