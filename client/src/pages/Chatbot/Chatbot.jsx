import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import config from '../../config.js'

export default function Chatbot() {
	const location = useLocation()
	const [messages, setMessages] = useState([])
	const [inputValue, setInputValue] = useState('')
	const [isTyping, setIsTyping] = useState(false)
	const [typingText, setTypingText] = useState('')
	const [facialFeaturesStored, setFacialFeaturesStored] = useState(false)
	const [messagesEndRef, setMessagesEndRef] = useState(null)
	const [inputRef, setInputRef] = useState(null)
	const [predictedAge, setPredictedAge] = useState(null)
	const [ageGroup, setAgeGroup] = useState('')
	const [showTopicsModal, setShowTopicsModal] = useState(false)

	// Get predicted age from navigation state
	useEffect(() => {
		if (location.state?.predictedAge) {
			const age = location.state.predictedAge
			setPredictedAge(age)
			
			// Determine age group for appropriate responses
			if (age < 13) {
				setAgeGroup('child')
			} else if (age < 18) {
				setAgeGroup('teen')
			} else if (age < 65) {
				setAgeGroup('adult')
			} else {
				setAgeGroup('senior')
			}

			// Add age-specific welcome message
			let welcomeMessage = "";
			if (age < 13) {
				welcomeMessage = `Hi there! I've analyzed your facial features and can see you're ${Math.round(age)} years old. Based on your facial development, I'll give you personalized health advice perfect for building healthy habits early!`;
			} else if (age < 18) {
				welcomeMessage = `Hey! My AI analysis shows you're ${Math.round(age)} years old with developing facial features. I'll provide teen-friendly health guidance that considers your unique development stage!`;
			} else if (age < 30) {
				welcomeMessage = `Hello! My facial analysis indicates you're ${Math.round(age)} years old with mature facial features. I'll focus on building sustainable health routines tailored to your development stage!`;
			} else if (age < 50) {
				welcomeMessage = `Welcome! My AI analysis shows you're ${Math.round(age)} with well-developed facial characteristics. I'll emphasize preventive care and managing age-related changes!`;
			} else {
				welcomeMessage = `Greetings! My facial analysis reveals you're ${Math.round(age)} years young with mature facial features. I'll focus on maintaining mobility and cognitive health!`;
			}

			setMessages([{
				id: 1,
				type: 'ai',
				content: welcomeMessage,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}])
		} else {
			// Show loading message if no age detected
			setMessages([{
				id: 1,
				type: 'ai',
				content: "Hi! I'm Ager, your health AI assistant. I'm detecting your age to provide personalized health guidance...",
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}])
		}
	}, [location.state])

	const scrollToBottom = () => {
		messagesEndRef?.scrollIntoView({ behavior: 'smooth' })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	const callHealthChatAPI = async (message, age, ageGroup, conversationHistory) => {
		try {
			const token = localStorage.getItem('token')
			const requestBody = {
				message: message,
				age: age,
				ageGroup: ageGroup,
				conversationHistory: conversationHistory.slice(-5) // Send last 5 exchanges
			}
			
			console.log('Sending request to /api/health-chat:', requestBody)
			console.log('Age type:', typeof age, 'Value:', age)
			
			const response = await fetch(config.getApiUrl('/api/health-chat'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				console.error('Backend error response:', errorData)
				throw new Error(errorData.message || 'Failed to get AI response')
			}

			const data = await response.json()
			return data.response
		} catch (error) {
			console.error('Health Chat API Error:', error)
			throw error
		}
	}

	const handleSendMessage = async () => {
		if (!inputValue.trim()) return

		// Check if we have the predicted age
		if (!predictedAge) {
			const errorMessage = {
				id: Date.now(),
				type: 'ai',
				content: "I need to know your age to provide appropriate health advice. Please go back to the home page and complete the age prediction first.",
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}
			setMessages(prev => [...prev, errorMessage])
			return
		}

		const userMessage = {
			id: Date.now(),
			type: 'user',
			content: inputValue.trim(),
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		}

		setMessages(prev => [...prev, userMessage])
		setInputValue('')
		setIsTyping(true)
		setTypingText('')

		try {
			// Call backend health chat API with conversation history
			const aiResponseText = await callHealthChatAPI(userMessage.content, predictedAge, ageGroup, messages)
			
			// Add to conversation history for topic tracking
			addToConversationHistory(userMessage.content, aiResponseText);
			
			// Start smooth typing animation
			animateTyping(aiResponseText, (finalText) => {
				const aiResponse = {
					id: Date.now() + 1,
					type: 'ai',
					content: finalText,
					timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
				}
				
				// Add the AI response to messages
				setMessages(prev => [...prev, aiResponse])
				setIsTyping(false)
				setTypingText('')
			})
		} catch (error) {
			// Fallback response if API fails
			const fallbackResponse = {
				id: Date.now() + 1,
				type: 'ai',
				content: "I'm having trouble connecting to my AI system right now. Please try again in a moment, or ask me a different health-related question.",
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}
			setMessages(prev => [...prev, fallbackResponse])
			setIsTyping(false)
		}
	}

	const handleKeyPress = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSendMessage()
		}
	}

	const formatMessageContent = (content) => {
		// Split content into sections based on common patterns
		const sections = content.split(/(?=^- |^• |^[0-9]+\. |^Tip:|^Remember:|^Safety:|^Age-specific factors:)/gm);
		
		return sections.map((section, index) => {
			const trimmedSection = section.trim();
			if (!trimmedSection) return null;
			
			// Check if it's a tip, safety note, or age-specific content
			const isTip = /^(Tip|Remember|Safety|Age-specific factors):/i.test(trimmedSection);
			const isBulletPoint = /^[-•]/i.test(trimmedSection);
			const isNumbered = /^[0-9]+\./i.test(trimmedSection);
			
			if (isTip) {
				return (
					<div key={index} className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg mb-2">
						<p className="text-sm text-blue-800 font-medium">{trimmedSection}</p>
					</div>
				);
			} else if (isBulletPoint || isNumbered) {
				return (
					<div key={index} className="ml-4 mb-1">
						<p className="text-sm text-gray-700">{trimmedSection}</p>
					</div>
				);
			} else {
				return (
					<p key={index} className="text-sm leading-relaxed mb-2">
						{trimmedSection}
					</p>
				);
			}
		}).filter(Boolean);
	};

	// Smooth typing animation function with variable speeds
	const animateTyping = (text, callback) => {
		let index = 0;
		setTypingText('');
		
		const typeNextChar = () => {
			if (index < text.length) {
				setTypingText(prev => prev + text[index]);
				index++;
				
				// Variable typing speed for more natural feel
				let delay = 30; // Default speed
				
				// Slow down for punctuation
				if (['.', '!', '?', ':', ';'].includes(text[index - 1])) {
					delay = 150;
				}
				// Slow down for commas
				else if (text[index - 1] === ',') {
					delay = 80;
				}
				// Speed up for spaces
				else if (text[index - 1] === ' ') {
					delay = 15;
				}
				// Random slight variations for natural feel
				else {
					delay = 25 + Math.random() * 20;
				}
				
				setTimeout(typeNextChar, delay);
			} else {
				callback(text);
			}
		};
		
		typeNextChar();
	};

	// Track conversation topics to avoid repetition
	const [conversationHistory, setConversationHistory] = useState([]);
	const [conversationTopics, setConversationTopics] = useState(new Set());
	
	// Add conversation tracking to avoid repetitive responses
	const addToConversationHistory = (message, response) => {
		const newExchange = { message, response, timestamp: Date.now() };
		setConversationHistory(prev => [...prev.slice(-10), newExchange]);
		
		// Extract key topics from the exchange
		const messageWords = message.toLowerCase().split(/\s+/);
		const responseWords = response.toLowerCase().split(/\s+/);
		const allWords = [...messageWords, ...responseWords];
		
		// Add health-related keywords to topics
		const healthKeywords = ['exercise', 'diet', 'sleep', 'stress', 'nutrition', 'fitness', 'mental', 'physical', 'health', 'wellness', 'symptoms', 'pain', 'medicine', 'doctor', 'treatment'];
		const newTopics = allWords.filter(word => healthKeywords.some(keyword => word.includes(keyword)));
		
		setConversationTopics(prev => new Set([...prev, ...newTopics]));
	};
	
	// Check if a topic has been discussed recently
	const isTopicRecent = (message) => {
		const messageLower = message.toLowerCase();
		return Array.from(conversationTopics).some(topic => messageLower.includes(topic));
	};

	// Handle escape key to close modal
	useEffect(() => {
		const handleEscape = (e) => {
			if (e.key === 'Escape' && showTopicsModal) {
				setShowTopicsModal(false);
			}
		};

		if (showTopicsModal) {
			document.addEventListener('keydown', handleEscape);
			// Prevent body scroll when modal is open
			document.body.style.overflow = 'hidden';
		}

		return () => {
			document.removeEventListener('keydown', handleEscape);
			document.body.style.overflow = 'unset';
		};
	}, [showTopicsModal]);

	// Topics Modal Component
	const TopicsModal = () => {
		if (!showTopicsModal) return null;

		const topics = Array.from(conversationTopics);
		
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className="fixed inset-0 bg-gray-900 bg-opacity-30 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
				onClick={() => setShowTopicsModal(false)}
			>
				<motion.div
					initial={{ scale: 0.9, y: 20, opacity: 0 }}
					animate={{ scale: 1, y: 0, opacity: 1 }}
					exit={{ scale: 0.9, y: 20, opacity: 0 }}
					transition={{ 
						type: "spring", 
						stiffness: 300, 
						damping: 30 
					}}
					className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden border border-gray-200 ring-4 ring-white/20"
					onClick={(e) => e.stopPropagation()}
				>
					{/* Header */}
					<div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 relative overflow-hidden">
						{/* Background decoration */}
						<div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-y-16 translate-x-16"></div>
						<div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full translate-y-12 -translate-x-12"></div>
						
						<div className="relative z-10">
							<div className="flex items-center justify-between">
								<h3 className="text-xl font-bold">Conversation Topics</h3>
								<button
									onClick={() => setShowTopicsModal(false)}
									className="text-white hover:text-gray-200 transition-colors p-1 hover:bg-white hover:bg-opacity-20 rounded-full"
								>
									<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
							<p className="text-blue-100 mt-2">Health topics we've discussed</p>
						</div>
					</div>

					{/* Content */}
					<div className="p-6">
						{topics.length > 0 ? (
							<div className="space-y-3">
								{topics.map((topic, index) => (
									<motion.div
										key={index}
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.1, duration: 0.3 }}
										className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:from-blue-50 hover:to-blue-100 transition-all duration-200 border border-gray-200 hover:border-blue-300 hover:shadow-md"
									>
										<div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
										<span className="text-gray-700 font-medium capitalize">{topic}</span>
									</motion.div>
								))}
							</div>
						) : (
							<motion.div 
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.2 }}
								className="text-center py-8"
							>
								<div className="text-gray-400 text-6xl mb-4 animate-bounce">💬</div>
								<p className="text-gray-500 text-lg">No specific topics discussed yet</p>
								<p className="text-gray-400 text-sm mt-2">Start a conversation to see topics here</p>
							</motion.div>
						)}
					</div>

					{/* Footer */}
					<div className="border-t border-gray-200 p-4 bg-gray-50">
						<button
							onClick={() => setShowTopicsModal(false)}
							className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
						>
							Close
						</button>
					</div>
				</motion.div>
			</motion.div>
		);
	};

	return (
		<div className="min-h-screen bg-white flex flex-col">
			{/* Header */}
			<header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				<div className="flex items-center space-x-3">
					<div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
						<div className="w-4 h-4 bg-white rounded-sm"></div>
					</div>
					<div>
						<h1 className="text-xl font-semibold text-gray-900">Ager</h1>
						<p className="text-xs text-gray-500">Health AI Assistant </p>
					</div>
				</div>
				
									<div className="flex items-center space-x-2">
						{/* Reset Conversation Button */}
						<button 
							onClick={() => {
								setMessages(prev => prev.slice(0, 1)); // Keep only welcome message
								setConversationHistory([]);
								setConversationTopics(new Set());
							}}
							className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
							title="Start fresh conversation"
						>
							🔄 Reset Chat
						</button>
					</div>
				{predictedAge && (
					<div className="text-right">
						<p className="text-sm font-medium text-gray-900">Age: {Math.round(predictedAge)}</p>
						<p className="text-xs text-gray-500">{ageGroup === 'child' ? 'Child' : ageGroup === 'teen' ? 'Teen' : ageGroup === 'adult' ? 'Adult' : 'Senior'}</p>
						{/* Age-specific health focus indicator */}
						<div className="mt-1">
							{predictedAge < 13 && <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Building Healthy Habits</span>}
							{predictedAge >= 13 && predictedAge < 18 && <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Growth & Development</span>}
							{predictedAge >= 18 && predictedAge < 30 && <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">Establishing Routines</span>}
							{predictedAge >= 30 && predictedAge < 50 && <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">Maintaining Health</span>}
							{predictedAge >= 50 && <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Wellness & Prevention</span>}
						</div>
						{/* Facial Analysis Indicator */}
						<div className="mt-2">
							<span className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-3 py-1 rounded-full animate-pulse">
								🔍 AI Facial Analysis Active
							</span>
						</div>
					</div>
				)}
			</header>

			{/* Main Chat Area */}
			<main className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
				<AnimatePresence>
					{messages.map((message) => (
						<motion.div
							key={message.id}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							transition={{ duration: 0.3 }}
							className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
						>
							<div className={`max-w-[70%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
								<div className={`rounded-2xl px-4 py-3 ${
									message.type === 'user' 
										? 'bg-blue-600 text-white' 
										: 'bg-gray-100 text-gray-900'
								}`}>
									{formatMessageContent(message.content)}
								</div>
								<div className={`text-xs text-gray-500 mt-2 ${
									message.type === 'user' ? 'text-right' : 'text-left'
								}`}>
									{message.timestamp}
								</div>
							</div>
							{message.type === 'ai' && (
								<div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center ml-3 order-1">
									<div className="w-4 h-4 bg-white rounded-sm"></div>
								</div>
							)}
						</motion.div>
					))}
				</AnimatePresence>

				{/* Typing Indicator */}
				{isTyping && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="flex justify-start"
					>
						<div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
							<div className="w-4 h-4 bg-white rounded-sm"></div>
						</div>
						<div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-[70%]">
							<p className="text-sm text-gray-700">
								{typingText}
								<span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
							</p>
						</div>
					</motion.div>
				)}

				<div ref={setMessagesEndRef} />
			</main>

			{/* Topic Repetition Warning */}
			{inputValue.trim() && isTopicRecent(inputValue) && (
				<div className="px-6 py-2">
					<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
						<div className="flex items-center space-x-2">
							<span className="text-yellow-600">⚠️</span>
							<p className="text-sm text-yellow-800">
								<strong>Topic reminder:</strong> This health topic was discussed recently. I'll provide fresh insights and avoid repetition.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Input Area - Fixed at bottom */}
			<footer className="border-t border-gray-200 px-6 py-4 mt-auto">
				<div className="flex items-center space-x-3">
					{/* Left Icons */}
					<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
						<span className="text-gray-600 text-lg">🏥</span>
					</button>
					<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
						<span className="text-gray-600 text-lg">💊</span>
					</button>
					<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
						<span className="text-gray-600 text-lg">🏃</span>
					</button>

					{/* Input Field */}
					<div className="flex-1 relative">
						<input
							ref={setInputRef}
							type="text"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder="Ask me about health, exercise, nutrition, or wellness..."
							className="w-full px-4 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 placeholder-gray-500"
						/>
					</div>

					{/* Right Icons */}
					<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
						<span className="text-gray-600 text-lg">📋</span>
					</button>
					<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
						<span className="text-gray-600 text-lg">ℹ️</span>
					</button>
				</div>

				{/* Topics Button - Moved here to avoid overlap */}
				<div className="flex justify-center mt-3">
					<button 
						onClick={() => setShowTopicsModal(true)}
						disabled={isTyping || typingText.length > 0}
						className={`relative px-4 py-2 text-sm rounded-lg transition-all duration-200 border ${
							isTyping || typingText.length > 0
								? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 animate-pulse'
								: 'bg-blue-100 hover:bg-blue-200 text-blue-600 hover:shadow-md border-blue-200'
						}`}
						title={isTyping || typingText.length > 0 ? "Wait for AI to finish typing" : "View conversation topics"}
					>
						{isTyping || typingText.length > 0 ? (
							<>
								<span className="inline-block w-4 h-4 mr-2">
									<div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
								</span>
								AI Typing...
							</>
						) : (
							<>📋 Topics Covered</>
						)}
						{conversationTopics.size > 0 && (
							<span className={`absolute -top-1 -right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${
								isTyping || typingText.length > 0 ? 'bg-gray-400' : 'bg-red-500'
							} text-white`}>
								{conversationTopics.size}
							</span>
						)}
					</button>
				</div>

				{/* Footer Disclaimer */}
				<div className="text-center mt-4">
					<p className="text-xs text-gray-500">
						Ager provides general health information only. Always consult healthcare professionals for medical advice. Not a substitute for professional medical care.
					</p>
				</div>
			</footer>
			
			{/* Topics Modal */}
			<AnimatePresence>
				<TopicsModal />
			</AnimatePresence>
		</div>
	)
}
