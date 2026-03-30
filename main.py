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
        # Capturamos hasta 15 tweets y les pegamos la fecha original
        if isinstance(data, list):
            for t in data[:15]: 
                if 'text' in t:
                    fecha = t.get('created_at', 'Fecha desconocida')
                    tweets_texto.append(f"(Publicado: {fecha}) {t['text']}")
        elif isinstance(data, dict) and 'timeline' in data:
            for t in data['timeline'][:15]:
                if 'text' in t:
                    fecha = t.get('created_at', 'Fecha desconocida')
                    tweets_texto.append(f"(Publicado: {fecha}) {t['text']}")
                    
        return tweets_texto
    except Exception as e:
        print(f"Error buscando a @{handle}: {e}")
        return []

def ejecutar_monitoreo():
    try:
        with open('gobernadores.json', 'r', encoding='utf-8') as f:
            gobernadores = json.load(f)

        # Leemos la lista completa de gobernadores
        handles
