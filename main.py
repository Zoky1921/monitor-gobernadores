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
        with open('gobernadores.json', 'r', encoding='utf-8') as f:
            gobernadores = json.load(f)

        seleccion = gobernadores[:12]
        handles = [g['usuario_x'] for g in seleccion]

        print(f"--- Iniciando extracción para {len(handles)} perfiles ---")

        run_input = {
            "twitterHandles": handles,
            "maxItems": len(handles) * 5,
        }

        run = apify_client.actor("apidojo/tweet-scraper").call(run_input=run_input)
        tweets_raw = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())

        if not tweets_raw:
            print("No se encontraron tweets nuevos hoy.")
            return

        # ✅ BUG FIX: "\n---\n" con backslash simple, no doble
        data_context = ""
        for t in tweets_raw:
            author = t.get('author', {})
            user = author.get('userName', author.get('name', 'Desconocido'))
            text = t.get('text', '')
            if text:
                data_context += f"[@{user}]: {text}\n---\n"

        if not data_context:
            print("Tweets vacíos luego del procesamiento.")
            return

        fecha = datetime.now().strftime('%d/%m/%Y
