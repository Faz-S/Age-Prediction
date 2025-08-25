import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import DoodleLeft from '../../assets/Transhumans - Bueno.png'

export default function Home() {
	const videoElementRef = useRef(null)
	const mediaStreamRef = useRef(null)
	const navigate = useNavigate()
	const [hasCaptured, setHasCaptured] = useState(false)
	const [capturedDataUrl, setCapturedDataUrl] = useState('')
	const [errorTitle, setErrorTitle] = useState('')
	const [errorHint, setErrorHint] = useState('')
	const [isStarting, setIsStarting] = useState(true)
	const [isPredicting, setIsPredicting] = useState(false)
	const [predictedLabel, setPredictedLabel] = useState('')
	const [predictedConfidence, setPredictedConfidence] = useState(null)
	const [predictedAge, setPredictedAge] = useState(null)
	
	// Voice recording states
	const [isRecordingVoice, setIsRecordingVoice] = useState(false)
	const [voiceActivityLevel, setVoiceActivityLevel] = useState(0)
	const [voiceError, setVoiceError] = useState(null)
	const [audioBlob, setAudioBlob] = useState(null)
	const [audioUrl, setAudioUrl] = useState(null)
	const [isProcessingVoice, setIsProcessingVoice] = useState(false)
	const [voicePredictedAge, setVoicePredictedAge] = useState(null)
	const [currentSentence, setCurrentSentence] = useState("The quick brown fox jumps over the lazy dog. This sentence contains all the letters of the alphabet.")
	const mediaRecorderRef = useRef(null)
	const audioChunksRef = useRef([])
	
	const sampleSentences = [
		"The quick brown fox jumps over the lazy dog. This sentence contains all the letters of the alphabet.",
		"Pack my box with five dozen liquor jugs. A pangram for testing voice recognition.",
		"How vexingly quick daft zebras jump! Another useful pangram for voice analysis.",
		"The five boxing wizards jump quickly. Perfect for testing voice clarity and pronunciation."
	]

	async function stopCamera() {
		const stream = mediaStreamRef.current
		if (stream) {
			stream.getTracks().forEach((t) => t.stop())
		}
		mediaStreamRef.current = null
		if (videoElementRef.current) {
			videoElementRef.current.srcObject = null
		}
	}

	async function startCamera() {
		setIsStarting(true)
		setErrorTitle('')
		setErrorHint('')
		setHasCaptured(false)
		setPredictedLabel('')
		setPredictedConfidence(null)
		setPredictedAge(null)
		try {
			if (!('mediaDevices' in navigator)) {
				setErrorTitle('Camera API not supported')
				setErrorHint('Use a modern browser like Chrome, Edge, or Firefox.')
				return
			}
			const constraints = { video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }
			const stream = await navigator.mediaDevices.getUserMedia(constraints)
			mediaStreamRef.current = stream
			if (videoElementRef.current) {
				videoElementRef.current.srcObject = stream
				await videoElementRef.current.play()
			}
		} catch (error) {
			const name = error && error.name ? error.name : 'UnknownError'
			if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
				setErrorTitle('Camera permission denied')
				setErrorHint('Click the lock icon in the address bar and allow camera access, then reload.')
			} else if (name === 'NotReadableError') {
				setErrorTitle('Camera is busy')
				setErrorHint('Close other apps using the camera (Teams, Zoom, etc.) and try again.')
			} else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
				setErrorTitle('No camera found')
				setErrorHint('Plug in a camera or switch to a device with a camera.')
			} else if (name === 'SecurityError') {
				setErrorTitle('Insecure context')
				setErrorHint('Open the app on http://localhost (not a LAN IP). HTTPS is required on non-localhost origins.')
			} else {
				setErrorTitle('Unable to access camera')
				setErrorHint('Please allow permission and try again, or check OS privacy settings.')
			}
			console.error(error)
		} finally {
			setIsStarting(false)
		}
	}

	useEffect(() => {
		startCamera()
		return () => {
			stopCamera()
			// Cleanup voice recording interval
			if (window.voiceActivityInterval) {
				clearInterval(window.voiceActivityInterval)
				window.voiceActivityInterval = null
			}
			// Cleanup audio URL
			if (audioUrl) {
				URL.revokeObjectURL(audioUrl)
			}
		}
	}, [audioUrl])

	async function predictFromDataUrl(dataUrl) {
		setIsPredicting(true)
		setPredictedLabel('')
		setPredictedConfidence(null)
		setPredictedAge(null)
		try {
			const token = localStorage.getItem('token')
			const res = await fetch('/api/age-ai', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ image: dataUrl }),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.message || 'Prediction failed')
			if (typeof data.label === 'string') setPredictedLabel(data.label)
			// Persist short photo description for Wellness page
			if (typeof data.photo_description === 'string' && data.photo_description.trim()) {
				try { localStorage.setItem('photoDescription', data.photo_description.trim()) } catch {}
			}
			let ageNum = null
			if (typeof data.age === 'number' && isFinite(data.age)) {
				ageNum = data.age
			} else if (typeof data.label === 'string') {
				const m = data.label.match(/(\d+)\s*-\s*(\d+)/)
				if (m) {
					ageNum = (parseInt(m[1], 10) + parseInt(m[2], 10)) / 2
				}
			}
			if (ageNum != null) {
				const clamped = Math.max(0, Math.min(100, ageNum))
				setPredictedAge(clamped)
				// Persist predicted age for Wellness page
				try { localStorage.setItem('predictedAge', String(Math.round(clamped))) } catch {}
			}
		} catch (e) {
			setErrorTitle('Prediction error')
			setErrorHint('Please try again.')
		} finally {
			setIsPredicting(false)
		}
	}

	async function handleCapture() {
		const video = videoElementRef.current
		if (!video || video.videoWidth === 0 || video.videoHeight === 0) return
		const canvas = document.createElement('canvas')
		canvas.width = video.videoWidth
		canvas.height = video.videoHeight
		const context = canvas.getContext('2d')
		context.drawImage(video, 0, 0)
		const dataUrl = canvas.toDataURL('image/png')
		setCapturedDataUrl(dataUrl)
		setHasCaptured(true)
		await stopCamera() // Turn off camera immediately after capture
	}

	async function handleUpload(e) {
		const file = e.target.files && e.target.files[0]
		if (!file) return
		const reader = new FileReader()
		reader.onload = async () => {
			const dataUrl = reader.result
			setCapturedDataUrl(dataUrl)
			setHasCaptured(true)
		}
		reader.readAsDataURL(file)
	}

	async function handlePredict() {
		if (!capturedDataUrl) return
		await predictFromDataUrl(capturedDataUrl)
	}

	// Voice recording functions
	const startVoiceRecording = async () => {
		try {
			setVoiceError(null)
			setIsRecordingVoice(true)
			setVoiceActivityLevel(0)
			setAudioBlob(null)
			setAudioUrl(null)
			setVoicePredictedAge(null)
			audioChunksRef.current = []
			
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const mediaRecorder = new MediaRecorder(stream)
			mediaRecorderRef.current = mediaRecorder
			
			mediaRecorder.ondataavailable = (event) => {
				audioChunksRef.current.push(event.data)
			}
			
			mediaRecorder.onstop = () => {
				const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
				setAudioBlob(audioBlob)
				setAudioUrl(URL.createObjectURL(audioBlob))
				stream.getTracks().forEach(track => track.stop())
			}
			
			mediaRecorder.start()
			
			// Simulate voice activity detection
			const interval = setInterval(() => {
				setVoiceActivityLevel(prev => {
					const newLevel = Math.min(100, prev + Math.random() * 20)
					return newLevel > 100 ? 0 : newLevel
				})
			}, 100)
			
			// Store interval for cleanup
			window.voiceActivityInterval = interval
			
		} catch (err) {
			setVoiceError('Unable to access microphone. Please check permissions.')
			console.error('Error accessing microphone:', err)
		}
	}

	const stopVoiceRecording = () => {
		setIsRecordingVoice(false)
		setVoiceActivityLevel(0)
		
		// Clear voice activity interval
		if (window.voiceActivityInterval) {
			clearInterval(window.voiceActivityInterval)
			window.voiceActivityInterval = null
		}
		
		if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
			mediaRecorderRef.current.stop()
		}
	}

	const predictAgeFromVoice = async () => {
		if (!audioBlob) return
		
		setIsProcessingVoice(true)
		setVoiceError(null)
		
		try {
			const formData = new FormData()
			formData.append('audio', audioBlob, 'voice.wav')
			
			const response = await fetch('/api/voice-age-prediction', {
				method: 'POST',
				body: formData
			})
			
			if (response.ok) {
				const data = await response.json()
				setVoicePredictedAge(data.predicted_age)
				// Persist and navigate to Wellness
				const ageNum = typeof data.predicted_age === 'number' ? data.predicted_age : null
				if (ageNum != null && isFinite(ageNum)) {
					const clamped = Math.max(0, Math.min(100, ageNum))
					try { localStorage.setItem('predictedAge', String(Math.round(clamped))) } catch {}
				}
			} else {
				setVoiceError('Failed to predict age from voice. Please try again.')
			}
		} catch (err) {
			setVoiceError('Error processing voice. Please try again.')
			console.error('Voice prediction error:', err)
		} finally {
			setIsProcessingVoice(false)
		}
	}

	const retryVoiceRecording = () => {
		setAudioBlob(null)
		setAudioUrl(null)
		setVoicePredictedAge(null)
		setVoiceError(null)
	}

	const refreshSentence = () => {
		const randomIndex = Math.floor(Math.random() * sampleSentences.length)
		setCurrentSentence(sampleSentences[randomIndex])
	}

	async function handleRetake() {
		setCapturedDataUrl('')
		setHasCaptured(false)
		setPredictedLabel('')
		setPredictedConfidence(null)
		setPredictedAge(null)
		await startCamera()
	}
  // removed duplicate block

const maxAge = 100
const displayedAge = predictedAge != null ? predictedAge : (voicePredictedAge != null ? voicePredictedAge : null)
const progressPercent = displayedAge != null ? Math.round((displayedAge / maxAge) * 100) : 0
// Define a small confidence range around the predicted age (±3 years)
const RANGE_SPREAD_YEARS = 6
const halfSpread = RANGE_SPREAD_YEARS / 2
const rangeStart = displayedAge != null ? Math.max(0, Math.min(maxAge, displayedAge - halfSpread)) : null
const rangeEnd = displayedAge != null ? Math.max(0, Math.min(maxAge, displayedAge + halfSpread)) : null
const rangeStartPct = rangeStart != null ? Math.round((rangeStart / maxAge) * 100) : 0
const rangeEndPct = rangeEnd != null ? Math.round((rangeEnd / maxAge) * 100) : 0
const rangeWidthPct = Math.max(2, rangeEndPct - rangeStartPct)

return (
  <div className="relative min-h-screen bg-[#fff]">
    {/* Decorative doodle */}
    {/* <img src={DoodleLeft} alt="decorative doodle" className="hidden sm:block pointer-events-none select-none absolute top-22 left-[-5px] w-40 " /> */}
    <div className="mx-auto max-w-7xl px-6 ">
      <div className="mb-8 flex flex-col items-center">
        <h1 className="text-4xl mt-2 font-bold text-gray-900">Age predictor</h1>
        <p className="mt-1 text-sm text-gray-600">Use your webcam or voice to estimate your age. Please enable camera and microphone permissions to get started.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Real-time Analysis */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-300 p-6">
          <h2 className="text-2xl font-bold text-gray-900">Real-time Analysis</h2>
          <p className="text-sm text-gray-500 mt-1">Our system uses your webcam and microphone to provide a personalized experience. Please enable access when prompted.</p>

          {/* Webcam area */}
          <div className="relative mt-4 w-full h-96 rounded-xl border border-gray-200 bg-gray-100 overflow-hidden grid place-items-center">
            {errorTitle ? (
              <div className="px-6 text-center">
                <p className="font-semibold text-red-600">{errorTitle}</p>
                <p className="mt-1 text-sm text-gray-600">{errorHint}</p>
              </div>
            ) : capturedDataUrl ? (
              <img src={capturedDataUrl} alt="Captured" className="h-full w-full object-contain" />
            ) : (
              <div className="text-center text-gray-400">
                <div className="text-5xl mb-2">🎥</div>
                <p className="text-sm">Webcam feed will appear here</p>
              </div>
            )}
            {!errorTitle && !capturedDataUrl && (
              <video ref={videoElementRef} className="absolute inset-0 h-full w-full object-cover" autoPlay playsInline muted />
            )}
            {(isStarting || isPredicting) && !errorTitle && (
              <div className="absolute inset-0 grid place-items-center bg-white/30 backdrop-blur-sm">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            {!capturedDataUrl ? (
              <button onClick={handleCapture} className="col-span-1 bg-[#26efe9] hover:bg-[#12dcd6] text-black px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50" disabled={!!errorTitle || isStarting || isPredicting}>
                <span>▢</span>
                Start Camera
              </button>
            ) : (
              <button onClick={handleRetake} className="col-span-1 bg-[#26efe9] hover:bg-[#12dcd6] text-black px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50" disabled={isStarting || isPredicting}>
                <span>📵</span>
                Stop Camera
              </button>
            )}
            <button onClick={startCamera} className="col-span-1 bg-gray-100  text-black px-4 py-2 rounded-lg font-semibold">Retry</button>
            {!capturedDataUrl ? (
              <button onClick={handlePredict} className="col-span-1 bg-gray-100 text-gray-500 px-4 py-2 rounded-lg font-semibold" disabled>
                Predict Age
              </button>
            ) : (
              <button onClick={handlePredict} className="col-span-1 bg-[#26efe9] hover:bg-[#12dcd6] text-black px-4 py-2 rounded-lg font-semibold disabled:opacity-50" disabled={isPredicting}>
                Predict Age
              </button>
            )}
          </div>
        </div>

        {/* Right: Audio Input */}
        <div className="bg-white rounded-2xl border border-gray-300 p-6 min-h-[26rem] flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900">Audio Input</h2>
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎙️</span>
                <span>Please read the following:</span>
              </div>
              <button onClick={refreshSentence} className="text-gray-500 hover:text-gray-700" title="Get new sentence">↻</button>
            </div>
            <p className="mt-3 text-sm text-gray-700 min-h-24">{currentSentence}</p>
            <div className="mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`${isRecordingVoice ? 'bg-black' : 'bg-gray-400'} h-full transition-all`} style={{ width: `${voiceActivityLevel}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">{isRecordingVoice ? 'Recording in progress...' : 'Voice activity detected'}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 space-y-3 mt-auto">
            {!isRecordingVoice && !audioBlob ? (
              <button onClick={startVoiceRecording} className="w-full bg-[#26efe9] hover:bg-[#12dcd6] text-black px-4 py-2 rounded-lg font-semibold">Start Recording</button>
            ) : isRecordingVoice ? (
              <button onClick={stopVoiceRecording} className="w-full bg-[#26efe9] hover:bg-[#12dcd6] text-black px-4 py-2 rounded-lg font-semibold">Stop Recording</button>
            ) : (
              <>
                <button onClick={predictAgeFromVoice} className="w-full bg-[#26efe9] hover:bg-[#12dcd6] text-black px-4 py-2 rounded-lg font-semibold" disabled={isProcessingVoice}>{isProcessingVoice ? 'Processing…' : 'Predict Age'}</button>
                <button onClick={retryVoiceRecording} className="w-full bg-gray-100 text-black px-4 py-2 rounded-lg font-semibold">Retry</button>
              </>
            )}
          </div>

          {audioUrl && (
            <div className="mt-3">
              <audio controls className="w-full h-10 rounded-md">
                <source src={audioUrl} type="audio/wav" />
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {voiceError && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md text-center text-xs text-red-700">{voiceError}</div>
          )}
          {voicePredictedAge && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md text-center text-xs text-green-700">Voice Age Prediction: {Math.round(voicePredictedAge)} years</div>
          )}
        </div>
      </div>

      {/* Results */}
      {displayedAge != null && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Estimated Age</h3>
            {/* <button onClick={() => navigate('/chatbot', { state: { predictedAge: predictedAge } })} className="text-sm text-blue-600 hover:text-blue-700">Chatbot</button> */}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>0</span>
              <span>100</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-gray-200 overflow-hidden relative">
              {/* Range band */}
              {displayedAge != null && (
                <div
                  className="absolute top-0 h-full bg-blue-300/70"
                  style={{ left: `${rangeStartPct}%`, width: `${rangeWidthPct}%` }}
                />
              )}
              {/* Predicted age marker */}
              {displayedAge != null && (
                <div
                  className="absolute top-0 h-full bg-blue-700"
                  style={{ left: `${progressPercent}%`, width: '2px', transform: 'translateX(-1px)' }}
                  title={`Predicted: ${Math.round(displayedAge)}`}
                />
              )}
            </div>
            <div className="text-center text-gray-700 mt-3">
              <span className="text-xl font-semibold">{Math.round(displayedAge)} years</span>
              <div className="text-xs text-gray-400 mt-1">
                Range: {Math.round(rangeStart)}–{Math.round(rangeEnd)} years • Predicted: {Math.round(displayedAge)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => navigate('/wellness', { state: { age: displayedAge } })}
              className="inline-flex items-center rounded-lg bg-[#26efe9] hover:bg-[#12dcd6] text-black px-5 py-2 font-semibold"
            >
              Continue to Wellness
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)
}