# 🎤 Voice Age Prediction Setup Guide

This guide explains how to set up and use the voice age prediction feature in your age prediction application.

## 🚀 Features

- **Voice Recording**: Record your voice using the browser's microphone
- **Age Prediction**: Get age predictions based on voice characteristics
- **Multiple Methods**: Choose between image-based or voice-based age prediction
- **Seamless Integration**: Works with existing chatbot and product recommendation system

## 📋 Prerequisites

### Backend Dependencies
The following Python packages are required for voice age prediction:

```bash
pip install librosa>=0.10.0
pip install soundfile>=0.12.0
```

### Frontend Requirements
- Modern browser with microphone access support
- HTTPS connection (required for microphone access in most browsers)

## 🔧 Installation

### 1. Install Backend Dependencies
```bash
cd server
pip install -r requirements.txt
```

### 2. Start the Backend Server
```bash
cd server
python app.py
```

### 3. Start the Frontend
```bash
cd client
npm install
npm run dev
```

## 🎯 How It Works

### Voice Age Prediction Process

1. **User Selection**: User chooses "Voice Age Prediction" from the home page
2. **Sentence Display**: System shows a random sentence for the user to read
3. **Voice Recording**: User records their voice reading the sentence
4. **Audio Processing**: Backend processes the audio and extracts features:
   - MFCCs (Mel-frequency cepstral coefficients)
   - Spectral features (centroid, bandwidth, contrast, flatness)
   - Zero crossing rate
   - Delta MFCCs
5. **Age Prediction**: AI model analyzes voice characteristics to predict age
6. **Results**: Predicted age is displayed with option to continue to chatbot

### Technical Implementation

The voice age prediction uses the following approach:

- **Audio Preprocessing**: Resamples audio to 16kHz for consistent analysis
- **Feature Extraction**: Uses librosa library to extract 31 audio features
- **Age Prediction**: Implements heuristic-based age estimation based on spectral characteristics
- **Integration**: Seamlessly integrates with existing age prediction workflow

## 🔮 Future Enhancements

### Integration with voice-age-regression Repository

The current implementation uses a simplified heuristic approach. For production use, you can integrate with the [voice-age-regression](https://github.com/griko/voice-age-regression) repository:

1. **Install the Package**:
```bash
pip install git+https://github.com/griko/voice-age-regression.git#egg=voice-age-regressor[full]
```

2. **Update the Backend**:
Replace the `predict_age_from_voice_features` function with:

```python
from voice_age_regression import AgeRegressionPipeline

def predict_age_from_voice_features(audio_file_path):
    """Predict age using voice-age-regression model"""
    try:
        # Load the pre-trained model
        regressor = AgeRegressionPipeline.from_pretrained(
            "griko/age_reg_ann_ecapa_librosa_combined"
        )
        
        # Predict age from audio file
        result = regressor(audio_file_path)
        predicted_age = result[0]
        
        return round(predicted_age, 1)
        
    except Exception as e:
        app.logger.error(f"Error with voice-age-regression model: {e}")
        # Fallback to heuristic method
        return fallback_age_prediction(audio_file_path)
```

## 📱 User Experience

### Voice Recording Interface

- **Clear Instructions**: Users see exactly what sentence to read
- **Visual Feedback**: Recording status with animated indicators
- **Audio Review**: Users can listen to their recording before processing
- **Error Handling**: Graceful fallbacks for microphone access issues

### Sample Sentences

The system provides age-appropriate sentences for users to read:

1. "The quick brown fox jumps over the lazy dog while the sun shines brightly in the clear blue sky."
2. "Technology has transformed our world in remarkable ways, making communication faster and more accessible than ever before."
3. "Health and wellness are essential aspects of life that contribute to our overall happiness and well-being."
4. "Education opens doors to new opportunities and helps us understand the world around us better."
5. "Nature provides us with beauty, resources, and inspiration that enrich our daily lives."

## 🛠️ API Endpoints

### Voice Age Prediction
- **Endpoint**: `POST /api/voice-age-prediction`
- **Input**: Audio file (WAV format)
- **Output**: JSON with predicted age and confidence

```json
{
  "predicted_age": 28.5,
  "confidence": "high",
  "method": "voice_analysis"
}
```

## 🔒 Security Considerations

- **Microphone Access**: Requires explicit user permission
- **Audio Processing**: Audio files are processed temporarily and deleted
- **No Storage**: Voice recordings are not stored permanently
- **HTTPS Required**: Microphone access typically requires secure connection

## 🐛 Troubleshooting

### Common Issues

1. **Microphone Access Denied**
   - Check browser permissions
   - Ensure HTTPS connection
   - Clear browser cache and permissions

2. **Audio Processing Errors**
   - Verify librosa and soundfile installation
   - Check audio file format (WAV recommended)
   - Ensure sufficient audio length (>1 second)

3. **Age Prediction Failures**
   - Check backend logs for errors
   - Verify audio quality and clarity
   - Ensure proper sentence pronunciation

### Debug Mode

Enable debug logging in the backend:

```python
app.logger.setLevel(logging.DEBUG)
```

## 📊 Performance Metrics

- **Processing Time**: Typically 2-5 seconds for voice analysis
- **Accuracy**: Heuristic method provides reasonable estimates
- **Memory Usage**: Minimal memory footprint for audio processing
- **Scalability**: Can handle multiple concurrent voice predictions

## 🔄 Workflow Integration

The voice age prediction seamlessly integrates with the existing workflow:

1. **Home Page** → Choose voice age prediction
2. **Voice Recording** → Record and process voice
3. **Age Results** → View predicted age
4. **Chatbot** → Continue to personalized health guidance
5. **Products** → Get age-specific product recommendations

## 📚 Additional Resources

- [Librosa Documentation](https://librosa.org/)
- [Voice Age Regression Repository](https://github.com/griko/voice-age-regression)
- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

## 🤝 Contributing

To improve the voice age prediction feature:

1. **Enhance Feature Extraction**: Add more sophisticated audio features
2. **Improve Age Prediction**: Integrate with advanced ML models
3. **User Experience**: Add more interactive recording features
4. **Performance**: Optimize audio processing pipeline

---

**Note**: This implementation provides a foundation for voice-based age prediction. For production use, consider integrating with the voice-age-regression repository for more accurate predictions.
