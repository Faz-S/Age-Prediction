import { useState } from 'react'

export default function AgeAI() {
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [age, setAge] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  function handleUpload(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUrl(reader.result)
      setAge(null)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  async function handlePredict() {
    if (!imageDataUrl) return
    setIsLoading(true)
    setError('')
    setAge(null)
    try {
      const res = await fetch('/api/age-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Prediction failed')
      setAge(data.age)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-4">
            {imageDataUrl ? (
              <img src={imageDataUrl} alt="uploaded" className="mx-auto max-h-[60vh] object-contain" />
            ) : (
              <div className="text-center text-gray-500">Upload an image to analyze age with DeepFace</div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-50 cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              Upload Image
            </label>
            <button onClick={handlePredict} className="rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-50" disabled={!imageDataUrl || isLoading}>
              {isLoading ? 'Predicting...' : 'Predict Age (DeepFace)'}
            </button>
          </div>

          {error && <div className="rounded-md bg-red-50 px-4 py-2 text-red-700 text-sm">{error}</div>}
          {age != null && <div className="rounded-md bg-emerald-50 px-4 py-2 text-emerald-700 text-sm">Predicted Age: {age}</div>}
        </div>
      </div>
    </div>
  )
} 