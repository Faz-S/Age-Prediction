from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta
from dotenv import load_dotenv
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
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyAopETSjDC5U-KK5sTMd3srq6rJSXiU6-c")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

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


# Serve React frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # Path to the built React app
    dist_path = os.path.join(os.path.dirname(__file__), "..", "client", "dist")
    
    # If it's an API route, let Flask handle it
    if path.startswith('api/'):
        return "API route not found", 404
    
    # Serve static files if they exist
    if path != "" and os.path.exists(os.path.join(dist_path, path)):
        return send_from_directory(dist_path, path)
    else:
        # Serve index.html for React Router
        return send_from_directory(dist_path, 'index.html')


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
		
		# Send image to Gemini for facial feature extraction
		gemini_response = extract_facial_features_with_gemini(b64)
		
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
			"facial_features_stored": gemini_response is not None
		}), 200
	except Exception as e:
		app.logger.exception("Age-AI prediction error")
		return jsonify({"message": "Age-AI prediction error"}), 500


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


@app.post("/api/health-chat")
def health_chat():
	try:
		payload = request.get_json(silent=True) or {}
		app.logger.info(f"Received payload: {payload}")
		
		user_message = payload.get("message", "").strip()
		user_age = payload.get("age")
		age_group = payload.get("ageGroup", "")
		conversation_history = payload.get("conversationHistory", [])

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

RESPONSE REQUIREMENTS:
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

IMPORTANT: 
- Don't always give tips unless specifically requested
- Don't repeat the same format every time
- Focus on answering their question directly
- Be conversational and varied in your responses
- Only include safety disclaimers when relevant to the specific question
- If this is a repetitive topic, acknowledge it briefly and provide new insights or different angles
- Use the conversation history to provide continuity without repetition

USER QUESTION: "{user_message}"

Provide a direct, helpful response to their health question. Be conversational and natural. Don't force a rigid format or always include tips. If this topic was discussed before, acknowledge it briefly and offer new perspectives."""

		app.logger.info(f"Generated prompt for age {user_age}, age group {age_group}")

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
		
		return jsonify({
			"response": cleaned_response,
			"age": user_age,
			"ageGroup": age_group
		}), 200

	except Exception as e:
		app.logger.exception("Health chat error")
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
