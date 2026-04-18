import time
import os
import json
import re
import sqlite3
import requests
from datetime import datetime, timedelta, timezone
from google import genai
from google.genai import types

# 1. Cargar llaves
TWITTERAPI_KEY = os.environ.get("TWITTERAPI_KEY")
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')

if not TWITTERAPI_KEY:
    raise EnvironmentError("❌ Falta la variable de entorno: TWITTERAPI_KEY")
if not GEMINI_KEY:
    raise EnvironmentError("❌ Falta la variable de entorno: GEMINI_API_KEY")

MODELO_GEMINI = "gemini-2.5-flash"

# 2. Inicializar Gemini (Librería moderna)
client = genai.Client(api_key=GEMINI_KEY)


def registrar_consumo_tokens(t_in: int, t_out: int, modelo: str = "gemini-2.5-flash", turno_corrida: str = ""):
    """
    Registra el consumo de tokens por corrida en SQLite para auditoría de costos.
    La DB se guarda en el repo (radar_federal.db) y se persiste vía git en el workflow.
    """
    try:
        conn = sqlite3.connect('radar_federal.db')
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS log_tokens (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha         TEXT,
                turno         TEXT,
                modelo        TEXT,
                tokens_input  INTEGER,
                tokens_output INTEGER,
                tokens_total  INTEGER
            )
        ''')
        total = t_in + t_out
        cursor.execute('''
            INSERT INTO log_tokens (fecha, turno, modelo, tokens_input, tokens_output, tokens_total)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (datetime.now(zona_ar).strftime("%Y-%m-%d %H:%M:%S"), turno_corrida, modelo, t_in, t_out, total))
        conn.commit()
        conn.close()
        print(f"📊 [Tokens] {modelo} | input: {t_in:,} | output: {t_out:,} | total: {total:,}")
    except Exception as e:
        print(f"⚠️ Error al registrar tokens en DB: {e}")

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
        response = requests.get(url, headers=headers, params=querystring, timeout=30)
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
            texto_base = t.get('full_text') or t.get('text')
            
            es_rt_flag = str(t.get('isRetweet')).lower() == 'true'
            tiene_rt_dict = isinstance(t.get('retweeted_tweet'), dict) and len(t.get('retweeted_tweet')) > 0
            empieza_con_rt = bool(texto_base) and texto_base.startswith('RT @')
            
            is_rt = es_rt_flag or tiene_rt_dict or empieza_con_rt
            
            # --- NUEVO: Búsqueda del autor original del RT ---
            autor_original = ""
            if tiene_rt_dict:
                # Buscamos en el diccionario del RT original
                usuario_rt = t['retweeted_tweet'].get('user') or t['retweeted_tweet'].get('author') or {}
                if isinstance(usuario_rt, dict):
                    autor_original = usuario_rt.get('screen_name') or usuario_rt.get('userName') or usuario_rt.get('username') or ""
            
            # Plan B: Si la API no trajo el diccionario, lo cortamos "a mano" del texto
            if not autor_original and texto_base and texto_base.startswith('RT @'):
                partes = texto_base.split(' ', 2)
                if len(partes) > 1:
                    # Limpiamos los dos puntos y el arroba para que quede prolijo
                    autor_original = partes[1].replace(':', '').replace('@', '')
            # -------------------------------------------------
            
            if tiene_rt_dict:
                texto_final = t['retweeted_tweet'].get('full_text') or t['retweeted_tweet'].get('text') or texto_base
            else:
                texto_final = texto_base

            if texto_final and isinstance(texto_final, str) and texto_final.strip():
                # --- NUEVO: Armado del prefijo personalizado ---
                if is_rt:
                    prefijo = f"[RE-TWEET de @{autor_original}] " if autor_original else "[RE-TWEET] "
                else:
                    prefijo = ""
                    
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
        # --- PING PREVENTIVO A GEMINI (antes de gastar créditos de Twitter) ---
        print("🔌 Verificando disponibilidad de Gemini antes de iniciar...")
        try:
            try:
                client.models.get(model=MODELO_GEMINI)
            except AttributeError:
                # El SDK instalado no soporta .get(); hacemos un ping mínimo (usa ~1 token de entrada)
                client.models.generate_content(
                    model=MODELO_GEMINI,
                    contents="ping",
                    config=types.GenerateContentConfig(max_output_tokens=1)
                )
            print("✅ Gemini disponible. Continuando...")
        except Exception as e:
            error_msg = str(e)
            if any(code in error_msg for code in ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED")):
                print(f"🚫 Gemini no disponible ({error_msg[:120]}). Abortando para no gastar créditos de Twitter.")
                return
            else:
                print(f"⚠️ Ping a Gemini falló con error desconocido: {error_msg[:120]}. Continuando de todos modos...")

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

🚫 RESTRICCIÓN CRÍTICA DE IDENTIDAD Y DATOS VACÍOS:
Solo podés mencionar a los gobernadores que aparecen explícitamente en el archivo JSON provisto. Tenés terminantemente prohibido usar información externa, tu memoria de entrenamiento o nombres de mandatarios de años anteriores. 
Si no hay tweets que cumplan el filtro temporal en absoluto, devolvé el JSON con `temas_calientes`: [], `analisis_por_gobernador`: [], y aplicá la estructura nula para `tweet_destacado` definida en la Regla 5.

REGLAS DE ANÁLISIS ESTRATÉGICO:
1. FILTRO TEMPORAL Y ACTUALIDAD ESTRICTA: IGNORA POR COMPLETO cualquier tweet que no haya sido publicado hoy ({fecha_pantalla}) o a última hora de ayer (después de las 20:00 hs GMT-3). Procesa exclusivamente declaraciones políticas, medidas de gestión, reclamos al Estado Nacional o posicionamientos ideológicos. Ignora efemérides. (ACLARACIÓN: Esto aplica solo al análisis general; para `tweet_destacado` rige la Regla 5).
2. REGLA DE NOMENCLATURA (CRÍTICA): Cada vez que menciones a un gobernador en cualquier parte del análisis, DEBES incluir el nombre de su provincia entre paréntesis inmediatamente después. Ejemplo: "Maximiliano Pullaro (Santa Fe) anunció...". Nunca nombres a un gobernador sin su provincia.
3. DOBLE VELOCIDAD DE LECTURA:
   - "Resumen Ejecutivo": Redacta un panorama hiper directo de 1 solo párrafo (aprox. 100 palabras) para lectura rápida de 1 minuto.
   - "Análisis Profundo": Redacta un reporte analítico extenso (aprox. 400 palabras, 3 minutos de lectura). Conecta temas y marca tensiones.
4. JERARQUÍA DE TENDENCIAS ("Efecto Terono"): Extrae un máximo de 5 tendencias principales que resuman la agenda federal. Para cada tendencia, DEBES listar los usuarios de X (@usuario) que se hayan posicionado sobre ese tema.
5. TWEET DESTACADO ("El post del día"): Selecciona la cita de mayor peso político. REGLA CRÍTICA DE TIEMPO: **SOLO** puedes seleccionar un tweet si su fecha corresponde ESTRICTAMENTE AL DÍA DE HOY ({fecha_pantalla}). 
Si no hay nada relevante hoy, `tweet_destacado` debe ser exactamente:
{{
    "usuario": null,
    "texto": "Sin posteos destacados en la jornada de hoy",
    "por_que_es_clave": null,
    "pregunta_openarg": null
}}
Si hay un tweet válido (ESTO SIGNIFICA: a. Es de HOY, y b. Es políticamente relevante, PROHIBIDO usar saludos, efemérides o protocolo), el texto debe ser ORIGINAL y COMPLETO, pero SIN etiquetas previas. Si el tweet comienza con "[RE-TWEET de @autor]", ELIMINA esa etiqueta del campo `texto`, y en el campo `usuario` escribí "@Gobernador (RT de @autor)". Si comienza solo con "[RE-TWEET]" sin indicar autor, eliminá la etiqueta y poné "@Gobernador (RT)".
6. COBERTURA MÍNIMA: Si un gobernador no tiene tweets válidos dentro del filtro temporal, no lo incluyas bajo ninguna circunstancia en la lista de `analisis_por_gobernador`.
7. SEMÁFORO DE CLIMA POLÍTICO: Evalúa el nivel de conflictividad general de la jornada (Nación vs Provincias o entre ellas) y devuelve UNA SOLA PALABRA. DEBE ser estrictamente uno de estos 4 valores: TENSO, NEUTRAL, POSITIVO, CONFLICTO.
8. SEGURIDAD JSON Y COMILLAS (CRÍTICA): El objeto JSON debe ser perfecto. Evitar comillas dobles dentro de los textos; si hacen falta, reemplazarlas por comillas simples ('). Las comillas dobles SOLO deben usarse para las claves y valores estructurales del JSON. Además, los valores nulos deben ser estrictamente el tipo de dato `null` (sin comillas), nunca "null". El campo `tweet_destacado.usuario` debe ser estrictamente de tipo string o null.
9. REGLA DE CITA LITERAL: El campo `frase_fuerte` dentro de `analisis_por_gobernador` DEBE ser exclusivamente una cita textual literal del tweet. Si no existe una cita literal contundente, este campo debe ser estrictamente `null` (sin comillas).

FORMATO DE SALIDA OBLIGATORIO Y LISTAS VACÍAS:
Responde ÚNICAMENTE con un objeto JSON válido. ATENCIÓN: Si no hay tweets válidos analizados, `temas_calientes` debe ser [] y `analisis_por_gobernador` debe ser [] (no inventes datos para rellenar).
La estructura exacta, incluyendo la correcta indentación, debe ser:

{{
    "clima_general": "TENSO",
    "resumen_ejecutivo": "Texto del resumen corto usando 'comillas simples' si es necesario...",
    "analisis_profundo": "Texto del analisis extenso usando 'comillas simples' si es necesario...",
    "temas_calientes": [
        {{
            "tema": "Breve descripcion de la tendencia federal sin comillas dobles",
            "gobernadores_involucrados": ["@Kicillofok", "@ZiliottoSergio", "@maxipullaro"]
        }}
    ],
    "tweet_destacado": {{
        "usuario": "@Gobernador (RT de @autor)",
        "texto": "La cita textual más impactante de HOY, sin la etiqueta de RT inicial",
        "por_que_es_clave": "Breve justificación analítica.",
        "pregunta_openarg": null
    }},
    "analisis_por_gobernador": [
        {{
            "gobernador": "@UsuarioGobernador",
            "temas_mencionados": ["Tema A", "Tema B"],
            "postura_politica": "Análisis de su postura en máximo 3 líneas.",
            "frase_fuerte": null
        }}
    ]
}}

TWEETS A ANALIZAR:
{data_context}
"""

        # --- PLAN A: Gemini (6 intentos, backoff incremental) ---
        print("🚀 Plan A: Enviando los perfiles a Gemini...")
        intentos_max = 6
        espera_base_seg = 300  # empieza en 5 min, sube hasta 15 min

        raw_text = ""
        for i in range(intentos_max):
            try:
                print(f"🚀 Gemini – Intento {i+1} de {intentos_max}...")
                response = client.models.generate_content(
                    model=MODELO_GEMINI,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )
                candidate = response.text.strip() if response.text else ""
                if not candidate:
                    raise ValueError("Gemini devolvió string vacío.")
                raw_text = candidate
                print("✅ Plan A exitoso.")
                # --- Captura de tokens Gemini ---
                try:
                    usage = response.usage_metadata
                    t_in = getattr(usage, 'prompt_token_count', 0) or 0
                    t_out = getattr(usage, 'candidates_token_count', 0) or 0
                    registrar_consumo_tokens(t_in, t_out, modelo=MODELO_GEMINI, turno_corrida=turno)
                except Exception as e_tok:
                    print(f"🔎 No se pudieron extraer metadatos de tokens de Gemini: {e_tok}")
                break

            except Exception as e:
                error_msg = str(e)
                if i < intentos_max - 1:
                    espera = min(espera_base_seg * (i + 1), 900)
                    print(f"⚠️ Gemini falló ({error_msg[:120]}). Reintentando en {espera//60} min...")
                    time.sleep(espera)
                else:
                    print(f"❌ Plan A agotado tras {intentos_max} intentos: {error_msg[:120]}")

        # --- PLAN B: Groq (si Plan A no produjo texto) ---
        if not raw_text:
            print("🔄 Activando Plan B: Groq meta-llama/llama-4-scout-17b-16e-instruct (30k TPM)...")
            groq_key = os.environ.get("GROQ_API_KEY")
            if not groq_key:
                raise EnvironmentError("❌ Falta GROQ_API_KEY y Gemini no respondió.")

            groq_url = "https://api.groq.com/openai/v1/chat/completions"
            groq_headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json",
            }

            # --- Pre-filtro de fechas para Groq (payload reduction ~20k → ~8k tokens) ---
            # Calculamos las referencias temporales en zona Argentina
            ayer_ar = ahora - timedelta(days=1)

            # Formato con cero (ej: "Apr 05") y sin cero (ej: "Apr 5") para blindaje de inicio de mes
            hoy_fmt_cero = ahora.strftime('%b %d')      # "Apr 05"
            hoy_fmt_simple = ahora.strftime('%b %-d')   # "Apr 5"
            ayer_fmt_cero = ayer_ar.strftime('%b %d')
            ayer_fmt_simple = ayer_ar.strftime('%b %-d')

            def _tweet_es_reciente(linea: str) -> bool:
                """Devuelve True si el tweet es de hoy o de ayer después de las 20:00 hs AR."""
                # Buscar el tweet de hoy (cualquier hora)
                if hoy_fmt_cero in linea or hoy_fmt_simple in linea:
                    return True
                # Buscar tweet de ayer: debe existir la fecha de ayer Y una hora >= 20
                if ayer_fmt_cero in linea or ayer_fmt_simple in linea:
                    # Extraemos la hora del timestamp si está presente (formato "HH:" en el string)
                    match_hora = re.search(r'(\d{1,2}):(\d{2}):\d{2}', linea)
                    if match_hora:
                        hora_tweet = int(match_hora.group(1))
                        return hora_tweet >= 20
                    # Si no podemos parsear la hora, incluimos el tweet (criterio conservador)
                    return True
                return False

            lineas_filtradas = [
                linea for linea in data_context.split("\n---\n")
                if linea.strip() and _tweet_es_reciente(linea)
            ]
            data_context_groq = "\n---\n".join(lineas_filtradas)
            chars = len(data_context_groq)
            tweets_count = len(lineas_filtradas)
            print(f"📏 Contexto Groq pre-filtrado por fecha: {chars:,} caracteres ({tweets_count} tweets recientes de hoy/ayer≥20hs)")

            # Si el filtro fue demasiado agresivo y no quedó nada, caer back al data_context completo
            if not data_context_groq.strip():
                print("⚠️ Pre-filtro de fecha no encontró tweets recientes; usando contexto completo como fallback.")
                data_context_groq = data_context

            prompt_groq = prompt
            prompt_marker = "TWEETS A ANALIZAR:\n"
            if prompt_marker in prompt:
                prompt_groq = prompt.rsplit(prompt_marker, 1)[0] + prompt_marker + data_context_groq
            elif data_context and data_context in prompt:
                prompt_groq = prompt.replace(data_context, data_context_groq, 1)
            else:
                print("⚠️ No se pudo inyectar contexto reducido en prompt de Groq; se usará prompt original.")

            groq_payload = {
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                "messages": [
                    {"role": "system", "content": "Return ONLY valid JSON. No markdown. No extra text."},
                    {"role": "user", "content": prompt_groq},
                ],
                "temperature": 0.2,
                "max_tokens": 5000,
                "response_format": {"type": "json_object"},
            }

            def _extraer_texto_groq(resp_json):
                choices = resp_json.get("choices") or []
                if not choices:
                    raise ValueError("Groq devolvió respuesta sin 'choices'.")
                return (choices[0].get("message") or {}).get("content", "").strip()

            try:
                resp_groq = requests.post(groq_url, headers=groq_headers, json=groq_payload, timeout=60)
                resp_groq.raise_for_status()
                resp_groq_json = resp_groq.json()
                raw_text = _extraer_texto_groq(resp_groq_json)
                print("✅ Plan B (Groq con response_format) exitoso.")
                # --- Captura de tokens Groq ---
                try:
                    uso_groq = resp_groq_json.get("usage", {})
                    t_in_g = uso_groq.get("prompt_tokens", 0) or 0
                    t_out_g = uso_groq.get("completion_tokens", 0) or 0
                    registrar_consumo_tokens(t_in_g, t_out_g, modelo="meta-llama/llama-4-scout-17b-16e-instruct", turno_corrida=turno)
                except Exception as e_tok:
                    print(f"🔎 No se pudieron extraer metadatos de tokens de Groq: {e_tok}")
            except requests.HTTPError as http_err:
                # Reintentar sin response_format
                print(f"⚠️ Groq rechazó response_format ({http_err}). Reintentando sin él...")
                groq_payload.pop("response_format", None)
                try:
                    resp_groq = requests.post(groq_url, headers=groq_headers, json=groq_payload, timeout=60)
                    resp_groq.raise_for_status()
                    resp_groq_json = resp_groq.json()
                    raw_text = _extraer_texto_groq(resp_groq_json)
                    print("✅ Plan B (Groq sin response_format) exitoso.")
                    # --- Captura de tokens Groq ---
                    try:
                        uso_groq = resp_groq_json.get("usage", {})
                        t_in_g = uso_groq.get("prompt_tokens", 0) or 0
                        t_out_g = uso_groq.get("completion_tokens", 0) or 0
                        registrar_consumo_tokens(t_in_g, t_out_g, modelo="meta-llama/llama-4-scout-17b-16e-instruct", turno_corrida=turno)
                    except Exception as e_tok:
                        print(f"🔎 No se pudieron extraer metadatos de tokens de Groq: {e_tok}")
                except Exception as groq_err:
                    print(f"❌ Plan B también falló sin response_format: {groq_err}")
                    raise groq_err

        if not raw_text:
            raise RuntimeError("❌ Ni Gemini ni Groq devolvieron respuesta.")

        # --- LIMPIEZA DE SEGURIDAD PARA EL JSON ---
        if raw_text and raw_text.startswith("```"):
            raw_text = raw_text.replace("```json", "").replace("```", "").strip()
        
        try:
            resumen_data = json.loads(raw_text)
        except json.JSONDecodeError as e:
            print(f"❌ Error de sintaxis en el JSON de la IA: {e}")
            with open(f'data/{fecha_hoy_str}_ERROR_IA.txt', 'w', encoding='utf-8') as f:
                f.write(raw_text)
            print(f"⚠️ Se guardó el error en data/{fecha_hoy_str}_ERROR_IA.txt para revisión.")
            raise e

        # --- 5. AUDITORÍA OPENARG (FRANCOTIRADOR) ---
        if "tweet_destacado" in resumen_data:
            tweet_del_dia = resumen_data["tweet_destacado"]
            pregunta = tweet_del_dia.get("pregunta_openarg")
            
            # Seteamos null por defecto para evitar errores en la web
            tweet_del_dia["verificacion_openarg"] = None
        
            # Validamos que la pregunta exista y no sea la palabra "null"
            if pregunta and str(pregunta).lower() != "null":
                print(f"🔍 Disparando a OpenArg: {pregunta}")
                openarg_key = os.environ.get("OPENARG_API_KEY")
                
                if openarg_key:
                    url_openarg = "https://api.openarg.org/api/v1/ask"
                    headers = {"Authorization": f"Bearer {openarg_key}", "Content-Type": "application/json"}
                    try:
                        resp_openarg = requests.post(url_openarg, headers=headers, json={"question": pregunta}, timeout=30)
                        if resp_openarg.status_code == 200:
                            respuesta = resp_openarg.json().get("answer", "")
                            # Filtramos las respuestas que no tienen datos reales
                            if "no reflejan" not in respuesta and "Los datos disponibles son de" not in respuesta:
                                # Guardamos la respuesta (limitada a 200 caracteres para la UI)
                                tweet_del_dia["verificacion_openarg"] = respuesta[:200] + "..." if len(respuesta) > 200 else respuesta
                                print("✅ Dato OpenArg agregado al JSON.")
                            else:
                                print("⚠️ OpenArg no devolvió datos actuales. Se omite.")
                    except Exception as e:
                        print(f"⚠️ Error de conexión con OpenArg: {e}")
                else:
                    print("⚠️ OPENARG_API_KEY no encontrada en Secrets.")

        # 6. Guardar el Análisis
        ruta_analisis = f'data/{fecha_hoy_str}_analisis_{turno}.json'
        with open(ruta_analisis, 'w', encoding='utf-8') as f:
            json.dump(resumen_data, f, ensure_ascii=False, indent=4)

        print(f"✅ ¡Éxito! Archivo de análisis creado: {ruta_analisis}")

    except Exception as e:
        print(f"❌ Error fatal: {str(e)}")
        raise e

if __name__ == "__main__":
    ejecutar_monitoreo()
