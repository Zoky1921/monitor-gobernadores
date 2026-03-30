import os
import json
import time
import requests
from datetime import datetime
from google import genai
from google.genai import types

# 1. Cargar llaves
RAPIDAPI_KEY = os.environ.get('RAPIDAPI_KEY')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')

# 2. Inicializar Gemini (Librería moderna)
client = genai.Client(api_key=GEMINI_KEY)

def obtener_tweets_rapidapi(handle):
    url = "https://twitter-api45.p.rapidapi.com/timeline.php"
    querystring = {"screenname": handle}
    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": "twitter-api45.p.rapidapi.com"
    }
    
    try:
        response = requests.get(url, headers=headers, params=querystring)
        response.raise_for_status()
        data = response.json()
        
        tweets_texto = []
        if isinstance(data, list):
            for t in data[:3]: 
                if 'text' in t:
                    tweets_texto.append(t['text'])
        elif isinstance(data, dict) and 'timeline' in data:
            for t in data['timeline'][:3]:
                if 'text' in t:
                    tweets_texto.append(t['text'])
                    
        return tweets_texto
    except Exception as e:
        print(f"Error buscando a @{handle}: {e}")
        return []

def ejecutar_monitoreo():
    try:
        with open('gobernadores.json', 'r', encoding='utf-8') as f:
            gobernadores = json.load(f)

        seleccion = gobernadores[:5]
        handles = [g['usuario_x'] for g in seleccion]

        print(f"--- Iniciando extracción con RapidAPI para {len(handles)} perfiles ---")

        data_context = ""
        for handle in handles:
            print(f"Buscando tweets de @{handle}...")
            tweets = obtener_tweets_rapidapi(handle)
            for t in tweets:
                data_context += f"[@{handle}]: {t}\n---\n"
            
            print("Esperando 5 segundos para no saturar la API...")
            time.sleep(5) 

        if not data_context:
            print("No se encontraron tweets nuevos hoy.")
            return

        prompt = (
            f"Analiza estos tweets de gobernadores argentinos del {datetime.now().strftime('%d/%m/%Y')}. "
            f"Responde SOLO con un JSON válido con esta estructura: "
            f"{{\"resumen_general\": \"...\", \"tweet_destacado\": {{\"usuario\": \"...\", \"texto\": \"...\"}}, "
            f"\"temas_calientes\": [\"...\", \"...\"]}}. "
            f"TWEETS:\n{data_context}"
        )

        print("Enviando a Gemini...")
        time.sleep(5)

        # 4. Enviar a Gemini (Usamos el 2.5 Flash, el modelo gratuito actual)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        resumen_data = json.loads(response.text)

        # 5. Guardar
        fecha_hoy = datetime.now().strftime('%Y-%m-%d')
        os.makedirs('data', exist_ok=True)

        with open(f'data/{fecha_hoy}.json', 'w', encoding='utf-8') as f:
            json.dump(resumen_data, f, ensure_ascii=False, indent=4)

        print(f"✅ ¡Éxito! Archivo data/{fecha_hoy}.json creado.")

    except Exception as e:
        print(f"❌ Error fatal: {str(e)}")
        raise e

if __name__ == "__main__":
    ejecutar_monitoreo()
