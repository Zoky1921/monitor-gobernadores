import os
import json
import time
from datetime import datetime
from apify_client import ApifyClient
from google import genai
from google.genai import types

APIFY_TOKEN = os.environ.get('APIFY_API_TOKEN')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')

apify_client = ApifyClient(APIFY_TOKEN)
client = genai.Client(api_key=GEMINI_KEY)

def ejecutar_monitoreo():
    try:
        ahora = datetime.now()
        fecha_display = ahora.strftime("%d/%m/%Y")
        fecha_archivo = ahora.strftime("%Y-%m-%d")

        with open('gobernadores.json', 'r', encoding='utf-8') as f:
            gobernadores = json.load(f)

        seleccion = gobernadores[:12]
        handles = [g['usuario_x'] for g in seleccion]

        print("--- Iniciando extraccion para " + str(len(handles)) + " perfiles ---")

        run_input = {
            "twitterHandles": handles,
            "maxItems": len(handles) * 5,
        }

        run = apify_client.actor("apidojo/tweet-scraper").call(run_input=run_input)
        tweets_raw = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())

        if not tweets_raw:
            print("No se encontraron tweets nuevos hoy.")
            return

        data_context = ""
        for t in tweets_raw:
            author = t.get('author', {})
            user = author.get('userName', author.get('name', 'Desconocido'))
            text = t.get('text', '')
            if text:
                data_context += "[@" + user + "]: " + text + "\n---\n"

        if not data_context:
            print("Tweets vacios luego del procesamiento.")
            return

        prompt = (
            "Analiza estos tweets de gobernadores argentinos del " + fecha_display + ". "
            "Responde SOLO con un JSON valido con esta estructura exacta: "
            '{"resumen_general": "...", "tweet_destacado": {"usuario": "...", "texto": "..."}, '
            '"temas_calientes": ["tema1", "tema2", "tema3"]}. '
            "TWEETS:\n" + data_context
        )

        time.sleep(2)

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        resumen_data = json.loads(response.text)

        os.makedirs('data', exist_ok=True)

        ruta = "data/" + fecha_archivo + ".json"
        with open(ruta, 'w', encoding='utf-8') as f:
            json.dump(resumen_data, f, ensure_ascii=False, indent=4)

        print("Exito! Archivo " + ruta + 
