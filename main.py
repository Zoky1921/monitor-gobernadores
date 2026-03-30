import os
import json
import time
from datetime import datetime
from apify_client import ApifyClient
from google import genai
from google.genai import types

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

        seleccion = gobernadores[:12]
        handles = [g['usuario_x'] for g in seleccion]

        print(f"--- Iniciando extracción para {len(handles)} perfiles ---")

        # ✅ Actor activo: apidojo/tweet-scraper
        # twitterHandles y maxItems son los parámetros correctos de este actor
        run_input = {
            "twitterHandles": handles,
            "maxItems": len(handles) * 5,  # mínimo ~5 por perfil para no violar TOS del actor
        }

        run = apify_client.actor("apidojo/tweet-scraper").call(run_input=run_input)
        tweets_raw = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())

        if not tweets_raw:
            print("No se encontraron tweets nuevos hoy.")
            return

        # ✅ El output de apidojo usa author.userName y text (no user.screen_name ni full_text)
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

        # 3. Prompt para Gemini
        prompt = (
            f"Analiza estos tweets de gobernadores argentinos del {datetime.now().strftime('%d/%m/%Y')}. "
            f"Responde SOLO con un JSON válido con esta estructura: "
            f"{{\"resumen_general\": \"...\", \"tweet_destacado\": {{\"usuario\": \"...\", \"texto\": \"...\"}}, "
            f"\"temas_calientes\": [\"...\", \"...\"]}}. "
            f"TWEETS:\n{data_context}"
        )

        time.sleep(2)

        # ✅ Configuración correcta para google-genai SDK
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        resumen_data = json.loads(response.text)

        # 4. Guardar
        fecha_hoy = datetime.now().strftime('%Y-%m-%d')
        os.makedirs('data', exist_ok=True)  # ✅ más limpio que if/makedirs

        with open(f'data/{fecha_hoy}.json', 'w', encoding='utf-8') as f:
            json.dump(resumen_data, f, ensure_ascii=False, indent=4)

        print(f"✅ ¡Éxito! Archivo data/{fecha_hoy}.json creado.")

    except Exception as e:
        print(f"❌ Error fatal: {str(e)}")
        raise e

if __name__ == "__main__":
    ejecutar_monitoreo()
