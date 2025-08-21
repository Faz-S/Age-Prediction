import { useEffect, useRef, useState } from 'react'

export default function Home() {
	const videoElementRef = useRef(null)
	const mediaStreamRef = useRef(null)
	const [hasCaptured, setHasCaptured] = useState(false)
	const [capturedDataUrl, setCapturedDataUrl] = useState('')
	const [errorTitle, setErrorTitle] = useState('')
	const [errorHint, setErrorHint] = useState('')
	const [isStarting, setIsStarting] = useState(true)
	const [isPredicting, setIsPredicting] = useState(false)
	const [predictedLabel, setPredictedLabel] = useState('')
	const [predictedConfidence, setPredictedConfidence] = useState(null)

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
		}
	}, [])

	async function predictFromDataUrl(dataUrl) {
		setIsPredicting(true)
		setPredictedLabel('')
		setPredictedConfidence(null)
		try {
			const token = localStorage.getItem('token')
			const res = await fetch('/api/predict-age', {
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
			if (typeof data.confidence === 'number') setPredictedConfidence(data.confidence)
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
		await stopCamera()
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

	async function handleRetake() {
		setCapturedDataUrl('')
		setHasCaptured(false)
		setPredictedLabel('')
		setPredictedConfidence(null)
		await startCamera()
	}

	return (
		<div className="min-h-dvh bg-white">
			<div className="mx-auto max-w-6xl px-6 py-10">
				<div className="flex flex-col items-center gap-6">
					<div className="relative w-full h-[70vh] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden grid place-items-center">
						{errorTitle ? (
							<div className="px-6 text-center">
								<p className="font-semibold text-red-600">{errorTitle}</p>
								<p className="mt-1 text-sm text-gray-600">{errorHint}</p>
							</div>
						) : capturedDataUrl ? (
							<img src={capturedDataUrl} alt="Captured" className="h-full w-full object-contain" />
						) : (
							<video ref={videoElementRef} className="h-full w-full object-cover" autoPlay playsInline muted />
						)}
						{(isStarting || isPredicting) && !errorTitle && (
							<div className="absolute inset-0 grid place-items-center bg-white/30 backdrop-blur-sm">
								<div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-700 border-t-transparent" />
							</div>
						)}
					</div>

					<div className="flex items-center gap-3">
						{!capturedDataUrl ? (
							<button onClick={handleCapture} className="rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-50" disabled={!!errorTitle || isStarting || isPredicting}>
								Capture
							</button>
						) : (
							<button onClick={handleRetake} className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50" disabled={isStarting || isPredicting}>
								Retake
							</button>
						)}
						<label className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-50 cursor-pointer">
							<input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
							Upload Image
						</label>
						<button onClick={handlePredict} className="rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-50" disabled={!capturedDataUrl || isPredicting}>
							Predict
						</button>
						{errorTitle && (
							<button onClick={startCamera} className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-50">
								Retry
							</button>
						)}
					</div>

					{hasCaptured && (
						<div className="rounded-md bg-emerald-50 px-4 py-2 text-emerald-700 text-sm">
							{predictedLabel ? `Predicted: ${predictedLabel}${predictedConfidence != null ? ` (${predictedConfidence}%)` : ''}` : 'Image captured'}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}