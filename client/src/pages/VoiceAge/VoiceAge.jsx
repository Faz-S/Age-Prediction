import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export default function VoiceAge() {
	const navigate = useNavigate()
	const [isRecording, setIsRecording] = useState(false)
	const [audioBlob, setAudioBlob] = useState(null)
	const [audioUrl, setAudioUrl] = useState(null)
	const [predictedAge, setPredictedAge] = useState(null)
	const [isProcessing, setIsProcessing] = useState(false)
	const [error, setError] = useState(null)
	const [showSentence, setShowSentence] = useState(true)
	
	const mediaRecorderRef = useRef(null)
	const audioChunksRef = useRef([])

	// Sample sentences for users to read (age-appropriate and clear)
	const sampleSentences = [
		"The quick brown fox jumps over the lazy dog while the sun shines brightly in the clear blue sky.",
		"Technology has transformed our world in remarkable ways, making communication faster and more accessible than ever before.",
		"Health and wellness are essential aspects of life that contribute to our overall happiness and well-being.",
		"Education opens doors to new opportunities and helps us understand the world around us better.",
		"Nature provides us with beauty, resources, and inspiration that enrich our daily lives."
	]

	const [currentSentence] = useState(sampleSentences[Math.floor(Math.random() * sampleSentences.length)])

	useEffect(() => {
		// Cleanup audio URL when component unmounts
		return () => {
			if (audioUrl) {
				URL.revokeObjectURL(audioUrl)
			}
		}
	}, [audioUrl])

	const startRecording = async () => {
		try {
			setError(null)
			setAudioBlob(null)
			setAudioUrl(null)
			setPredictedAge(null)
			
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			mediaRecorderRef.current = new MediaRecorder(stream)
			audioChunksRef.current = []

			mediaRecorderRef.current.ondataavailable = (event) => {
				audioChunksRef.current.push(event.data)
			}

			mediaRecorderRef.current.onstop = () => {
				const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
				setAudioBlob(audioBlob)
				const url = URL.createObjectURL(audioBlob)
				setAudioUrl(url)
				
				// Stop all tracks
				stream.getTracks().forEach(track => track.stop())
			}

			mediaRecorderRef.current.start()
			setIsRecording(true)
			setShowSentence(false)
		} catch (err) {
			setError('Unable to access microphone. Please check permissions.')
			console.error('Error accessing microphone:', err)
		}
	}

	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop()
			setIsRecording(false)
		}
	}

	const predictAgeFromVoice = async () => {
		if (!audioBlob) return

		setIsProcessing(true)
		setError(null)

		try {
			// Create FormData to send audio file
			const formData = new FormData()
			formData.append('audio', audioBlob, 'voice_recording.wav')

			// Send to backend for age prediction
			const response = await fetch('/api/voice-age-prediction', {
				method: 'POST',
				body: formData
			})

			if (!response.ok) {
				throw new Error('Failed to predict age from voice')
			}

			const result = await response.json()
			setPredictedAge(result.predicted_age)
		} catch (err) {
			setError('Failed to predict age from voice. Please try again.')
			console.error('Error predicting age:', err)
		} finally {
			setIsProcessing(false)
		}
	}

	const retryRecording = () => {
		setAudioBlob(null)
		setAudioUrl(null)
		setPredictedAge(null)
		setError(null)
		setShowSentence(true)
	}

	const continueToChatbot = () => {
		navigate('/chatbot', { state: { predictedAge } })
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
			<div className="max-w-2xl w-full">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					className="text-center mb-8"
				>
					<h1 className="text-4xl font-bold text-gray-900 mb-4">🎤 Voice Age Prediction</h1>
					<p className="text-lg text-gray-600">
						Speak clearly and naturally to get an accurate age prediction
					</p>
				</motion.div>

				{/* Main Content */}
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="bg-white rounded-2xl shadow-xl p-8"
				>
					{/* Step 1: Show Sentence */}
					<AnimatePresence mode="wait">
						{showSentence && (
							<motion.div
								key="sentence"
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 20 }}
								className="text-center mb-8"
							>
								<div className="mb-6">
									<div className="text-2xl mb-4">📝</div>
									<h2 className="text-xl font-semibold text-gray-800 mb-4">
										Please read this sentence clearly:
									</h2>
									<div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300">
										<p className="text-lg text-gray-700 leading-relaxed font-medium">
											"{currentSentence}"
										</p>
									</div>
								</div>
								
								<button
									onClick={startRecording}
									className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
								>
									🎤 Start Recording
								</button>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Step 2: Recording */}
					<AnimatePresence mode="wait">
						{isRecording && (
							<motion.div
								key="recording"
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className="text-center mb-8"
							>
								<div className="mb-6">
									<div className="text-4xl mb-4 animate-pulse">🔴</div>
									<h2 className="text-xl font-semibold text-gray-800 mb-4">
										Recording in progress...
									</h2>
									<p className="text-gray-600 mb-6">
										Read the sentence clearly and naturally
									</p>
									<div className="bg-red-50 p-4 rounded-xl border border-red-200">
										<p className="text-red-700 font-medium">
											"{currentSentence}"
										</p>
									</div>
								</div>
								
								<button
									onClick={stopRecording}
									className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
								>
									⏹️ Stop Recording
								</button>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Step 3: Audio Playback */}
					<AnimatePresence mode="wait">
						{audioUrl && !predictedAge && (
							<motion.div
								key="playback"
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className="text-center mb-8"
							>
								<div className="mb-6">
									<div className="text-3xl mb-4">🎵</div>
									<h2 className="text-xl font-semibold text-gray-800 mb-4">
										Review Your Recording
									</h2>
									
									{/* Audio Player */}
									<div className="bg-gray-50 p-6 rounded-xl mb-6">
										<audio controls className="w-full">
											<source src={audioUrl} type="audio/wav" />
											Your browser does not support the audio element.
										</audio>
									</div>
									
									<div className="flex flex-col sm:flex-row gap-4 justify-center">
										<button
											onClick={predictAgeFromVoice}
											disabled={isProcessing}
											className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:transform-none"
										>
											{isProcessing ? '🔄 Processing...' : '🔮 Predict Age'}
										</button>
										
										<button
											onClick={retryRecording}
											className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
										>
											🔄 Retry Recording
										</button>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Step 4: Results */}
					<AnimatePresence mode="wait">
						{predictedAge && (
							<motion.div
								key="results"
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className="text-center"
							>
								<div className="mb-6">
									<div className="text-6xl mb-4">🎉</div>
									<h2 className="text-2xl font-bold text-gray-800 mb-4">
										Age Prediction Complete!
									</h2>
									
									<div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-xl mb-6">
										<div className="text-4xl font-bold mb-2">
											{Math.round(predictedAge)} years old
										</div>
										<p className="text-blue-100">
											Based on your voice analysis
										</p>
									</div>
									
									<div className="flex flex-col sm:flex-row gap-4 justify-center">
										<button
											onClick={continueToChatbot}
											className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
										>
											💬 Continue to Chatbot
										</button>
										
										<button
											onClick={retryRecording}
											className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
										>
											🔄 Try Again
										</button>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Error Display */}
					<AnimatePresence mode="wait">
						{error && (
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6"
							>
								<div className="flex items-center space-x-3">
									<div className="text-red-500 text-xl">⚠️</div>
									<div>
										<p className="text-red-700 font-medium">{error}</p>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Back Button */}
					<div className="text-center mt-8">
						<button
							onClick={() => navigate('/home')}
							className="text-gray-600 hover:text-gray-800 font-medium transition-colors flex items-center justify-center space-x-2 mx-auto"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
							<span>Back to Age Prediction</span>
						</button>
					</div>
				</motion.div>

				{/* Info Section */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
					className="mt-8 text-center"
				>
					<div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg">
						<h3 className="text-lg font-semibold text-gray-800 mb-3">ℹ️ How Voice Age Prediction Works</h3>
						<p className="text-gray-600 text-sm leading-relaxed">
							Our advanced AI analyzes various voice characteristics including pitch, tone, speech patterns, 
							and vocal features to estimate your age. The system uses state-of-the-art voice analysis 
							technology for accurate predictions.
						</p>
					</div>
				</motion.div>
			</div>
		</div>
	)
}
