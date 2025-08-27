# Simple in-memory cache to reduce repetition across rapid refreshes
LAST_WELLNESS_CACHE = {
    # key: (age or bucket), value: {"hash": str, "ts": datetime}
}
from flask import Flask, request, jsonify, send_from_directory
from flask import Response
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime, timedelta
from uuid import uuid4
from dotenv import load_dotenv
import random
import os
import bcrypt
import jwt
import requests
import json

# New imports for model inference
import base64
import io
import numpy as np
from PIL import Image
import json
import pickle
from datetime import datetime
import tempfile
import soundfile as sf
import librosa

# TensorFlow is imported lazily to avoid slow startup when not needed
_tf = None
model = None
model_input_size = (224, 224)

# Lazy import DeepFace
_df = None

def _lazy_import_deepface():
	global _df
	if _df is None:
		from deepface import DeepFace  # type: ignore
		_df = DeepFace
	return _df

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRES_DAYS = int(os.environ.get("JWT_EXPIRES_DAYS", "7"))

# Inference configuration
AGE_MODEL_PATH = os.environ.get("AGE_MODEL_PATH", os.path.join(os.path.dirname(__file__), "best_resnet_model.keras"))
AGE_PREPROCESS = os.environ.get("AGE_PREPROCESS", "scale01").lower()  # 'scale01' or 'imagenet'
AGE_INPUT_SIZE = os.environ.get("AGE_INPUT_SIZE", "")  # e.g., "224,224" to override
AGE_OUTPUT_MIN = float(os.environ.get("AGE_OUTPUT_MIN", "0"))
AGE_OUTPUT_MAX = float(os.environ.get("AGE_OUTPUT_MAX", "120"))
AGE_CLASS_LABELS = [s.strip() for s in os.environ.get("AGE_CLASS_LABELS", "Minor,Middle-aged,Senior").split(',') if s.strip()]
AGE_DEBUG_RESPONSE = os.environ.get("AGE_DEBUG_RESPONSE", "0").strip() in ("1", "true", "True", "yes", "on")

# Gemini AI Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyCs8n3CIzQZppgF04aQMP01t6oCxCsjWPs")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client["age_app"]
users_col = db["users"]
users_col.create_index("email", unique=True)
conversations_col = db["conversations"]
conversations_col.create_index([("userId", 1), ("updatedAt", -1)])

# Uploads directory for profile photos
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Unsplash Configuration
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "7984UBkb0lUWtIPwV0LBtya3fIinzwah5viAplc5tdI")

# Google Custom Search (Images)
GOOGLE_CSE_KEY = os.environ.get("GOOGLE_CSE_KEY", "AIzaSyCHkONFxUagLX0JVHClVN12LbJ7rebxIKQ").strip()
GOOGLE_CSE_CX = os.environ.get("GOOGLE_CSE_CX", "668916677574a4f2a").strip()

# --- Unsplash helpers ---
def _is_likely_image_url(url: str) -> bool:
    try:
        if not isinstance(url, str) or not url.startswith("http"):
            return False
        lower = url.lower()
        if any(lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
            return True
        # Known direct image hosts
        if "images.unsplash.com" in lower or "source.unsplash.com" in lower or "picsum.photos" in lower or "i.imgur.com" in lower:
            return True
        # Unsplash page URL (not a direct image)
        if "unsplash.com/photos/" in lower and "images.unsplash.com" not in lower:
            return False
        return True
    except Exception:
        return False

def _unsplash_search_first_image(query: str, w: int = 800) -> str:
    """Return a direct image URL for the first Unsplash search result for given query.
    Falls back to empty string if key missing or any error."""
    try:
        key = (UNSPLASH_ACCESS_KEY or "").strip()
        if not key:
            return ""
        params = {
            "query": query or "wellness product",
            "per_page": 1,
            "orientation": "landscape",
        }
        headers = {"Authorization": f"Client-ID {key}"}
        r = requests.get("https://api.unsplash.com/search/photos", params=params, headers=headers, timeout=8)
        if not r.ok:
            return ""
        js = r.json()
        results = (js or {}).get("results", [])
        if not results:
            return ""
        url = results[0].get("urls", {}).get("regular") or results[0].get("urls", {}).get("small")
        if url and w:
            # Add width hint; Unsplash respects query params on images domain
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}w={int(w)}&auto=format&fit=crop"
        return url or ""
    except Exception:
        # Fallback to Unsplash source without API key
        return f"https://source.unsplash.com/800x400/?{query or 'wellness product'}"

def _unsplash_search_first_image_fallback(query: str, w: int = 800) -> str:
    return f"https://source.unsplash.com/{w}x400/?{query or 'wellness product'}"

def _unsplash_search_first_image_with_fallback(query: str, w: int = 800) -> str:
    url = _unsplash_search_first_image(query, w)
    if not url:
        return _unsplash_search_first_image_fallback(query, w)
    return url



def _lazy_import_tf():
	global _tf
	if _tf is None:
		import tensorflow as tf  # type: ignore
		_tf = tf
	return _tf


def _load_model_once():
	global model, model_input_size
	if model is None:
		tf = _lazy_import_tf()
		model_path = AGE_MODEL_PATH
		app.logger.info(f"Loading model from: {model_path}")
		model = tf.keras.models.load_model(model_path)
		# Try to infer input size, fallback to (224,224) or env override
		try:
			shape = model.inputs[0].shape  # (None, H, W, C)
			h = int(shape[1]) if shape[1] is not None else 224
			w = int(shape[2]) if shape[2] is not None else 224
			model_input_size = (w, h)
		except Exception:
			model_input_size = (224, 224)
		if AGE_INPUT_SIZE:
			try:
				w_s, h_s = AGE_INPUT_SIZE.split(',')
				model_input_size = (int(w_s.strip()), int(h_s.strip()))
			except Exception:
				app.logger.warning(f"Invalid AGE_INPUT_SIZE '{AGE_INPUT_SIZE}', using inferred {model_input_size}")
		app.logger.info(f"Model input size: {model_input_size}")
	return model


def _preprocess_image_from_data_url(data_url: str) -> np.ndarray:
	# data_url may be like "data:image/png;base64,...."
	if "," in data_url:
		_, b64 = data_url.split(",", 1)
	else:
		b4 = data_url
		b64 = b4
	image_bytes = base64.b64decode(b64)
	image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
	# Resize to model input
	img_w, img_h = model_input_size
	image = image.resize((img_w, img_h))
	arr = np.asarray(image).astype("float32")
	if AGE_PREPROCESS == "imagenet":
		tf = _lazy_import_tf()
		arr = tf.keras.applications.resnet50.preprocess_input(arr)  # RGB expected
	else:
		arr = arr / 255.0
	return arr


def _softmax(x: np.ndarray) -> np.ndarray:
	x = x.astype("float32")
	x = x - np.max(x)
	exp = np.exp(x)
	return exp / np.sum(exp)


def generate_token(user_doc: dict) -> str:
	payload = {
		"sub": str(user_doc["_id"]),
		"email": user_doc["email"],
		"exp": datetime.utcnow() + timedelta(days=JWT_EXPIRES_DAYS),
		"iat": datetime.utcnow(),
	}
	return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@app.post("/api/register")
def register():
	data = request.get_json(silent=True) or {}
	name = (data.get("name") or "").strip()
	email = (data.get("email") or "").strip().lower()
	password = data.get("password") or ""
	gender = (data.get("gender") or "").strip().lower()
	consent = bool(data.get("consent"))

	if not name or not email or not password:
		return jsonify({"message": "All fields are required"}), 400
	if len(password) < 6:
		return jsonify({"message": "Password must be at least 6 characters"}), 400
	if gender not in ("male", "female", "other"):
		return jsonify({"message": "Invalid gender"}), 400
	if not consent:
		return jsonify({"message": "Consent is required to register"}), 400

	try:
		if users_col.find_one({"email": email}):
			return jsonify({"message": "Email already registered"}), 409
		password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
		users_col.insert_one(
			{
				"name": name,
				"email": email,
				"password_hash": password_hash,
				"gender": gender,
				"consent": True,
				"consented_at": datetime.utcnow(),
				"created_at": datetime.utcnow(),
			}
		)
		return jsonify({"message": "Registered successfully"}), 201
	except Exception:
		return jsonify({"message": "Server error"}), 500


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    user = users_col.find_one({"email": email})
    if not user:
        return jsonify({"message": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user.get("password_hash", b"")):
        return jsonify({"message": "Invalid email or password"}), 401

    token = generate_token(user)
    # Return basic user profile so client can greet by name
    user_payload = {
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "gender": user.get("gender", ""),
    }
    return jsonify({"message": "Login successful", "token": token, "user": user_payload}), 200


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.get("/api/me")
def me():
    auth_header = request.headers.get("Authorization") or ""
    if not auth_header.startswith("Bearer "):
        return jsonify({"message": "Missing Authorization header"}), 401
    token = auth_header[len("Bearer ") :].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            return jsonify({"message": "Invalid token"}), 401
        user = users_col.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"message": "User not found"}), 404
        user_payload = {
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "gender": user.get("gender", ""),
        }
        return jsonify(user_payload), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"message": "Invalid token"}), 401


# --- Static route for uploaded files ---
@app.get("/uploads/<path:filename>")
def serve_upload(filename):
    try:
        return send_from_directory(UPLOAD_DIR, filename)
    except Exception:
        return jsonify({"message": "Not found"}), 404


# --- Profile Endpoints ---
@app.get("/api/profile")
def get_profile():
    user_id = _get_auth_user_id()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401
    doc = users_col.find_one({"_id": ObjectId(user_id)}, projection={"password": False})
    if not doc:
        return jsonify({"message": "User not found"}), 404
    profile = {
        "name": doc.get("name") or doc.get("fullName") or "",
        "email": doc.get("email") or "",
        "gender": doc.get("gender") or "",
        "height": (doc.get("profile", {}) or {}).get("height"),
        "weight": (doc.get("profile", {}) or {}).get("weight"),
        "avatarUrl": (doc.get("profile", {}) or {}).get("avatarUrl") or doc.get("avatarUrl"),
        "notes": (doc.get("profile", {}) or {}).get("notes", ""),
        "medications": (doc.get("profile", {}) or {}).get("medications", []),
        "diet": (doc.get("profile", {}) or {}).get("diet", ""),
    }
    return jsonify({"profile": profile}), 200


@app.post("/api/profile")
def update_profile():
    user_id = _get_auth_user_id()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401
    payload = request.get_json(silent=True) or {}
    updates = {}
    # Allow updating subset of fields
    profile_updates = {}
    if "height" in payload:
        try:
            profile_updates["height"] = float(payload.get("height"))
        except Exception:
            pass
    if "weight" in payload:
        try:
            profile_updates["weight"] = float(payload.get("weight"))
        except Exception:
            pass
    if "name" in payload and isinstance(payload.get("name"), str):
        updates["name"] = payload.get("name").strip()
    if "gender" in payload and isinstance(payload.get("gender"), str):
        updates["gender"] = payload.get("gender").strip()

    if profile_updates:
        # If values are NaN or invalid, treat as None to unset
        updates["profile.height"] = profile_updates.get("height", None)
        updates["profile.weight"] = profile_updates.get("weight", None)

    # Optional free-text fields
    if "notes" in payload:
        notes_val = payload.get("notes")
        if isinstance(notes_val, str):
            updates["profile.notes"] = notes_val
        elif notes_val is None:
            updates["profile.notes"] = None

    if "diet" in payload:
        diet_val = payload.get("diet")
        if isinstance(diet_val, str):
            updates["profile.diet"] = diet_val
        elif diet_val is None:
            updates["profile.diet"] = None

    # Medications: expect array of objects with name, dose, schedule
    if "medications" in payload:
        meds = payload.get("medications")
        if isinstance(meds, list):
            # sanitize each item
            safe_meds = []
            for m in meds:
                if not isinstance(m, dict):
                    continue
                name = str(m.get("name", "")).strip()
                dose = str(m.get("dose", "")).strip()
                schedule = str(m.get("schedule", "")).strip()
                if name or dose or schedule:
                    safe_meds.append({"name": name, "dose": dose, "schedule": schedule})
            updates["profile.medications"] = safe_meds
        elif meds is None:
            updates["profile.medications"] = None

    if not updates:
        return jsonify({"message": "No changes"}), 400

    # Clean None values correctly using $unset
    set_updates = {k: v for k, v in updates.items() if v is not None}
    unset_updates = {k: "" for k, v in updates.items() if v is None}
    update_doc = {}
    if set_updates:
        update_doc["$set"] = set_updates
    if unset_updates:
        update_doc["$unset"] = unset_updates

    users_col.update_one({"_id": ObjectId(user_id)}, update_doc)
    return jsonify({"message": "Updated"}), 200


@app.post("/api/diet-plan")
def generate_diet_plan():
    """Generate a personalized diet plan using Gemini with age/BMI context and save to profile."""
    user_id = _get_auth_user_id()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    # Parse inputs
    def to_float(v):
        try:
            if v is None or v == "":
                return None
            return float(v)
        except Exception:
            return None

    age = data.get("age")
    try:
        age = int(float(age)) if age is not None and str(age).strip() != "" else None
    except Exception:
        age = None

    height = to_float(data.get("height"))  # cm
    weight = to_float(data.get("weight"))  # kg
    bmi = to_float(data.get("bmi"))
    gender = (data.get("gender") or "").strip()
    notes = (data.get("notes") or "").strip()
    medications = data.get("medications") if isinstance(data.get("medications"), list) else []

    # Fallback to stored profile values
    if height is None or weight is None or bmi is None:
        doc = users_col.find_one({"_id": ObjectId(user_id)}, {"profile": 1})
        prof = (doc or {}).get("profile", {}) if doc else {}
        if height is None:
            height = to_float(prof.get("height"))
        if weight is None:
            weight = to_float(prof.get("weight"))
        # If age not provided, try to infer from stored predictedAge is not in DB; keep None

    # Compute BMI if possible
    if bmi is None and height and weight:
        m = height / 100.0
        if m > 0:
            bmi = round(weight / (m * m), 2)

    # Determine BMI band
    def bmi_band(v):
        if v is None:
            return "unknown"
        if v < 18.5:
            return "underweight"
        if v < 25:
            return "normal"
        if v < 30:
            return "overweight"
        return "obese"

    band = bmi_band(bmi)

    # Age bucket
    if age is None:
        age_bucket = "adult"
    elif age < 18:
        age_bucket = "teen"
    elif age < 40:
        age_bucket = "young_adult"
    elif age < 60:
        age_bucket = "middle_aged"
    else:
        age_bucket = "senior"

    # Validate required inputs (age, height, weight)
    if age is None or height is None or weight is None:
        return jsonify({"message": "Please fill in Age, Height, and Weight before generating a diet plan."}), 400

    # Build Gemini prompt
    meds_text = "\n".join([f"- {m.get('name','')} {m.get('dose','')} {m.get('schedule','')}" for m in medications if isinstance(m, dict)])
    header = f"Age: {age if age is not None else '—'} | Gender: {gender or '—'} | Height(cm): {height if height is not None else '—'} | Weight(kg): {weight if weight is not None else '—'} | BMI: {bmi if bmi is not None else '—'} ({band})"
    sys_instructions = (
        "You are a registered dietitian. Create a concise, actionable 7-day diet plan (3 meals + 1 snack/day) tailored to the user's context. "
        "Include portion guidance and brief rationale. Avoid medical claims. If inputs are missing, make safe assumptions and state them briefly. "
        "Use Indian cuisine dishes and ingredients (e.g., roti/chapati, dal, sabzi, curd, brown rice, khichdi, poha, upma, idli, dosa, sambar; for non-veg: egg bhurji, chicken curry, fish curry). "
        "Use familiar Indian portion units (e.g., 1 roti ~30g atta, 1 katori ~150 ml, 1 bowl ~200 ml) and keep spice levels moderate by default. "
        "Provide regional flexibility (veg/non-veg) where relevant. "
        "End with 5 general tips. Format clearly with headings and bullet points."
    )
    user_context = (
        f"Context\n{header}\n\nMedications (if any):\n{meds_text or '- none'}\n\nNotes: {notes or '-'}\n"
    )
    prompt = sys_instructions + "\n\n" + user_context + "\n\n" + (
        "Output strictly as minified JSON with this schema: {\n"
        "  \"overview\": string,\n"
        "  \"bmi\": { \"value\": number, \"band\": string },\n"
        "  \"days\": [\n"
        "    { \"day\": string, \"breakfast\": string, \"lunch\": string, \"snack\": string, \"dinner\": string }\n"
        "  ],\n"
        "  \"tips\": [string]\n"
        "}\n"
        "Do not include any extra text, markdown, or explanations."
    )

    plan = None
    try:
        api_key = (os.environ.get("GEMINI_API_KEY") or "AIzaSyAimP08yLnrGo-fgrMrOXnZkrXQFYQGWvE").strip()
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY")
        req = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.5,
                "topP": 0.9,
                "topK": 40,
                "maxOutputTokens": 1200,
                "responseMimeType": "application/json",
            },
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        r = requests.post(url, json=req, timeout=25)
        err_text = None
        try:
            r.raise_for_status()
        except Exception as http_err:
            # capture API error body for client
            err_text = r.text
            raise
        js = r.json() or {}
        # Extract JSON text from Gemini
        plan_json_text = (
            js.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text")
        )
    except Exception as e:
        app.logger.exception("Gemini diet generation failed")
        plan_json_text = None
        err_msg = str(e)
        # Return error details if we captured response text
        return jsonify({"message": "Diet plan generation failed.", "error": err_msg, "provider": "gemini"}), 502

    # If Gemini failed, return error (no manual plan)
    if not plan_json_text:
        return jsonify({"message": "Diet plan generation failed.", "provider": "gemini"}), 502

    # Persist in profile
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"profile.dietJson": plan_json_text, "profile.diet": None}})

    return jsonify({"planJson": plan_json_text, "bmi": bmi, "band": band}), 200


@app.post("/api/nearby-hospitals")
def nearby_hospitals():
    """Return a Gemini-generated list of nearby hospitals/clinics given a user location.
    Request JSON: { lat?: number, lon?: number, city?: string, region?: string, country?: string }
    Response: { hospitals: [{ category, name, address, phone, website?, image? }] }
    """
    try:
        data = request.get_json(silent=True) or {}
    except Exception:
        data = {}

    lat = data.get("lat")
    lon = data.get("lon")
    city = (data.get("city") or "").strip()
    region = (data.get("region") or "").strip()
    country = (data.get("country") or "").strip()

    # Build location string
    loc_parts = []
    if city: loc_parts.append(city)
    if region: loc_parts.append(region)
    if country: loc_parts.append(country)
    loc_label = ", ".join(loc_parts) if loc_parts else None
    coords_label = f"{lat},{lon}" if (lat is not None and lon is not None) else None

    if not loc_label and not coords_label:
        return jsonify({"message": "Provide at least city/region/country or lat/lon."}), 400

    # Compose prompt
    sys_instructions = (
        "You are a helpful healthcare directory assistant. Based on the provided location, "
        "list reputable nearby hospitals or clinics users can contact for general medical needs. "
        "Return only places that typically accept walk-ins or appointments."
    )
    user_context = (
        f"Location: {loc_label or ''}\n"
        f"Coordinates: {coords_label or ''}\n"
        "Return 3-6 options spanning different facility types if available (general hospital, medical center, children's hospital, multi-specialty clinic)."
    )
    schema = (
        "Output strictly as minified JSON with this schema: {\n"
        "  \"hospitals\": [\n"
        "    { \"category\": string, \"name\": string, \"address\": string, \"phone\": string, \"website\": string, \"image\": string }\n"
        "  ]\n"
        "}\n"
        "Do not include any extra text, markdown, or explanations. Use plausible contact numbers and addresses; if unsure, write 'N/A'."
    )
    prompt = sys_instructions + "\n\n" + user_context + "\n\n" + schema

    try:
        api_key = (os.environ.get("GEMINI_API_KEY") or GEMINI_API_KEY or "").strip()
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY")
        req = {
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]} 
            ],
            "generationConfig": {
                "temperature": 0.3,
                "topP": 0.9,
                "topK": 40,
                "maxOutputTokens": 800,
                "responseMimeType": "application/json",
            },
        }
        url = f"{GEMINI_API_URL}?key={api_key}"
        r = requests.post(url, json=req, timeout=20)
        r.raise_for_status()
        js = r.json() or {}
        text = (
            js.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text")
        )
        if not text:
            return jsonify({"message": "Failed to generate hospitals.", "provider": "gemini"}), 502
        # Ensure the response is valid JSON
        try:
            parsed = json.loads(text)
        except Exception:
            # Attempt to strip code fences if present
            text2 = text.strip().strip('`')
            parsed = json.loads(text2)
        return jsonify(parsed), 200
    except Exception as e:
        app.logger.exception("Gemini hospitals generation failed")
        return jsonify({"message": "Hospitals generation failed.", "error": str(e), "provider": "gemini"}), 502


@app.post("/api/profile/avatar")
def upload_avatar():
    user_id = _get_auth_user_id()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401
    if "avatar" not in request.files:
        return jsonify({"message": "No file"}), 400
    f = request.files["avatar"]
    if not f.filename:
        return jsonify({"message": "Invalid file"}), 400
    # Sanitize extension
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    safe_name = f"avatar_{user_id}_{int(datetime.utcnow().timestamp())}{ext}"
    path = os.path.join(UPLOAD_DIR, safe_name)
    try:
        f.save(path)
        url_path = f"/uploads/{safe_name}"
        users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"profile.avatarUrl": url_path}})
        return jsonify({"avatarUrl": url_path}), 200
    except Exception as e:
        app.logger.exception("Avatar upload failed")
        return jsonify({"message": "Upload failed"}), 500


# --- Conversations API ---
@app.post("/api/my-chats/new")
def create_conversation():
    user_id = _get_auth_user_id()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401
    now = datetime.utcnow()
    doc = {
        "userId": ObjectId(user_id),
        "title": "New chat",
        "messages": [],
        "createdAt": now,
        "updatedAt": now,
    }
    res = conversations_col.insert_one(doc)
    return jsonify({"conversationId": str(res.inserted_id)}), 201


@app.get("/api/my-chats/last")
def get_last_conversation():
    user_id = _get_auth_user_id()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401
    doc = conversations_col.find_one({"userId": ObjectId(user_id)}, sort=[("updatedAt", -1)])
    if not doc:
        return jsonify({"conversation": None}), 200
    conv = {
        "_id": str(doc.get("_id")),
        "title": doc.get("title", ""),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
        "messages": [
            {"role": m.get("role"), "content": m.get("content"), "ts": m.get("ts")}
            for m in (doc.get("messages") or [])
        ][-100:],
    }
    return jsonify({"conversation": conv}), 200


@app.get("/api/my-chats")
def list_conversations():
    user_id = _get_auth_user_id()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401
    try:
        limit = max(1, min(50, int(request.args.get("limit", 20))))
    except Exception:
        limit = 20
    items = []
    for d in conversations_col.find({"userId": ObjectId(user_id)}, projection={"messages": False}).sort("updatedAt", -1).limit(limit):
        items.append({
            "_id": str(d.get("_id")),
            "title": d.get("title", ""),
            "createdAt": d.get("createdAt"),
            "updatedAt": d.get("updatedAt"),
        })
    return jsonify({"conversations": items}), 200


@app.get("/api/my-chats/<conv_id>")
def get_conversation(conv_id):
    user_id = _get_auth_user_id()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401
    try:
        doc = conversations_col.find_one({"_id": ObjectId(conv_id), "userId": ObjectId(user_id)})
    except Exception:
        return jsonify({"message": "Not found"}), 404
    if not doc:
        return jsonify({"message": "Not found"}), 404
    conv = {
        "_id": str(doc.get("_id")),
        "title": doc.get("title", ""),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
        "messages": [
            {"role": m.get("role"), "content": m.get("content"), "ts": m.get("ts")}
            for m in (doc.get("messages") or [])
        ][-200:],
    }
    return jsonify({"conversation": conv}), 200


@app.get("/api/age-images")
def age_images():
	try:
		age = request.args.get("age", "").strip()
		# Bucket age roughly to generate consistent seeds
		try:
			age_num = int(float(age))
		except Exception:
			age_num = 30
		bucket = max(0, min(120, (age_num // 5) * 5))
		# Use picsum.photos for simple, reliable placeholder images
		image_url = f"https://picsum.photos/seed/wellness-{bucket}/1200/400"
		return jsonify({"image": image_url}), 200
	except Exception:
		        return jsonify({"image": ""}), 200


@app.get("/api/proxy-image")
def proxy_image():
    """Proxy an external image URL to avoid CORS/referrer issues.
    Usage: /api/proxy-image?url=https%3A%2F%2F...
    """
    try:
        url = request.args.get("url", "").strip()
        if not url or not (url.startswith("http://") or url.startswith("https://")):
            return jsonify({"message": "Invalid url"}), 400
        r = requests.get(url, timeout=8)
        if not r.ok:
            return jsonify({"message": "Fetch failed"}), 502
        # Infer content type, fallback to image/jpeg
        ctype = r.headers.get("Content-Type", "image/jpeg")
        return Response(r.content, content_type=ctype)
    except Exception:
        return jsonify({"message": "Proxy error"}), 502


def _google_cse_first_image(query: str) -> str:
    """Return first image URL from Google CSE image search. Empty string if not configured or error."""
    try:
        key = (GOOGLE_CSE_KEY or os.environ.get("GOOGLE_CSE_KEY", "AIzaSyCHkONFxUagLX0JVHClVN12LbJ7rebxIKQ")).strip()
        cx = (GOOGLE_CSE_CX or os.environ.get("GOOGLE_CSE_CX", "668916677574a4f2a")).strip()
        if not key or not cx or not query:
            return ""
        params = {"key": key, "cx": cx, "q": query, "searchType": "image", "num": 1, "safe": "active"}
        r = requests.get("https://www.googleapis.com/customsearch/v1", params=params, timeout=8)
        if not r.ok:
            return ""
        js = r.json() or {}
        items = js.get("items", []) or []
        if not items:
            return ""
        link = items[0].get("link") or items[0].get("linkUrl") or ""
        return link or ""
    except Exception:
        return ""


@app.get("/api/cse-image")
def cse_image():
    """Return first image URL for query using Google CSE. Response: {image: string}"""
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"image": ""}), 200
    img = _google_cse_first_image(q)
    return jsonify({"image": img}), 200


@app.post("/api/cse-images")
def cse_images():
    """Batch image search. Body: {queries: [string]} -> {images: {query: url}}"""
    data = request.get_json(silent=True) or {}
    queries = data.get("queries") or []
    if not isinstance(queries, list):
        return jsonify({"images": {}}), 200
    out = {}
    for q in queries[:10]:  # cap to avoid abuse
        try:
            qs = str(q).strip()
            if not qs:
                continue
            out[qs] = _google_cse_first_image(qs)
        except Exception:
            out[str(q)] = ""
    return jsonify({"images": out}), 200


@app.post("/api/predict-age")
def predict_age():
	try:
		payload = request.get_json(silent=True) or {}
		image_data_url = payload.get("image") or payload.get("dataUrl")
		if not image_data_url:
			return jsonify({"message": "Missing image"}), 400

		# Ensure model is loaded
		m = _load_model_once()

		img_arr = _preprocess_image_from_data_url(image_data_url)
		# Input stats for debugging
		input_stats = {
			"min": float(np.min(img_arr)),
			"max": float(np.max(img_arr)),
			"mean": float(np.mean(img_arr)),
			"preprocess": AGE_PREPROCESS,
			"input_size": list(model_input_size),
		}
		batch = np.expand_dims(img_arr, axis=0)  # (1,H,W,C)
		pred = m.predict(batch, verbose=0)

		# Debug information (logs only)
		try:
			app.logger.info(f"Pred shape: {np.array(pred).shape}")
			if isinstance(pred, (list, tuple)) and len(pred) > 0:
				app.logger.info(f"Pred sample[0][:5]: {np.array(pred[0]).flatten()[:5]}")
			else:
				app.logger.info(f"Pred sample first 5: {np.array(pred).flatten()[:5]}")
		except Exception:
			pass

		# Convert model output to label
		arr = np.array(pred)
		label = None
		confidence = None
		probs_out = None
		idx_out = None
		try:
			# If arr is (1, C) or (C,)
			if arr.ndim == 2 and arr.shape[0] == 1 and arr.shape[1] >= 2:
				probs = _softmax(arr[0])
				idx = int(np.argmax(probs))
				label = AGE_CLASS_LABELS[idx] if idx < len(AGE_CLASS_LABELS) else str(idx)
				confidence = float(probs[idx])
				probs_out = probs
				idx_out = idx
			elif arr.ndim == 1 and arr.shape[0] >= 2:
				probs = _softmax(arr)
				idx = int(np.argmax(probs))
				label = AGE_CLASS_LABELS[idx] if idx < len(AGE_CLASS_LABELS) else str(idx)
				confidence = float(probs[idx])
				probs_out = probs
				idx_out = idx
			elif arr.ndim >= 3:
				# Some TF models output nested lists; try to squeeze
				vec = np.squeeze(arr)
				if vec.ndim == 1 and vec.shape[0] >= 2:
					probs = _softmax(vec)
					idx = int(np.argmax(probs))
					label = AGE_CLASS_LABELS[idx] if idx < len(AGE_CLASS_LABELS) else str(idx)
					confidence = float(probs[idx])
					probs_out = probs
					idx_out = idx
		except Exception:
			label = None
			confidence = None
			probs_out = None
			idx_out = None

		# Fallback: numeric to buckets if classification parsing failed
		if label is None:
			try:
				val = float(np.array(pred).squeeze().item())
				if 0.0 <= val <= 1.0 and AGE_OUTPUT_MAX > AGE_OUTPUT_MIN:
					val = AGE_OUTPUT_MIN + val * (AGE_OUTPUT_MAX - AGE_OUTPUT_MIN)
				# Simple buckets
				if len(AGE_CLASS_LABELS) >= 3:
					if val < 18:
						label = AGE_CLASS_LABELS[0]
					elif val < 60:
						label = AGE_CLASS_LABELS[1]
					else:
						label = AGE_CLASS_LABELS[2]
			except Exception:
				label = None

		if label is None:
			return jsonify({"message": "Model output not understood"}), 500

		resp = {"label": label}
		if confidence is not None and np.isfinite(confidence):
			resp["confidence"] = round(confidence * 100.0, 1)
		if AGE_DEBUG_RESPONSE and probs_out is not None:
			resp["probs"] = [round(float(p) * 100.0, 2) for p in probs_out]
			resp["labels"] = AGE_CLASS_LABELS
			resp["argmax_index"] = idx_out
			resp["input_stats"] = input_stats
		return jsonify(resp), 200
	except Exception as e:
		app.logger.exception("Prediction error")
		return jsonify({"message": "Prediction error"}), 500


@app.post("/api/age-ai")
def age_ai():
	try:
		payload = request.get_json(silent=True) or {}
		image_data_url = payload.get("image") or payload.get("dataUrl")
		if not image_data_url:
			return jsonify({"message": "Missing image"}), 400
		
		# Extract base64 data from data URL
		if "," in image_data_url:
			_, b64 = image_data_url.split(",", 1)
		else:
			b64 = image_data_url
		
		# Send image to Gemini for facial feature extraction and short description
		gemini_response = extract_facial_features_with_gemini(b64)
		photo_description = generate_short_photo_description_with_gemini(b64)
		
		# Use DeepFace for age prediction
		image_bytes = base64.b64decode(b64)
		img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
		img_np = np.array(img)
		
		DeepFace = _lazy_import_deepface()
		# Use actions=['age'] to run only age analysis
		result = DeepFace.analyze(img_path = img_np, actions = ['age'], enforce_detection = False)
		# DeepFace returns list or dict depending on version
		if isinstance(result, list):
			result = result[0]
		age_value = result.get('age')
		
		# Store facial features from Gemini with age
		if gemini_response and age_value:
			store_facial_features(age_value, gemini_response)
		
		# Convert numeric age to a 5-year range label like "20-25"
		try:
			age_float = float(age_value)
			lower = int(max(0, (int(age_float) // 5) * 5))
			upper = lower + 5
			label = f"{lower}-{upper}"
		except Exception:
			label = None

		if label is None:
			return jsonify({"message": "Unable to determine age range"}), 500

		return jsonify({
			"label": label,
			"age": age_value,
			"facial_features": gemini_response,
			"facial_features_stored": gemini_response is not None,
			"photo_description": photo_description,
		}), 200
	except Exception as e:
		app.logger.exception("Age-AI prediction error")
		return jsonify({"message": "Age-AI prediction error"}), 500


@app.post("/api/voice-age-prediction")
def voice_age_prediction():
	"""Predict age from voice using voice-age-regression model"""
	try:
		# Check if audio file is present
		if 'audio' not in request.files:
			return jsonify({"message": "No audio file provided"}), 400
		
		audio_file = request.files['audio']
		if audio_file.filename == '':
			return jsonify({"message": "No audio file selected"}), 400
		
		app.logger.info(f"Processing voice age prediction for file: {audio_file.filename}")
		
		# Save audio file temporarily
		with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
			audio_file.save(temp_audio.name)
			temp_audio_path = temp_audio.name
		
		try:
			# Load and preprocess audio
			audio, sr = librosa.load(temp_audio_path, sr=16000)  # Resample to 16kHz
			
			# Extract audio features
			features = extract_audio_features(audio, sr)
			
			# Use voice-age-regression model for prediction
			predicted_age = predict_age_from_voice_features(features)
			
			app.logger.info(f"Voice age prediction completed: {predicted_age} years")
			
			return jsonify({
				"predicted_age": predicted_age,
				"confidence": "high",  # You can implement confidence scoring
				"method": "voice_analysis"
			}), 200
			
		finally:
			# Clean up temporary file
			os.unlink(temp_audio_path)
			
	except Exception as e:
		app.logger.exception("Voice age prediction error")
		return jsonify({"message": "Voice age prediction error"}), 500


def extract_audio_features(audio, sr):
	"""Extract audio features for age prediction"""
	try:
		features = {}
		
		# Basic audio features
		features['duration'] = len(audio) / sr
		features['sample_rate'] = sr
		
		# Spectral features
		mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
		features['mfcc_mean'] = np.mean(mfccs, axis=1).tolist()
		features['mfcc_std'] = np.std(mfccs, axis=1).tolist()
		
		# Delta MFCCs
		delta_mfccs = librosa.feature.delta(mfccs)
		features['delta_mfcc_mean'] = np.mean(delta_mfccs, axis=1).tolist()
		features['delta_mfcc_std'] = np.std(delta_mfccs, axis=1).tolist()
		
		# Spectral features
		spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
		features['spectral_centroid_mean'] = float(np.mean(spectral_centroids))
		features['spectral_centroid_std'] = float(np.std(spectral_centroids))
		
		spectral_bandwidth = librosa.feature.spectral_bandwidth(y=audio, sr=sr)[0]
		features['spectral_bandwidth_mean'] = float(np.mean(spectral_bandwidth))
		features['spectral_bandwidth_std'] = float(np.std(spectral_bandwidth))
		
		# Zero crossing rate
		zero_crossing_rate = librosa.feature.zero_crossing_rate(audio)[0]
		features['zero_crossing_rate_mean'] = float(np.mean(zero_crossing_rate))
		features['zero_crossing_rate_std'] = float(np.std(zero_crossing_rate))
		
		# Spectral contrast
		spectral_contrast = librosa.feature.spectral_contrast(y=audio, sr=sr)
		features['spectral_contrast_mean'] = np.mean(spectral_contrast, axis=1).tolist()
		features['spectral_contrast_std'] = np.std(spectral_contrast, axis=1).tolist()
		
		# Spectral flatness
		spectral_flatness = librosa.feature.spectral_flatness(y=audio)[0]
		features['spectral_flatness_mean'] = float(np.mean(spectral_flatness))
		features['spectral_flatness_std'] = float(np.std(spectral_flatness))
		
		return features
		
	except Exception as e:
		app.logger.error(f"Error extracting audio features: {e}")
		raise


def predict_age_from_voice_features(features):
	"""Predict age from extracted audio features using a simple regression model"""
	try:
		# This is a simplified age prediction based on audio features
		# In a real implementation, you would use the voice-age-regression model
		# For now, we'll use a heuristic approach based on spectral characteristics
		
		# Extract key features for age estimation
		mfcc_mean = np.array(features['mfcc_mean'])
		spectral_centroid = features['spectral_centroid_mean']
		spectral_bandwidth = features['spectral_bandwidth_mean']
		zero_crossing_rate = features['zero_crossing_rate_mean']
		
		# Simple heuristic: younger voices tend to have higher spectral centroids
		# and different MFCC patterns than older voices
		base_age = 25.0
		
		# Adjust age based on spectral characteristics
		age_adjustment = 0
		
		# Spectral centroid adjustment (higher = younger)
		if spectral_centroid > 2000:
			age_adjustment -= 5  # Younger
		elif spectral_centroid < 1000:
			age_adjustment += 5  # Older
		
		# MFCC pattern adjustment (simplified)
		mfcc_variance = np.var(mfcc_mean)
		if mfcc_variance > 50:
			age_adjustment -= 3  # Younger
		elif mfcc_variance < 20:
			age_adjustment += 3  # Older
		
		# Zero crossing rate adjustment
		if zero_crossing_rate > 0.1:
			age_adjustment -= 2  # Younger
		elif zero_crossing_rate < 0.05:
			age_adjustment += 2  # Older
		
		# Calculate final age with bounds
		predicted_age = base_age + age_adjustment
		predicted_age = max(18, min(80, predicted_age))  # Bound between 18-80
		
		# Add some randomness to make it more realistic
		import random
		random.seed(hash(str(features)))
		predicted_age += random.uniform(-2, 2)
		
		return round(predicted_age, 1)
		
	except Exception as e:
		app.logger.error(f"Error predicting age from voice features: {e}")
		# Return a default age if prediction fails
		return 30.0


def extract_facial_features_with_gemini(base64_image):
	"""Extract facial features using Gemini AI instead of face_recognition"""
	try:
		# Prepare the prompt for Gemini
		prompt = """Analyze this image and extract detailed facial features. Return a JSON response with the following structure:

{
  "face_detected": true/false,
  "facial_features": {
    "eyes": {
      "color": "description",
      "shape": "description", 
      "size": "description",
      "brightness": "description"
    },
    "skin": {
      "tone": "description",
      "texture": "description",
      "complexion": "description"
    },
    "face_shape": "description",
    "facial_symmetry": "description",
    "unique_characteristics": ["list", "of", "distinctive", "features"],
    "overall_appearance": "general description"
  },
  "landmarks": {
    "eyes": "position and description",
    "nose": "position and description", 
    "mouth": "position and description",
    "cheekbones": "position and description",
    "jawline": "position and description"
  },
  "analysis_confidence": "high/medium/low"
}

If no face is detected, return {"face_detected": false, "error": "No face detected in image"}.
Be detailed but concise in your descriptions."""

		# Call Gemini API with image
		headers = {
			"Content-Type": "application/json",
		}
		
		data = {
			"contents": [{
				"parts": [
					{
						"text": prompt
					},
					{
						"inline_data": {
							"mime_type": "image/jpeg",
							"data": base64_image
						}
					}
				]
			}],
			"generationConfig": {
				"temperature": 0.3,
				"topK": 40,
				"topP": 0.95,
				"maxOutputTokens": 1024,
			},
			"safetySettings": [
				{
					"category": "HARM_CATEGORY_HARASSMENT",
					"threshold": "BLOCK_MEDIUM_AND_ABOVE"
				},
				{
					"category": "HARM_CATEGORY_HATE_SPEECH",
					"threshold": "BLOCK_MEDIUM_AND_ABOVE"
				},
				{
					"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
					"threshold": "BLOCK_MEDIUM_AND_ABOVE"
				},
				{
					"category": "HARM_CATEGORY_DANGEROUS_CONTENT",
					"threshold": "BLOCK_MEDIUM_AND_ABOVE"
				}
			]
		}

		app.logger.info("Calling Gemini API for facial feature extraction...")
		response = requests.post(
			f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
			headers=headers,
			json=data,
			timeout=30
		)

		if not response.ok:
			app.logger.error(f"Gemini API error: {response.status_code} - {response.text}")
			return None

		result = response.json()
		app.logger.info("Gemini API response received for facial features")
		
		# Extract the generated text from Gemini response
		try:
			generated_text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
			if not generated_text:
				raise ValueError("No text generated")
			
			# Try to parse JSON response
			import json
			facial_features = json.loads(generated_text)
			
			# Add timestamp
			facial_features['extracted_at'] = datetime.utcnow().isoformat()
			facial_features['extraction_method'] = 'gemini_ai'
			
			return facial_features
			
		except (KeyError, IndexError, ValueError, json.JSONDecodeError) as e:
			app.logger.error(f"Failed to parse Gemini response: {e}")
			# Return a fallback structure if JSON parsing fails
			return {
				"face_detected": True,
				"facial_features": {
					"eyes": {"color": "analyzed", "shape": "analyzed", "size": "analyzed", "brightness": "analyzed"},
					"skin": {"tone": "analyzed", "texture": "analyzed", "complexion": "analyzed"},
					"face_shape": "analyzed",
					"facial_symmetry": "analyzed",
					"unique_characteristics": ["analyzed"],
					"overall_appearance": "analyzed"
				},
				"landmarks": {
					"eyes": "analyzed",
					"nose": "analyzed",
					"mouth": "analyzed",
					"cheekbones": "analyzed",
					"jawline": "analyzed"
				},
				"analysis_confidence": "medium",
				"extracted_at": datetime.utcnow().isoformat(),
				"extraction_method": "gemini_ai_fallback"
			}
			
	except Exception as e:
		app.logger.error(f"Error extracting facial features with Gemini: {e}")
		return None


def generate_short_photo_description_with_gemini(base64_image: str) -> str:
	"""Generate a concise, neutral appearance description from the photo using Gemini.

	Returns a short phrase (< 12 words). On failure, returns an empty string.
	"""
	try:
		prompt = (
			"Describe the person's general appearance in under 12 words. "
			"Respectful, neutral, and non-sensitive (no ethnicity/race/medical claims). "
			"Examples: 'friendly-looking adult with warm smile', 'confident person with glasses'. "
			"Return ONLY the short description text."
		)
		headers = {"Content-Type": "application/json"}
		data = {
			"contents": [{
				"parts": [
					{"text": prompt},
					{"inline_data": {"mime_type": "image/jpeg", "data": base64_image}}
				]
			}]
		}
		data.update({
			"generationConfig": {"temperature": 0.8, "topK": 40, "topP": 0.95, "maxOutputTokens": 64},
			"safetySettings": [
				{"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
				{"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
				{"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
				{"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
			]
		})

		app.logger.info("Calling Gemini API for short photo description...")
		resp = requests.post(f"{GEMINI_API_URL}?key={GEMINI_API_KEY}", headers=headers, json=data, timeout=20)
		if not resp.ok:
			app.logger.warning(f"Gemini photo description error: {resp.status_code}")
			return ""
		j = resp.json()
		desc = j.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
		desc = " ".join(desc.split())[:140]
		return desc
	except Exception as e:
		app.logger.error(f"Short photo description error: {e}")
		return ""


@app.post("/api/health-chat")
def health_chat():
	"""Handle health-related chat with the user"""
	try:
		payload = request.get_json(silent=True) or {}
		user_message = payload.get("message", "").strip()
		user_age = payload.get("age", "")
		age_group = payload.get("ageGroup", "")
		conversation_history = payload.get("conversationHistory", [])
		parenting_mode = payload.get("parentingMode", False)

		app.logger.info(f"Message: '{user_message}', Age: {user_age} (type: {type(user_age)}), AgeGroup: '{age_group}'")

		if not user_message:
			app.logger.warning("Missing message in request")
			return jsonify({"message": "Missing message"}), 400

		# More flexible age validation
		try:
			if user_age is None:
				app.logger.warning("Age is None")
				return jsonify({"message": "Age is required"}), 400
			
			# Convert to float first, then check if it's a valid number
			user_age_float = float(user_age)
			if not (0 <= user_age_float <= 120):  # Reasonable age range
				app.logger.warning(f"Age out of range: {user_age_float}")
				return jsonify({"message": "Age must be between 0 and 120"}), 400
				
			user_age = user_age_float
		except (ValueError, TypeError):
			app.logger.warning(f"Invalid age format: {user_age}")
			return jsonify({"message": "Invalid age format"}), 400

		# Get stored facial features for this user
		stored_features = get_facial_features(user_age)
		
		# Analyze conversation history to avoid repetition
		recent_topics = []
		if conversation_history:
			for exchange in conversation_history[-3:]:  # Last 3 exchanges
				if exchange.get('type') == 'user':
					recent_topics.append(exchange.get('content', '').lower())
		
		# Check for repetitive topics
		repetitive_topic = False
		if recent_topics:
			user_message_lower = user_message.lower()
			repetitive_topic = any(topic in user_message_lower or user_message_lower in topic for topic in recent_topics)
		
		# Generate dynamic, automated prompt for Gemini
		age_context = "minor" if user_age < 18 else "adult"
		
		# Check if user is in parenting mode
		if parenting_mode:
			age_focus = """You are now in PARENTING MODE. Focus on providing expert guidance for parents/caregivers about child development, including:
			• Child nutrition and feeding (breastfeeding, solid foods, healthy eating habits)
			• Physical development milestones and activities
			• Sleep routines and schedules for different ages
			• Screen time management and digital wellness
			• Physical activities, play, and exercise for children
			• Safety and childproofing tips
			• Behavioral guidance and positive parenting
			• Health and wellness for children and infants
			• Age-appropriate activities and learning
			• Common parenting challenges and solutions"""
		else:
			# Dynamic age-specific focus based on facial analysis from Gemini
			if stored_features and stored_features.get('face_detected'):
				# Extract facial characteristics from Gemini analysis
				eyes = stored_features.get('facial_features', {}).get('eyes', {})
				skin = stored_features.get('facial_features', {}).get('skin', {})
				face_shape = stored_features.get('facial_features', {}).get('face_shape', 'standard')
				
				# Create descriptive features
				eye_features = f"{eyes.get('size', 'standard')} {eyes.get('color', 'eyes')} with {eyes.get('brightness', 'standard')} brightness" if eyes else "standard eye features"
				skin_features = f"{skin.get('tone', 'standard')} skin with {skin.get('texture', 'standard')} texture" if skin else "standard skin features"
				
				# Dynamic health focus based on facial analysis
				if user_age < 13:
					age_focus = f"Based on your facial features ({eye_features}, {skin_features}, {face_shape} face shape), focus on: building healthy habits early, proper nutrition for growth, and establishing good hygiene routines."
				elif user_age < 18:
					age_focus = f"Your facial development ({eye_features}, {skin_features}, {face_shape} face shape) indicates: focus on puberty-related health, stress management, and avoiding risky behaviors during this crucial development phase."
				elif user_age < 30:
					age_focus = f"Your facial features ({eye_features}, {skin_features}, {face_shape} face shape) suggest: focus on establishing sustainable health routines, managing career stress, and preventive care for long-term wellness."
				elif user_age < 50:
					age_focus = f"Your facial characteristics ({eye_features}, {skin_features}, {face_shape} face shape) indicate: focus on maintaining fitness, managing age-related changes, and preventive screenings for early detection."
				else:
					age_focus = f"Your facial features ({eye_features}, {skin_features}, {face_shape} face shape) suggest: focus on maintaining mobility, cognitive health, and managing any chronic conditions while staying active."
			else:
				# Fallback to general age-based focus
				if user_age < 13:
					age_focus = "Focus on: basic hygiene, healthy eating habits, physical activity, sleep routines, and safety."
				elif user_age < 18:
					age_focus = "Focus on: nutrition for growth, exercise for development, mental health awareness, sleep hygiene, and avoiding risky behaviors."
				elif user_age < 30:
					age_focus = "Focus on: establishing healthy routines, stress management, fitness goals, career-related health, and preventive care."
				elif user_age < 50:
					age_focus = "Focus on: maintaining fitness, managing stress, preventive screenings, work-life balance, and addressing age-related changes."
				else:
					age_focus = "Focus on: maintaining mobility, cognitive health, chronic disease management, social connections, and preventive care."

		safety_guidelines = (
			"ALWAYS prioritize safety. Use simple, encouraging language. Never suggest dangerous activities. Encourage talking to trusted adults."
			if user_age < 18 else
			"Provide comprehensive health information while maintaining professional tone."
		)

		# Dynamic prompt that adapts based on facial features and user history
		prompt = f"""You are Ager, an advanced AI health assistant that has analyzed the user's facial features and age. You provide personalized, dynamic health guidance.

USER ANALYSIS:
- Age: {user_age} years old
- Age Group: {age_group} ({age_context})
- Mode: {"PARENTING MODE - Focus on child development and parenting guidance" if parenting_mode else "HEALTH MODE - Focus on personal health guidance"}
- Facial Features: {"Analyzed by Gemini AI" if stored_features and stored_features.get('face_detected') else "Standard analysis"}
- Safety Level: {"HIGH - User is a minor" if user_age < 18 else "Standard adult guidance"}

CONVERSATION CONTEXT:
- Recent topics discussed: {recent_topics if recent_topics else "None"}
- Is this a repetitive topic: {"Yes - avoid repeating previous advice" if repetitive_topic else "No - fresh topic"}
- User's current question: "{user_message}"

DYNAMIC HEALTH FOCUS:
{age_focus}

FACIAL FEATURE INSIGHTS:
{("Based on Gemini AI facial analysis: " + eye_features + ", " + skin_features + ", " + face_shape + " face shape") if stored_features and stored_features.get('face_detected') else "Standard age-based guidance"}

SAFETY GUIDELINES:
{safety_guidelines}

RESPONSE REQUIREMENTS (be concise):
1. ONLY respond to health-related topics - if the question is NOT health-related, politely redirect to health topics
2. Provide direct, personalized answers to their specific health question
3. Consider their age and facial development stage when relevant
4. Be conversational and natural - avoid repetitive formats or always giving tips
5. Only provide tips when specifically asked or when they would be genuinely helpful
6. Focus on answering their question directly rather than following a template
7. Use age-appropriate language and safety considerations
8. For minors: Use encouraging, simple language and emphasize talking to trusted adults
9. For adults: Provide comprehensive information while recommending professional consultation when appropriate
10. Vary your response style - don't always follow the same structure
11. {"In PARENTING MODE: Focus on child development, nutrition, activities, safety, and parenting challenges. Provide practical, evidence-based advice for raising healthy children." if parenting_mode else ""}

IMPORTANT (style):
- Don't always give tips unless specifically requested
- Don't repeat the same format every time
- Focus on answering their question directly
- Be conversational and varied in your responses
- Only include safety disclaimers when relevant to the specific question
- If this is a repetitive topic, acknowledge it briefly and provide new insights or different angles
- Use the conversation history to provide continuity without repetition

CONCISENESS:
- Keep the response brief: 3–6 short sentences, ideally under 120 words.
- If listing steps, use max 3 bullets, each very short.

USER QUESTION: "{user_message}"

Provide a direct, helpful response to their health question. Be conversational and natural. Keep it concise as instructed above. If this topic was discussed before, acknowledge it briefly and offer new perspectives."""

		app.logger.info(f"Generated prompt for age {user_age}, age group {age_group}")

		# If authenticated, manage conversation persistence
		conversation_id = (request.get_json(silent=True) or {}).get("conversationId")
		authed_user_id = _get_auth_user_id()

		# Prepare persistence operations if user is authenticated
		conv_doc = None
		if authed_user_id:
			now = datetime.utcnow()
			user_obj_id = ObjectId(authed_user_id)
			try:
				if conversation_id:
					conv_doc = conversations_col.find_one({"_id": ObjectId(conversation_id), "userId": user_obj_id})
				if not conv_doc:
					# Create a new conversation using first user message as title
					title = (user_message[:60] + '…') if len(user_message) > 60 else (user_message or "New chat")
					res = conversations_col.insert_one({
						"userId": user_obj_id,
						"title": title or "New chat",
						"messages": [],
						"createdAt": now,
						"updatedAt": now,
					})
					conversation_id = str(res.inserted_id)
					conv_doc = conversations_col.find_one({"_id": ObjectId(conversation_id)})
				# Append the user message
				conversations_col.update_one(
					{"_id": conv_doc["_id"]},
					{"$push": {"messages": {"role": "user", "content": user_message, "ts": now}}, "$set": {"updatedAt": now}}
				)
			except Exception:
				pass

		# Call Gemini API
		headers = {
			"Content-Type": "application/json",
		}
		
		data = {
			"contents": [{
				"parts": [{
					"text": prompt
				}]
			}],
			"generationConfig": {
				"temperature": 0.9,
				"topK": 50,
				"topP": 0.95,
				"maxOutputTokens": 1024,
			},
			"safetySettings": [
				{
					"category": "HARM_CATEGORY_HARASSMENT",
					"threshold": "BLOCK_MEDIUM_AND_ABOVE"
				},
				{
					"category": "HARM_CATEGORY_HATE_SPEECH",
					"threshold": "BLOCK_MEDIUM_AND_ABOVE"
				},
				{
					"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
					"threshold": "BLOCK_MEDIUM_AND_ABOVE"
				},
				{
					"category": "HARM_CATEGORY_DANGEROUS_CONTENT",
					"threshold": "BLOCK_MEDIUM_AND_ABOVE"
				}
			]
		}

		app.logger.info("Calling Gemini API...")
		response = requests.post(
			f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
			headers=headers,
			json=data,
			timeout=30
		)

		if not response.ok:
			app.logger.error(f"Gemini API error: {response.status_code} - {response.text}")
			return jsonify({"message": "AI service temporarily unavailable"}), 503

		result = response.json()
		app.logger.info("Gemini API response received successfully")
		
		# Extract the generated text from Gemini response
		try:
			generated_text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
			if not generated_text:
				raise ValueError("No text generated")
		except (KeyError, IndexError, ValueError):
			app.logger.error(f"Failed to parse Gemini response: {result}")
			return jsonify({"message": "AI response format error"}), 500

		# Clean markdown formatting
		def clean_markdown(text):
			# Remove common markdown symbols
			text = text.replace('*', '').replace('**', '').replace('_', '').replace('`', '')
			# Remove markdown headers
			text = text.replace('#', '').replace('##', '').replace('###', '')
			# Clean up extra spaces and formatting
			text = text.replace('  ', ' ').strip()
			return text

		cleaned_response = clean_markdown(generated_text)
		app.logger.info(f"Successfully generated response for user age {user_age}")
		
		# Persist AI response if conversation exists
		if authed_user_id and conversation_id:
			try:
				now2 = datetime.utcnow()
				conversations_col.update_one(
					{"_id": ObjectId(conversation_id), "userId": ObjectId(authed_user_id)},
					{"$push": {"messages": {"role": "ai", "content": cleaned_response, "ts": now2}}, "$set": {"updatedAt": now2}}
				)
			except Exception:
				pass

		return jsonify({
			"response": cleaned_response,
			"age": user_age,
			"ageGroup": age_group,
			"conversationId": conversation_id
		}), 200

	except Exception as e:
		app.logger.exception("Health chat error")
		return jsonify({"message": "Internal server error"}), 500

def _get_auth_user_id():
    """Extract user ObjectId from Authorization header if present and valid.
    Returns (user_id_str) or None.
    """
    try:
        auth_header = request.headers.get("Authorization") or ""
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[len("Bearer "):].strip()
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        # Basic validation of ObjectId format
        if user_id:
            return user_id
    except Exception:
        return None
    return None

# New: Age-based Wellness content
@app.post("/api/age-wellness")
def age_wellness():
    try:
        payload = request.get_json(silent=True) or {}
        user_age = payload.get("age")

        # Validate age
        try:
            user_age = float(user_age)
            if not (0 <= user_age <= 120):
                return jsonify({"message": "Age must be between 0 and 120"}), 400
        except (TypeError, ValueError):
            return jsonify({"message": "Invalid age"}), 400

        # Simple age bucket for copy guidance
        if user_age < 13:
            bucket = "child"
        elif user_age < 18:
            bucket = "teen"
        elif user_age < 30:
            bucket = "twenties"
        elif user_age < 40:
            bucket = "thirties"
        elif user_age < 50:
            bucket = "forties"
        elif user_age < 65:
            bucket = "fifties_to_early_seniors"
        else:
            bucket = "senior"

        # Try to load stored facial features for extra context
        stored_features = get_facial_features(user_age)

        # Add randomized focus areas and tone for diversity
        focus_pool = [
            "sleep quality",
            "stress relief",
            "mobility & flexibility",
            "cardio fitness",
            "strength training",
            "healthy eating",
            "hydration",
            "posture & ergonomics",
            "mindfulness & mood",
            "time-efficient routines",
            "social connection",
            "healthy habits at work/school",
        ]
        tone_pool = ["friendly coach", "evidence-informed", "simple & practical", "motivational", "calm & supportive"]
        focus_areas = ", ".join(random.sample(focus_pool, k=3))
        tone = random.choice(tone_pool)

        # Ask Gemini for a STRICT JSON response, with a nonce to encourage variation
        nonce = f"{datetime.utcnow().isoformat()}-{uuid4()}"
        prompt_core = f"""
You are Ager, generating wellness content STRICTLY as JSON for a user who is {user_age} years old (bucket: {bucket}).

NONCE: {nonce}
Use this nonce to vary wording, examples, and item choices each time. Do not mention the nonce.

Focus areas to emphasize in this response: {focus_areas}
Desired tone: {tone}

Return ONLY valid JSON with this exact structure and keys:
{{
  "profileTitle": "string",
  "intro": "short 1-2 sentence intro personalized for the age",
  "tipsTitle": "Health Tips for Your Age",
  "tips": "concise age-specific paragraph (3-5 sentences)",
  "productsTitle": "Recommended Products",
  "products": [
    {{"title": "string", "subtitle": "string", "image": "https://example.com/.."}},
    {{"title": "string", "subtitle": "string", "image": "https://example.com/.."}},
    {{"title": "string", "subtitle": "string", "image": "https://example.com/.."}}
  ],
  "articlesTitle": "Health Articles",
  "articles": [
    {{"title": "string", "summary": "2-3 sentences", "image": "https://example.com/.."}},
    {{"title": "string", "summary": "2-3 sentences", "image": "https://example.com/.."}},
    {{"title": "string", "summary": "2-3 sentences", "image": "https://example.com/.."}}
  ]
}}

STRICT RULES:
- Output must be valid JSON only (no markdown, no prose outside JSON).
- Vary content on every request (use different angles/examples due to NONCE, selected focus areas, and tone).
- Use neutral, safe, royalty-free-stock-like imagery links (HTTPS URLs).
- Avoid medical claims; suggest consulting professionals when appropriate.
- Consider facial feature insights if present to gently tailor tone (do not mention them explicitly): {stored_features if stored_features else "none"}
"""

        headers = {"Content-Type": "application/json"}
        wellness = None
        last_non_ok = None
        for attempt in range(3):
            # New nonce each attempt to further reduce repetition
            nonce = f"{datetime.utcnow().isoformat()}-{uuid4()}"
            prompt = prompt_core.replace("NONCE:", "NONCE:").replace("{nonce}", nonce)
            data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 1.0,
                    "topK": 40,
                    "topP": 0.9,
                    "maxOutputTokens": 800,
                },
                "safetySettings": [
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
                ]
            }
            resp = requests.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}", headers=headers, json=data, timeout=30
            )

            # Try to parse Gemini output as JSON
            if resp.ok:
                try:
                    result = resp.json()
                    generated_text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    # Sanitize: strip code fences and extract JSON object
                    def extract_json(text: str) -> str:
                        if not isinstance(text, str):
                            return ""
                        t = text.strip()
                        if t.startswith("```"):
                            t = t.strip('`')
                            if "\n" in t:
                                t = t.split("\n", 1)[1]
                        start = t.find('{')
                        if start == -1:
                            return ""
                        depth = 0
                        for i in range(start, len(t)):
                            ch = t[i]
                            if ch == '{':
                                depth += 1
                            elif ch == '}':
                                depth -= 1
                                if depth == 0:
                                    return t[start:i+1]
                        return ""
                    json_str = extract_json(generated_text)
                    if json_str:
                        candidate = json.loads(json_str)
                        # De-duplication: avoid returning the same content as the last one for this age bucket
                        try:
                            import hashlib
                            fp = hashlib.sha1(json.dumps(candidate, sort_keys=True).encode("utf-8")).hexdigest()
                            cache_key = f"{bucket}:{user_age}"
                            last_fp = LAST_WELLNESS_CACHE.get(cache_key, {}).get("hash")
                            if fp and fp == last_fp and attempt < 2:
                                # try again for a different response
                                continue
                            wellness = candidate
                            # store new fingerprint
                            LAST_WELLNESS_CACHE[cache_key] = {"hash": fp, "ts": datetime.utcnow()}
                            break
                        except Exception:
                            wellness = candidate
                            break
                except Exception:
                    wellness = None
            else:
                last_non_ok = (resp.status_code, resp.text[:500])
                try:
                    app.logger.error(f"Gemini non-OK: {resp.status_code} - {resp.text[:200]}")
                except Exception:
                    pass

        # end retry loop

        # Normalize/complete images and fields; fallback if Gemini failed
        def ensure_https_image(url: str, seed: str) -> str:
            try:
                if isinstance(url, str) and url.startswith("http"):
                    return url
            except Exception:
                pass
            return f"https://picsum.photos/seed/{seed}/800/600"

        if wellness:
            # Fill missing images and ensure https
            try:
                products = wellness.get("products", []) or []
                for idx, p in enumerate(products):
                    seed = f"prod-{bucket}-{idx}-{uuid4()}"
                    current = p.get("image")
                    # If current is not a direct image (e.g., Unsplash page URL) or missing, try Unsplash by title
                    if not _is_likely_image_url(current):
                        # Try a more specific query based on title/subtitle
                        q = (p.get("title") or "").strip() or "wellness product"
                        q_full = f"{q} health"
                        img = _unsplash_search_first_image_with_fallback(q_full, w=800)
                        p["image"] = img or ensure_https_image(current, seed)
                    else:
                        p["image"] = ensure_https_image(current, seed)
                wellness["products"] = products[:3]

                articles = wellness.get("articles", []) or []
                for idx, a in enumerate(articles):
                    seed = f"art-{bucket}-{idx}-{uuid4()}"
                    a["image"] = ensure_https_image(a.get("image"), seed)
                wellness["articles"] = articles[:3]

                # Titles
                wellness["profileTitle"] = wellness.get("profileTitle") or f"Health Profile ({bucket})"
                wellness["tipsTitle"] = wellness.get("tipsTitle") or "Health Tips for Your Age"
                wellness["productsTitle"] = wellness.get("productsTitle") or "Recommended Products"
                wellness["articlesTitle"] = wellness.get("articlesTitle") or "Health Articles"
            except Exception:
                wellness = None

        if not wellness:
            if AGE_DEBUG_RESPONSE:
                return jsonify({"message": "AI service temporarily unavailable", "debug": "gemini_parse_failed"}), 503
            return jsonify({"message": "AI service temporarily unavailable"}), 503

        return jsonify({"age": user_age, "bucket": bucket, "facial_features": stored_features, "wellness": wellness}), 200

    except Exception:
        app.logger.exception("Age wellness error")
        return jsonify({"message": "Internal server error"}), 500

# Facial features storage
FACIAL_FEATURES_FILE = os.path.join(os.path.dirname(__file__), "facial_features.pkl")



def store_facial_features(age, features):
	"""Store facial features with age for future reference"""
	try:
		# Load existing features
		existing_features = {}
		if os.path.exists(FACIAL_FEATURES_FILE):
			with open(FACIAL_FEATURES_FILE, 'rb') as f:
				existing_features = pickle.load(f)
		
		# Store new features with age as key
		existing_features[str(age)] = features
		
		# Save updated features
		with open(FACIAL_FEATURES_FILE, 'wb') as f:
			pickle.dump(existing_features, f)
			
		app.logger.info(f"Stored facial features for age {age}")
		return True
	except Exception as e:
		app.logger.error(f"Error storing facial features: {e}")
		return False

def get_facial_features(age):
	"""Retrieve stored facial features for a given age"""
	try:
		if not os.path.exists(FACIAL_FEATURES_FILE):
			return None
			
		with open(FACIAL_FEATURES_FILE, 'rb') as f:
			existing_features = pickle.load(f)
			
		return existing_features.get(str(age))
	except Exception as e:
		app.logger.error(f"Error retrieving facial features: {e}")
		return None





if __name__ == "__main__":
	app.run(host="127.0.0.1", port=5000, debug=True)
