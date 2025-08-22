from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import bcrypt
import jwt

# New imports for model inference
import base64
import io
import numpy as np
from PIL import Image

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

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client["age_app"]
users_col = db["users"]
users_col.create_index("email", unique=True)


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
	return jsonify({"message": "Login successful", "token": token}), 200


@app.get("/api/health")
def health():
	return jsonify({"status": "ok"}), 200


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
		if "," in image_data_url:
			_, b64 = image_data_url.split(",", 1)
		else:
			b64 = image_data_url
		image_bytes = base64.b64decode(b64)
		img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
		# DeepFace accepts file paths or numpy arrays (BGR). We'll pass RGB np array.
		img_np = np.array(img)
		DeepFace = _lazy_import_deepface()
		# Use actions=['age'] to run only age analysis
		result = DeepFace.analyze(img_path = img_np, actions = ['age'], enforce_detection = False)
		# DeepFace returns list or dict depending on version
		if isinstance(result, list):
			result = result[0]
		age_value = result.get('age')
		return jsonify({"age": age_value}), 200
	except Exception as e:
		app.logger.exception("Age-AI prediction error")
		return jsonify({"message": "Age-AI prediction error"}), 500


if __name__ == "__main__":
	app.run(host="127.0.0.1", port=5000, debug=True)
