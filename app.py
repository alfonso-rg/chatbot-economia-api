import csv
import io
import json
import os
from typing import List, Dict

from flask import Flask, render_template, request, jsonify, session, send_file
from openai import OpenAI


app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-me")


CHAT_SESSION_KEY = "chat_history"
SYSTEM_PROMPT = (
    "Eres un asistente experto en economía española. Responde de forma clara, "
    "rigurosa y útil para público general y profesional. Cuando sea relevante, "
    "incluye contexto de España y matices."
)


def get_chat_history() -> List[Dict[str, str]]:
    return session.get(CHAT_SESSION_KEY, [])


def set_chat_history(history: List[Dict[str, str]]) -> None:
    session[CHAT_SESSION_KEY] = history


def json_error(message: str, status_code: int = 500):
    return jsonify({"error": message}), status_code


def extract_openai_error(exc: Exception) -> str:
    details = str(exc).strip()
    if not details:
        details = exc.__class__.__name__
    return f"Error al contactar con OpenAI: {details}"


def get_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Falta la variable de entorno OPENAI_API_KEY")
    return OpenAI(api_key=api_key)


def analyze_single_text(text: str) -> Dict[str, str]:
    client = get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "Analiza el sentimiento de un texto en español y devuelve SOLO JSON "
                    "válido con las claves: sentimiento (positivo|negativo|neutro), "
                    "confianza (número entre 0 y 100), explicacion (máx 2 frases)."
                ),
            },
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    parsed = json.loads(raw)

    sentimiento = str(parsed.get("sentimiento", "neutro")).lower()
    if sentimiento not in {"positivo", "negativo", "neutro"}:
        sentimiento = "neutro"

    try:
        confianza = float(parsed.get("confianza", 50))
    except (TypeError, ValueError):
        confianza = 50.0

    confianza = max(0.0, min(100.0, confianza))

    explicacion = str(parsed.get("explicacion", "No se pudo generar explicación.")).strip()

    return {
        "sentimiento": sentimiento,
        "confianza": round(confianza, 2),
        "explicacion": explicacion,
    }


@app.route("/")
def index():
    return render_template("chat.html", active="chat")


@app.route("/chat")
def chat_page():
    return render_template("chat.html", active="chat")


@app.route("/sentimientos")
def sentiment_page():
    return render_template("sentiment.html", active="sentimientos")


@app.route("/api/chat/history", methods=["GET"])
def chat_history():
    return jsonify({"history": get_chat_history()})


@app.route("/api/chat", methods=["POST"])
def chat_api():
    payload = request.get_json(silent=True) or {}
    user_message = str(payload.get("message", "")).strip()

    if not user_message:
        return jsonify({"error": "El mensaje no puede estar vacío."}), 400

    history = get_chat_history()
    history.append({"role": "user", "content": user_message})
    model_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history

    try:
        client = get_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.4,
            messages=model_messages,
        )
        assistant_reply = (response.choices[0].message.content or "").strip()
        if not assistant_reply:
            return json_error("El modelo no devolvió contenido.", 502)
    except RuntimeError as exc:
        return json_error(str(exc), 500)
    except Exception as exc:
        return json_error(extract_openai_error(exc), 502)

    history.append({"role": "assistant", "content": assistant_reply})
    set_chat_history(history)

    return jsonify({"reply": assistant_reply, "history": history})


@app.route("/api/chat/reset", methods=["POST"])
def reset_chat():
    session.pop(CHAT_SESSION_KEY, None)
    return jsonify({"ok": True})


@app.route("/api/sentiment/text", methods=["POST"])
def sentiment_text():
    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text", "")).strip()

    if not text:
        return jsonify({"error": "Debes proporcionar un texto para analizar."}), 400

    try:
        result = analyze_single_text(text)
    except RuntimeError as exc:
        return json_error(str(exc), 500)
    except Exception as exc:
        return json_error(extract_openai_error(exc), 502)

    return jsonify(result)


@app.route("/api/sentiment/csv", methods=["POST"])
def sentiment_csv():
    if "file" not in request.files:
        return jsonify({"error": "No se encontró el archivo CSV."}), 400

    file = request.files["file"]
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "El archivo debe tener formato .csv"}), 400

    raw = file.stream.read().decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(raw))

    if not reader.fieldnames:
        return jsonify({"error": "No se detectaron columnas en el CSV."}), 400

    first_column = reader.fieldnames[0]
    results = []

    try:
        for row in reader:
            phrase = (row.get(first_column) or "").strip()
            if not phrase:
                continue
            analysis = analyze_single_text(phrase)
            results.append(
                {
                    "frase": phrase,
                    "sentimiento": analysis["sentimiento"],
                    "confianza": analysis["confianza"],
                }
            )
    except RuntimeError as exc:
        return json_error(str(exc), 500)
    except Exception as exc:
        return json_error(extract_openai_error(exc), 502)

    if not results:
        return jsonify({"error": "No se encontraron frases válidas para analizar."}), 400

    out_buffer = io.StringIO()
    writer = csv.DictWriter(out_buffer, fieldnames=["frase", "sentimiento", "confianza"])
    writer.writeheader()
    writer.writerows(results)

    response_buffer = io.BytesIO(out_buffer.getvalue().encode("utf-8"))
    response_buffer.seek(0)

    return send_file(
        response_buffer,
        mimetype="text/csv",
        as_attachment=True,
        download_name="analisis_sentimientos.csv",
    )


@app.errorhandler(500)
def handle_internal_error(_error):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Error interno del servidor."}), 500
    return "Error interno del servidor", 500


@app.errorhandler(404)
def handle_not_found(_error):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Endpoint no encontrado."}), 404
    return "No encontrado", 404




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
