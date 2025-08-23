import { useState } from 'react'
import config from '../../config.js'

export default function AgeAI() {
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [age, setAge] = useState(null)
  const [facialFeatures, setFacialFeatures] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  function handleUpload(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUrl(reader.result)
      setAge(null)
      setFacialFeatures(null)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  async function handlePredict() {
    if (!imageDataUrl) return
    setIsLoading(true)
    setError('')
    setAge(null)
    setFacialFeatures(null)
    try {
      const res = await fetch(config.getApiUrl('/api/age-ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Prediction failed')
      setAge(data.age)
      setFacialFeatures(data.facial_features)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  function renderFacialFeatures(features) {
    if (!features || !features.face_detected) {
      return <div className="text-red-600">No face detected in image</div>
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Facial Features Analysis (Gemini AI)</h3>
        
        {/* Eyes */}
        {features.facial_features?.eyes && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">👁️ Eyes</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Color:</span> {features.facial_features.eyes.color}</div>
              <div><span className="font-medium">Shape:</span> {features.facial_features.eyes.shape}</div>
              <div><span className="font-medium">Size:</span> {features.facial_features.eyes.size}</div>
              <div><span className="font-medium">Brightness:</span> {features.facial_features.eyes.brightness}</div>
            </div>
          </div>
        )}

        {/* Skin */}
        {features.facial_features?.skin && (
          <div className="bg-orange-50 p-3 rounded-lg">
            <h4 className="font-medium text-orange-800 mb-2">🧴 Skin</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Tone:</span> {features.facial_features.skin.tone}</div>
              <div><span className="font-medium">Texture:</span> {features.facial_features.skin.texture}</div>
              <div><span className="font-medium">Complexion:</span> {features.facial_features.skin.complexion}</div>
            </div>
          </div>
        )}

        {/* Face Shape & Symmetry */}
        <div className="bg-green-50 p-3 rounded-lg">
          <h4 className="font-medium text-green-800 mb-2">👤 Face Structure</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Shape:</span> {features.facial_features?.face_shape}</div>
            <div><span className="font-medium">Symmetry:</span> {features.facial_features?.facial_symmetry}</div>
          </div>
        </div>

        {/* Unique Characteristics */}
        {features.facial_features?.unique_characteristics && (
          <div className="bg-purple-50 p-3 rounded-lg">
            <h4 className="font-medium text-purple-800 mb-2">✨ Unique Features</h4>
            <div className="text-sm">
              {features.facial_features.unique_characteristics.join(', ')}
            </div>
          </div>
        )}

        {/* Overall Appearance */}
        {features.facial_features?.overall_appearance && (
          <div className="bg-indigo-50 p-3 rounded-lg">
            <h4 className="font-medium text-indigo-800 mb-2">🎯 Overall Appearance</h4>
            <div className="text-sm">{features.facial_features.overall_appearance}</div>
          </div>
        )}

        {/* Analysis Confidence */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Analysis Confidence:</span> {features.analysis_confidence}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-4">
            {imageDataUrl ? (
              <img src={imageDataUrl} alt="uploaded" className="mx-auto max-h-[60vh] object-contain" />
            ) : (
              <div className="text-center text-gray-500">Upload an image to analyze age with DeepFace and extract facial features with Gemini AI</div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-50 cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              Upload Image
            </label>
            <button onClick={handlePredict} className="rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-50" disabled={!imageDataUrl || isLoading}>
              {isLoading ? 'Analyzing...' : 'Analyze with AI'}
            </button>
          </div>

          {error && <div className="rounded-md bg-red-50 px-4 py-2 text-red-700 text-sm">{error}</div>}
          
          {age != null && (
            <div className="w-full max-w-2xl">
              <div className="rounded-md bg-emerald-50 px-4 py-3 text-emerald-700 text-center mb-4">
                <div className="text-lg font-semibold">Predicted Age: {age} years</div>
              </div>
              
              {facialFeatures && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  {renderFacialFeatures(facialFeatures)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 