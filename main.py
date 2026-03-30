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

# 2. Inicializar Gemini
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

        # ¡LEEMOS A LOS 24 GOBERNADORES!
        handles = [g['usuario_x'] for g in gobernadores]

        print(f"--- Iniciando extracción con RapidAPI para {len(handles)} perfiles ---")

        data_context = ""
        diccionario_crudo = {} # Acá vamos a guardar el crudo

        for handle in handles:
            print(f"Buscando tweets de @{handle}...")
            tweets = obtener_tweets_rapidapi(handle)
            
            # Guardamos en el diccionario crudo
            diccionario_crudo[handle] = tweets

            for t in tweets:
                data_context += f"[@{handle}]: {t}\n---\n"
            
            # 5 segundos de espera para que RapidAPI no nos bloquee (son 24 ahora)
            time.sleep(5) 

        if not data_context:
            print("No se encontraron tweets nuevos hoy.")
            return

        # --- GUARDAR EL CRUDO PRIMERO ---
        fecha_hoy = datetime.now().strftime('%Y-%m-%d')
        os.makedirs('data', exist_ok=True)
        
        with open(f'data/{fecha_hoy}_crudo.json', 'w', encoding='utf-8') as f:
            json.dump(diccionario_crudo, f, ensure_ascii=False, indent=4)
        print(f"✅ Archivo crudo guardado: data/{fecha_hoy}_crudo.json")


        # --- PROMPT MEJORADO PARA GEMINI ---
        prompt = (
            f"Actúa como un analista político experto. Analiza estos tweets de gobernadores argentinos del {datetime.now().strftime('%d/%m/%Y')}. "
            f"Necesito un análisis profundo y detallado. Responde SOLO con un JSON válido con esta estructura exacta:\n"
            f"{{\n"
            f"  \"resumen_general\": \"Un párrafo extenso analizando el clima político, los ejes de gestión y los conflictos principales que se desprenden de los tweets.\",\n"
            f"  \"analisis_por_gobernador\": [\n"
            f"    {{\"gobernador\": \"@usuario\", \"analisis\": \"Qué comunicó hoy y su postura política...\", \"cita_textual_relevante\": \"Alguna frase fuerte del tweet si la hay\"}}\n"
            f"  ],\n"
            f"  \"tweet_destacado\": {{\"usuario\": \"...\", \"texto\": \"...\", \"por_que_es_clave\": \"...\"}},\n"
            f"  \"temas_calientes\": [\"Tema 1\", \"Tema 2\"]\n"
            f"}}\n"
            f"TWEETS:\n{data_context}"
        )

        print("Enviando los 24 perfiles a Gemini...")
        time.sleep(10)

        # 4. Enviar a Gemini (2.5 Flash)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        resumen_data = json.loads(response.text)

        # 5. Guardar el Análisis
        with open(f'data/{fecha_hoy}_analisis.json', 'w', encoding='utf-8') as f:
            json.dump(resumen_data, f, ensure_ascii=False, indent=4)

        print(f"✅ ¡Éxito! Archivo de análisis creado: data/{fecha_hoy}_analisis.json")

    except Exception as e:
        print(f"❌ Error fatal: {str(e)}")
        raise e

if __name__ == "__main__":
    ejecutar_monitoreo()
