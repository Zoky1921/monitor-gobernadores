import os
import json
import time
import requests
from datetime import datetime, timedelta, timezone
from google import genai
from google.genai import types

# 1. Cargar llaves
RAPIDAPI_KEY = os.environ.get('RAPIDAPI_KEY')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')

# 2. Inicializar Gemini (Librería moderna)
client = genai.Client(api_key=GEMINI_KEY)

# --- 🕒 BLINDAJE HORARIO (ZONA ARGENTINA UTC-3) ---
# Esto garantiza que el robot siempre opere con fecha y hora de Argentina, 
# sin importar dónde estén los servidores de GitHub.
zona_ar = timezone(timedelta(hours=-3))
ahora = datetime.now(zona_ar)
fecha_hoy_str = ahora.strftime('%Y-%m-%d') # Formato para nombrar los archivos (ej: 2026-03-30)
fecha_pantalla = ahora.strftime('%d/%m/%Y') # Formato para hablarle a Gemini
hora_corte = ahora.strftime('%H:%M')

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
        # Capturamos hasta 30 tweets y les pegamos la fecha original
        if isinstance(data, list):
            for t in data[:30]: 
                if 'text' in t:
                    fecha = t.get('created_at', 'Fecha desconocida')
                    tweets_texto.append(f"(Publicado: {fecha}) {t['text']}")
        elif isinstance(data, dict) and 'timeline' in data:
            for t in data['timeline'][:30]:
                if 'text' in t:
                    fecha = t.get('created_at', 'Fecha desconocida')
                    tweets_texto.append(f"(Publicado: {fecha}) {t['text']}")
                    
        return tweets_texto
    except Exception as e:
        print(f"Error buscando a @{handle}: {e}")
        return []

def ejecutar_monitoreo():
    try:
        print(f"Iniciando radar para la fecha: {fecha_hoy_str} a las {hora_corte} hs (Hora Argentina)")
        
        with open('gobernadores.json', 'r', encoding='utf-8') as f:
            gobernadores = json.load(f)

        # Leemos la lista completa de gobernadores
        handles = [g['usuario_x'] for g in gobernadores]

        print(f"--- Iniciando extracción con RapidAPI para {len(handles)} perfiles ---")

        data_context = ""
        diccionario_crudo = {} # Para el archivo histórico

        for handle in handles:
            print(f"Buscando tweets de @{handle}...")
            tweets = obtener_tweets_rapidapi(handle)
            
            diccionario_crudo[handle] = tweets

            for t in tweets:
                data_context += f"[@{handle}]: {t}\n---\n"
            
            # 5 segundos de espera obligatorios para no saturar RapidAPI
            time.sleep(5) 

        if not data_context:
            print("No se encontraron tweets nuevos hoy.")
            return

        # --- GUARDAR EL ARCHIVO CRUDO ---
        os.makedirs('data', exist_ok=True)
        
        # Usamos la fecha blindada de Argentina para el nombre del archivo
        ruta_crudo = f'data/{fecha_hoy_str}_crudo.json'
        with open(ruta_crudo, 'w', encoding='utf-8') as f:
            json.dump(diccionario_crudo, f, ensure_ascii=False, indent=4)
        print(f"✅ Archivo crudo guardado: {ruta_crudo}")

        # --- 🤖 SÚPER PROMPT NIVEL CONSULTORÍA ---
        prompt = f"""
Eres un Analista Político Senior y Consultor Estratégico experto en dinámicas federales en Argentina.
Tu tarea es analizar los siguientes tweets crudos de los 24 gobernadores provinciales. Hoy es {fecha_pantalla} y son las {hora_corte} hs (Hora de Buenos Aires, GMT-3). Cada tweet incluye su fecha original de publicación.

REGLAS DE ANÁLISIS ESTRATÉGICO:
1. FILTRO TEMPORAL Y ACTUALIDAD ESTRICTA: IGNORA POR COMPLETO cualquier tweet que no haya sido publicado hoy ({fecha_pantalla}) o a última hora de ayer. Procesa exclusivamente declaraciones políticas, medidas de gestión, reclamos al Estado Nacional o posicionamientos ideológicos. Ignora efemérides o saludos protocolares.
2. REGLA DE NOMENCLATURA (CRÍTICA): Cada vez que menciones a un gobernador en cualquier parte del análisis, DEBES incluir el nombre de su provincia entre paréntesis inmediatamente después. Ejemplo: "Maximiliano Pullaro (Santa Fe) anunció..." o "El reclamo de Weretilneck (Río Negro)...". Nunca nombres a un gobernador sin su provincia.
3. DOBLE VELOCIDAD DE LECTURA:
   - "Resumen Ejecutivo": Redacta un panorama hiper directo de 1 solo párrafo (aprox. 100 palabras) para lectura rápida de 1 minuto.
   - "Análisis Profundo": Redacta un reporte analítico extenso (aprox. 400 palabras, 3 minutos de lectura). Conecta temas, marca tensiones entre Nación y Provincias, y desglosa estrategias discursivas.
4. JERARQUÍA DE TENDENCIAS: Extrae un máximo de 5 tendencias principales que resuman la agenda federal de hoy.
5. TWEET DESTACADO ("El post del día"): Selecciona la cita más fuerte o de mayor impacto institucional. 
6. POSTURA POLÍTICA (Por gobernador): Define en máximo 3 líneas la postura actual de cada gobernador activo basándote estrictamente en sus textos.

FORMATO DE SALIDA OBLIGATORIO:
Responde ÚNICAMENTE con un objeto JSON válido. La estructura exacta debe ser:

{{
    "resumen_ejecutivo": "Texto del resumen corto de 1 minuto aquí...",
    "analisis_profundo": "Texto del análisis extenso y detallado de 3 minutos aquí...",
    "temas_calientes": ["Tendencia 1", "Tendencia 2", "Tendencia 3", "Tendencia 4", "Tendencia 5"],
    "tweet_destacado": {{
        "usuario": "@Usuario",
        "texto": "Cita textual aquí...",
        "por_que_es_clave": "Breve justificación analítica."
    }},
    "analisis_por_gobernador": [
        {{
            "gobernador": "@UsuarioGobernador",
            "temas_mencionados": ["Tema A", "Tema B"],
            "postura_politica": "Análisis de su postura en máximo 3 líneas.",
            "frase_fuerte": "Una cita textual breve si existe, sino null"
        }}
    ]
}}

TWEETS A ANALIZAR:
{data_context}
"""

        print("Enviando los perfiles a Gemini...")
        time.sleep(10)

        # 4. Enviar a Gemini (Forzando la salida a JSON puro)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        resumen_data = json.loads(response.text)

        # 5. Guardar el Análisis
        ruta_analisis = f'data/{fecha_hoy_str}_analisis.json'
        with open(ruta_analisis, 'w', encoding='utf-8') as f:
            json.dump(resumen_data, f, ensure_ascii=False, indent=4)

        print(f"✅ ¡Éxito! Archivo de análisis creado: {ruta_analisis}")

    except Exception as e:
        print(f"❌ Error fatal: {str(e)}")
        raise e

if __name__ == "__main__":
    ejecutar_monitoreo()
