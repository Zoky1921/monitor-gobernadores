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
zona_ar = timezone(timedelta(hours=-3))
ahora = datetime.now(zona_ar)
fecha_hoy_str = ahora.strftime('%Y-%m-%d') 
fecha_pantalla = ahora.strftime('%d/%m/%Y') 
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
        
        def procesar_lista(lista):
            for t in lista:
                # 1. ¿Es un Retweet?
                if 'retweeted_status' in t:
                    rt_obj = t['retweeted_status']
                    texto = rt_obj.get('full_text') or rt_obj.get('text')
                    prefijo = "RT: "
                else:
                    # Si es un tweet propio, exigimos el "full_text" para no perder hilos
                    texto = t.get('full_text') or t.get('text')
                    prefijo = ""
                
                # 2. Solo procesamos si hay texto real
                if texto and isinstance(texto, str) and texto.strip():
                    fecha = t.get('created_at', 'Fecha desconocida')
                    tweets_texto.append(f"(Publicado: {fecha}) {prefijo}{texto}")
                
                if len(tweets_texto) >= 40:
                    break

        if isinstance(data, list):
            procesar_lista(data)
        elif isinstance(data, dict) and 'timeline' in data:
            procesar_lista(data['timeline'])
                    
        return tweets_texto
    except Exception as e:
        print(f"Error buscando a @{handle}: {e}")
        return []

def ejecutar_monitoreo():
    try:
        print(f"Iniciando radar para la fecha: {fecha_hoy_str} a las {hora_corte} hs (Hora Argentina)")
        
        # --- ABRIR LA LISTA DE GOBERNADORES ---
        with open('gobernadores.json', 'r', encoding='utf-8') as f:
            gobernadores = json.load(f)

        handles = [g['usuario_x'] for g in gobernadores]

        print(f"--- Iniciando extracción con RapidAPI para {len(handles)} perfiles ---")

        data_context = ""
        diccionario_crudo = {} # Para el archivo histórico

        # --- CICLO DE RECOLECCIÓN ---
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
7. SEMÁFORO DE CLIMA POLÍTICO (NUEVO): Evalúa el nivel de conflictividad general de la jornada (Nación vs Provincias o entre pares). Define el clima general con UNA SOLA PALABRA exacta: "TENSO", "NEUTRAL" o "POSITIVO".
8. SEGURIDAD JSON (CRÍTICA): Tienes ESTRICTAMENTE PROHIBIDO usar cualquier tipo de comillas (ni dobles, ni simples) dentro del contenido de tus respuestas. Redacta todos los resúmenes, análisis y citas textuales sin usar comillas en absoluto. Las únicas comillas permitidas en toda tu respuesta son las que estructuran las claves y valores del formato JSON.
FORMATO DE SALIDA OBLIGATORIO:
Responde ÚNICAMENTE con un objeto JSON válido. La estructura exacta debe ser:

{{
    "clima_general": "TENSO",
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
        
        # 4. Enviar a Gemini (Forzando la salida a JSON puro)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        # --- LIMPIEZA DE SEGURIDAD PARA EL JSON ---
        raw_text = response.text.strip()
        
        # Si por alguna razón Gemini mete las etiquetas de markdown ```json, las volamos
        if raw_text.startswith("```"):
            raw_text = raw_text.replace("```json", "").replace("```", "").strip()
        
        try:
            resumen_data = json.loads(raw_text)
        except json.JSONDecodeError as e:
            print(f"❌ Error de sintaxis en el JSON de Gemini: {e}")
            with open(f'data/{fecha_hoy_str}_ERROR_IA.txt', 'w', encoding='utf-8') as f:
                f.write(raw_text)
            print(f"⚠️ Se guardó el error en data/{fecha_hoy_str}_ERROR_IA.txt para revisión.")
            raise e

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
