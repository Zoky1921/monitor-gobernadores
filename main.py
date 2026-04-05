import os
import json
import time
import requests
from datetime import datetime, timedelta, timezone
from google import genai
from google.genai import types

# 1. Cargar llaves
TWITTERAPI_KEY = os.environ.get("TWITTERAPI_KEY")
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')

# 2. Inicializar Gemini (Librería moderna)
client = genai.Client(api_key=GEMINI_KEY)

# --- 🕒 BLINDAJE HORARIO (ZONA ARGENTINA UTC-3) ---
zona_ar = timezone(timedelta(hours=-3))
ahora = datetime.now(zona_ar)
fecha_hoy_str = ahora.strftime('%Y-%m-%d') 
fecha_pantalla = ahora.strftime('%d/%m/%Y') 
hora_corte = ahora.strftime('%H:%M')

# ---> NUEVO: Definición del turno <---
if ahora.hour < 15:
    turno = "manana"
else:
    turno = "noche"

print(f"Iniciando radar para la fecha: {fecha_hoy_str} a las {hora_corte} hs (Hora Argentina)")
print(f"--- Ejecutando turno: {turno.upper()} ---")

def obtener_tweets_twitterapi(handle):
    url = "https://api.twitterapi.io/twitter/user/last_tweets"
    querystring = {"userName": handle}
    
    headers = {
        "X-API-Key": TWITTERAPI_KEY
    }
    
    try:
        response = requests.get(url, headers=headers, params=querystring)
        response.raise_for_status()
        data = response.json()
        
        tweets_texto = []
        
# Extraemos la lista de la "doble caja" específica de TwitterAPI.io
        lista_tweets = []
        if isinstance(data, dict):
            # Buscamos la ruta exacta: data -> data -> tweets
            if 'data' in data and isinstance(data['data'], dict) and 'tweets' in data['data']:
                lista_tweets = data['data']['tweets']
            elif 'tweets' in data:
                lista_tweets = data['tweets']
            elif 'data' in data and isinstance(data['data'], list):
                lista_tweets = data['data']
        else:
            lista_tweets = data
        
        if not isinstance(lista_tweets, list):
            print(f"Formato inesperado devuelto para @{handle}. LOG: {str(data)[:200]}")
            return []

        for t in lista_tweets:
            # 1. Capturamos el texto base
            texto_base = t.get('full_text') or t.get('text')
            
            # 2. Identificación de RT (Corregida para evitar falsos positivos)
            es_rt_flag = str(t.get('isRetweet')).lower() == 'true'
            tiene_rt_dict = isinstance(t.get('retweeted_tweet'), dict) and len(t.get('retweeted_tweet')) > 0
            empieza_con_rt = bool(texto_base) and texto_base.startswith('RT @')
            
            is_rt = es_rt_flag or tiene_rt_dict or empieza_con_rt
            
            # 3. Si es RT, extraemos el contenido original
            if tiene_rt_dict:
                texto_final = t['retweeted_tweet'].get('full_text') or t['retweeted_tweet'].get('text') or texto_base
            else:
                texto_final = texto_base

            # 4. Construimos la línea con el prefijo
            if texto_final and isinstance(texto_final, str) and texto_final.strip():
                prefijo = "[RE-TWEET] " if is_rt else ""
                fecha = t.get('createdAt') or t.get('created_at', 'Fecha desconocida')
                tweets_texto.append(f"(Publicado: {fecha}) {prefijo}{texto_final}")

            if len(tweets_texto) >= 40:
                break

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
            tweets = obtener_tweets_twitterapi(handle)
            
            diccionario_crudo[handle] = tweets

            for t in tweets:
                data_context += f"[@{handle}]: {t}\n---\n"
            
            # 5 segundos de espera obligatorios para no saturar RapidAPI (ahora usa otra api)
            time.sleep(5) 

        if not data_context:
            print("No se encontraron tweets nuevos hoy.")
            return

# --- GUARDAR EL ARCHIVO CRUDO ---
        os.makedirs('data', exist_ok=True)
        # Le agregamos el turno al final del nombre, antes del .json
        ruta_crudo = f'data/{fecha_hoy_str}_crudo_{turno}.json'
        with open(ruta_crudo, 'w', encoding='utf-8') as f:
            json.dump(diccionario_crudo, f, ensure_ascii=False, indent=4)
        print(f"✅ Archivo crudo guardado: {ruta_crudo}")
        
        # --- NUEVA VERIFICACIÓN DE SEGURIDAD ---
        # Filtramos quiénes tienen al menos un tweet recolectado
        gobernadores_con_datos = [h for h, t in diccionario_crudo.items() if len(t) > 0]
        
        # Podés ajustar este número (ej: 5) según tu criterio de representatividad
        if len(gobernadores_con_datos) < 5:
            print(f"⚠️ Monitoreo insuficiente: Solo se hallaron datos de {len(gobernadores_con_datos)} gobernadores.")
            print("Abortando llamada a Gemini para evitar análisis sesgado y ahorrar tokens.")
            return

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
4. JERARQUÍA DE TENDENCIAS ("Efecto Terono"): Extrae un máximo de 5 tendencias principales que resuman la agenda federal de hoy. Para cada tendencia, DEBES identificar y listar los usuarios de X (@usuario) de todos los gobernadores que se hayan posicionado sobre ese tema.
5. TWEET DESTACADO ("El post del día"): Selecciona la cita de mayor peso político del lote analizado. 
REGLA CRÍTICA DE TIEMPO: debes leer atentamente la fecha que figura entre paréntesis al inicio de cada tweet `(Publicado: ...)`. **SOLO** puedes seleccionar un tweet si corresponde al día de hoy o al día de ayer. Si la declaración más rimbombante es de hace 3 días o más (por ejemplo, del 1 de abril), ESTÁ ESTRICTAMENTE PROHIBIDO seleccionarla. Si no hay nada relevante reciente, debes escribir exactamente: "Sin posteos destacados en este turno".
REGLA DE FORMATO: Debe ser el texto ORIGINAL, COMPLETO y TEXTUAL. Prohibido resumir, parafrasear o acortar el mensaje. Si es un hilo, toma el tweet principal que dispara la noticia. 
Piensa como un analista político: ¿cuál es la declaración reciente que altera el escenario o fija una agenda ineludible?    7. SEMÁFORO DE CLIMA POLÍTICO (NUEVO): Evalúa el nivel de conflictividad general de la jornada (Nación vs Provincias o entre ellas) y devuelve UNA SOLA PALABRA (ej: TENSO, NEUTRAL, POSITIVO, CONFLICTO).
8. SEGURIDAD JSON Y COMILLAS (CRÍTICA): El objeto JSON debe ser perfecto. Para el campo "texto" del tweet destacado y las frases fuertes, DEBES incluir el contenido textual completo. Si el mensaje original tiene comillas dobles internas, debes cámbiarlas obligatoriamente por comillas simples (') para no romper la estructura del JSON, pero mantén cada palabra del mensaje original. Las comillas dobles SOLO deben usarse para la estructura del JSON, nunca para el texto.
    FORMATO DE SALIDA OBLIGATORIO:
    Responde ÚNICAMENTE con un objeto JSON válido. La estructura exacta debe ser:

    {{
        "clima_general": "TENSO",
        "resumen_ejecutivo": "Texto del resumen corto de 1 minuto aqui, sin comillas internas...",
        "analisis_profundo": "Texto del analisis extenso y detallado aqui, sin comillas internas...",
        "temas_calientes": [
            {{
                "tema": "Breve descripcion de la tendencia federal sin comillas",
                "gobernadores_involucrados": ["@Kicillofok", "@ZiliottoSergio", "@maxipullaro"]
            }},
            {{
                "tema": "Otra tendencia importante aqui",
                "gobernadores_involucrados": ["@frigeriorogelio", "@passalacquaok"]
            }}
        ],
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
        ruta_analisis = f'data/{fecha_hoy_str}_analisis_{turno}.json'
        with open(ruta_analisis, 'w', encoding='utf-8') as f:
            json.dump(resumen_data, f, ensure_ascii=False, indent=4)

        print(f"✅ ¡Éxito! Archivo de análisis creado: {ruta_analisis}")

    except Exception as e:
        print(f"❌ Error fatal: {str(e)}")
        raise e

if __name__ == "__main__":
    ejecutar_monitoreo()
