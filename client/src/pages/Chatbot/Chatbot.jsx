import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import config from '../../config.js'
import ChatBg from '../../assets/back.png'
import BoyBg from '../../assets/boy.png'
import ParentsBg from '../../assets/parents.png'

export default function Chatbot() {
	const location = useLocation()
    const navigate = useNavigate()
	const [messages, setMessages] = useState([])
	const [inputValue, setInputValue] = useState('')
	const [isTyping, setIsTyping] = useState(false)
	const [typingText, setTypingText] = useState('')
	const [facialFeaturesStored, setFacialFeaturesStored] = useState(false)
	const [messagesEndRef, setMessagesEndRef] = useState(null)
	const [inputRef, setInputRef] = useState(null)
	const mainRef = useRef(null)
	const [predictedAge, setPredictedAge] = useState(null)
	const [ageGroup, setAgeGroup] = useState('')
  const [userGender, setUserGender] = useState(null)
  const [loginIsParent, setLoginIsParent] = useState(null)

	const [isParent, setIsParent] = useState(false)
	const [parentingMode, setParentingMode] = useState(false)
	const [showParentingQuestion, setShowParentingQuestion] = useState(false)

	// Get predicted age from navigation state
	useEffect(() => {
    // read gender/parent flags from login (state or localStorage)
    try {
      const g = (location.state?.gender || localStorage.getItem('gender') || localStorage.getItem('userGender') || '').toString().toLowerCase()
      setUserGender(g || null)
      const parentFromState = typeof location.state?.isParent !== 'undefined' ? !!location.state.isParent : null
      const parentFromStorage = (() => { try { return JSON.parse(localStorage.getItem('isParent') || 'false') } catch { return false } })()
      setLoginIsParent(parentFromState !== null ? parentFromState : parentFromStorage)
    } catch {}

		if (location.state?.predictedAge) {
			const age = location.state.predictedAge
			setPredictedAge(age)
			try { localStorage.setItem('predictedAge', String(Math.round(age))) } catch {}
			
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

			// Check if user is above 25 to ask about parenting (only once)
            try {
                const asked = localStorage.getItem('askedParentingOnce') === 'true'
                if (age > 25 && !asked) {
                    setShowParentingQuestion(true)
                    localStorage.setItem('askedParentingOnce', 'true')
                }
            } catch {}

			setMessages([{
				id: 1,
				type: 'ai',
				content: welcomeMessage,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}])
		} else {
			// Show loading message if no age detected
			try {
				const stored = localStorage.getItem('predictedAge')
				if (stored) {
					const age = Number(stored)
					if (!isNaN(age)) {
						setPredictedAge(age)
						if (age < 13) setAgeGroup('child')
						else if (age < 18) setAgeGroup('teen')
						else if (age < 65) setAgeGroup('adult')
						else setAgeGroup('senior')
						// Ask parenting only once if age > 25
                        try {
                            const asked = localStorage.getItem('askedParentingOnce') === 'true'
                            if (age > 25 && !asked) {
                                setShowParentingQuestion(true)
                                localStorage.setItem('askedParentingOnce', 'true')
                            }
                        } catch {}
					}
				}
			} catch {}
			setMessages([{
				id: 1,
				type: 'ai',
				content: "Hi! I'm Ager, your health AI assistant. I'm detecting your age to provide personalized health guidance...",
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}])
		}
	}, [location.state])

	const confirmParenting = (isYes) => {
		if (isYes) {
			setIsParent(true)
			setParentingMode(true)
			setShowParentingQuestion(false)
			try { localStorage.setItem('isParent', 'true') } catch {}
			const parentingMessage = {
				id: Date.now(),
				type: 'ai',
				content: `Wonderful! I'm now switching to parenting mode to help you with your child's development. I can provide guidance on:\n\n• Nutrition and feeding (breastfeeding, solid foods, healthy eating)\n• Physical development and milestones\n• Sleep routines and schedules\n• Screen time management\n• Physical activities and play\n• Safety and childproofing\n• Behavioral guidance\n• Health and wellness tips\n\nWhat would you like to know about raising your child?`,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}
			setMessages(prev => [...prev, parentingMessage])
		} else {
			setIsParent(false)
			setParentingMode(false)
			setShowParentingQuestion(false)
			try { localStorage.setItem('isParent', 'false') } catch {}
			const regularMessage = {
				id: Date.now(),
				type: 'ai',
				content: `Got it! I'll continue providing you with personalized health guidance based on your age and facial analysis. What health topic would you like to discuss today?`,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}
			setMessages(prev => [...prev, regularMessage])
		}
	}

	const scrollToBottom = () => {
		if (mainRef.current) {
			mainRef.current.scrollTo({ top: mainRef.current.scrollHeight, behavior: 'smooth' });
		}
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	// Auto-scroll when typing starts to show typing indicator
	useEffect(() => {
		if (isTyping) {
			// Initial scroll when typing starts
			setTimeout(() => scrollToBottom(), 100)
			
			// Continuous scrolling while AI is generating
			const scrollInterval = setInterval(() => {
				scrollToBottom()
			}, 100) // Scroll every 100ms while typing
			
			return () => clearInterval(scrollInterval)
		}
	}, [isTyping])

	const callHealthChatAPI = async (message, age, ageGroup, conversationHistory, parentingMode = false) => {
		try {
			const token = localStorage.getItem('token')
			const requestBody = {
				message: message,
				age: age,
				ageGroup: ageGroup,
				conversationHistory: conversationHistory.slice(-5), // Send last 5 exchanges
				parentingMode: parentingMode
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

		// Auto-scroll to show the new user message and typing indicator
		setTimeout(() => scrollToBottom(), 50)

		// Handle parenting question if it's shown
		if (showParentingQuestion) {
            const normalized = inputValue.trim().toLowerCase()
            if (normalized === 'yes') {
                confirmParenting(true)
            } else if (normalized === 'no') {
                confirmParenting(false)
            } else {
                const invalidResponseMessage = {
                    id: Date.now(),
                    type: 'ai',
                    content: "Please respond with either 'yes' or 'no'.",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
                setMessages(prev => [...prev, invalidResponseMessage])
            }
            setIsTyping(false)
            return
        }

		try {
			// Call backend health chat API with conversation history
			const aiResponseText = await callHealthChatAPI(userMessage.content, predictedAge, ageGroup, messages, parentingMode)
			
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
				
				// Auto-scroll to show the complete AI response
				setTimeout(() => scrollToBottom(), 50)
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
		if (e.key === 'Enter' && !e.shiftKey && !isTyping && !showParentingQuestion) {
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

	// Track conversation history to avoid repetition
	const [conversationHistory, setConversationHistory] = useState([]);
	
	// Add conversation tracking to avoid repetitive responses
	const addToConversationHistory = (message, response) => {
		const newExchange = { message, response, timestamp: Date.now() };
		setConversationHistory(prev => [...prev.slice(-10), newExchange]);
	};

	// Function to handle parenting question response
	const handleParentingResponse = (response) => {
        if (response.toLowerCase().includes('yes') || response.toLowerCase().includes('parent') || response.toLowerCase().includes('child') || response.toLowerCase().includes('kid')) {
            setIsParent(true)
            setParentingMode(true)
            setShowParentingQuestion(false)
            try { localStorage.setItem('isParent', 'true') } catch {}
                    
            // Add parenting mode welcome message
            const parentingMessage = {
                id: Date.now(),
                type: 'ai',
				content: `Wonderful! I'm now switching to parenting mode to help you with your child's development. I can provide guidance on:\n\n• Nutrition and feeding (breastfeeding, solid foods, healthy eating)\n• Physical development and milestones\n• Sleep routines and schedules\n• Screen time management\n• Physical activities and play\n• Safety and childproofing\n• Behavioral guidance\n• Health and wellness tips\n\nWhat would you like to know about raising your child?`,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}
			setMessages(prev => [...prev, parentingMessage])
		        } else {
            setIsParent(false)
            setParentingMode(false)
            setShowParentingQuestion(false)
            try { localStorage.setItem('isParent', 'false') } catch {}
            
            // Continue with regular health guidance
            const regularMessage = {
                id: Date.now(),
                type: 'ai',
				content: `Got it! I'll continue providing you with personalized health guidance based on your age and facial analysis. What health topic would you like to discuss today?`,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}
			setMessages(prev => [...prev, regularMessage])
		}
	}

	// Function to check if message is about parenting
	const isParentingRelated = (message) => {
		const parentingKeywords = ['child', 'kid', 'baby', 'toddler', 'infant', 'parent', 'parenting', 'breastfeed', 'feeding', 'diaper', 'sleep', 'cry', 'play', 'milestone', 'development', 'screen time', 'activity', 'safety', 'childproof'];
		const messageLower = message.toLowerCase();
		return parentingKeywords.some(keyword => messageLower.includes(keyword));
	}





	return (
		<div className="h-screen bg-white flex flex-col"
			style={{
				backgroundImage: `url(${(loginIsParent || parentingMode || isParent) ? ParentsBg : ((userGender === 'female' || userGender === 'woman' || userGender === 'girl') ? ChatBg : BoyBg)})`,
				backgroundRepeat: 'no-repeat',
				backgroundPosition: 'center',
				backgroundSize: '280px',
				
			}}
		>
			{/* Header */}
			<header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
				<div className="flex items-center space-x-3">
					<div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
						<div className="w-4 h-4 bg-white rounded-sm"></div>
					</div>
					<div>
						<h1 className="text-xl font-semibold text-gray-900">AgeWise</h1>
						<p className="text-xs text-gray-500">Health AI Assistant </p>
					</div>
				</div>
				
									<div className="flex items-center space-x-2">
						{/* Mode Toggle Button */}
						{predictedAge > 25 && (
							<button 
								onClick={() => {
									if (parentingMode) {
										setParentingMode(false);
										setIsParent(false);
										const modeSwitchMessage = {
											id: Date.now(),
											type: 'ai',
											content: "I've switched back to health mode. I'll now provide you with personalized health guidance based on your age and facial analysis. What health topic would you like to discuss?",
											timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
										};
										setMessages(prev => [...prev, modeSwitchMessage]);
									} else {
										setParentingMode(true);
										setIsParent(true);
										const modeSwitchMessage = {
											id: Date.now(),
											type: 'ai',
											content: "I've switched to parenting mode! I can now help you with child development, nutrition, activities, safety, and parenting challenges. What would you like to know about raising your child?",
											timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
										};
										setMessages(prev => [...prev, modeSwitchMessage]);
									}
								}}
								className={`px-3 py-1 text-xs rounded-lg transition-colors ${
									parentingMode 
										? 'bg-pink-100 hover:bg-pink-200 text-pink-600 border border-pink-200' 
										: 'bg-blue-100 hover:bg-blue-200 text-blue-600 border border-blue-200'
								}`}
								title={parentingMode ? "Switch to Health Mode" : "Switch to Parenting Mode"}
							>
								{parentingMode ? '👶 Parenting' : '🏥 Health'}
							</button>
						)}

						{/* Wellness Navigation Button */}
						<button 
							onClick={() => navigate('/wellness', { state: { age: predictedAge } })}
							disabled={!predictedAge}
							className={`px-3 py-1 text-xs rounded-lg transition-colors border ${
								predictedAge ? 'bg-green-100 hover:bg-green-200 text-green-600 border-green-200' : 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed'
							}`}
							title="View age-based wellness insights"
						>
							💡 Wellness
						</button>
					</div>
				{predictedAge && (
					<div className="text-right">
						<p className="text-sm font-medium text-gray-900">Age: {Math.round(predictedAge)}</p>
						<p className="text-xs text-gray-500">{ageGroup === 'child' ? 'Child' : ageGroup === 'teen' ? 'Teen' : ageGroup === 'adult' ? 'Adult' : 'Senior'}</p>
						{/* Age-specific health focus indicator */}
						<div className="mt-1">
							{parentingMode && <span className="inline-block bg-pink-100 text-pink-800 text-xs px-2 py-1 rounded-full animate-pulse">👶 Parenting Mode</span>}
							{!parentingMode && predictedAge < 13 && <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Building Healthy Habits</span>}
							{!parentingMode && predictedAge >= 13 && predictedAge < 18 && <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Growth & Development</span>}
							{!parentingMode && predictedAge >= 18 && predictedAge < 30 && <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">Establishing Routines</span>}
							{!parentingMode && predictedAge >= 30 && predictedAge < 50 && <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">Maintaining Health</span>}
							{!parentingMode && predictedAge >= 50 && <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Wellness & Prevention</span>}
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
			<main ref={mainRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-6 relative z-0">
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

				{/* Parenting Question */}
				{showParentingQuestion && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="flex justify-start relative z-20"
					>
						<div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
							<div className="w-4 h-4 bg-white rounded-sm"></div>
						</div>
						<div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl px-6 py-4 max-w-[80%] border border-blue-200 shadow-lg">
							<div className="flex items-center space-x-3 mb-3">
								<span className="text-2xl">👶</span>
								<h3 className="text-lg font-semibold text-gray-800">Parenting Question</h3>
							</div>
							<p className="text-gray-700 mb-4">
								Since you're above 25, I'd like to know: <strong>Are you a parent or caregiver for a child?</strong>
							</p>
							<p className="text-sm text-gray-600 mb-4">
								If yes, I can switch to parenting mode and provide specialized guidance on child development, nutrition, activities, and more!
							</p>
							<div className="bg-blue-100 rounded-lg p-3 border border-blue-200">
								<p className="text-sm text-blue-800 font-medium">
									💡 <strong>Parenting Mode includes:</strong> Child nutrition, development milestones, sleep routines, screen time management, physical activities, safety tips, and behavioral guidance.
								</p>
							</div>
							<div className="flex items-center gap-3 mt-4">
								<button
									onClick={() => confirmParenting(true)}
									className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 text-white text-sm hover:bg-pink-700"
								>
									Yes, I am a parent
								</button>
								<button
									onClick={() => confirmParenting(false)}
									className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-900"
								>
									No, continue normal mode
								</button>
							</div>
						</div>
					</motion.div>
				)}

				{/* Typing Indicator */}
				{isTyping && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="flex justify-start relative z-20"
					>
						<div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
							<div className="w-4 h-4 bg-white rounded-sm"></div>
						</div>
						<div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-[70%] shadow-lg">
							<p className="text-sm text-gray-700">
								{typingText}
								<span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
							</p>
						</div>
					</motion.div>
				)}

				<div ref={setMessagesEndRef} />
				
				{/* Bottom spacing to ensure last message is visible above input */}
				<div className="h-6"></div>
			</main>



			{/* Input Area - Fixed at bottom */}
			<footer className="bg-white border-t border-gray-200 px-6 py-4 shadow-lg flex-shrink-0">
				{/* Centered Input Field */}
				<div className="max-w-2xl mx-auto">
					{/* AI Typing Indicator */}
					{isTyping && (
						<div className="text-center mb-3">
							<div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded-full border border-blue-200">
								<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
								AI is typing...
							</div>
						</div>
					)}
					
					<div className="relative">
						<input
							ref={setInputRef}
							type="text"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyPress={handleKeyPress}
							disabled={isTyping || showParentingQuestion}
							placeholder={
								isTyping
									? "AI is generating response..."
									: showParentingQuestion
										? "Please choose Yes or No above"
										: (parentingMode
											? "Ask me about parenting, child development, nutrition, activities..."
											: "Ask me about health, exercise, nutrition, or wellness...")
							}
							className={`w-full px-6 py-4 rounded-2xl border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none text-base shadow-sm hover:shadow-md transition-all duration-200 ${
								(isTyping || showParentingQuestion)
									? 'bg-gray-200 text-gray-500 cursor-not-allowed ring-1 ring-gray-300' 
									: 'bg-gray-100 text-gray-900'
							}`}
						/>
						{/* Send Button */}
						<button
							onClick={handleSendMessage}
							disabled={!inputValue.trim() || isTyping || showParentingQuestion}
							className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-xl transition-all duration-200 ${
								(isTyping || showParentingQuestion)
									? 'bg-gray-400 text-gray-500 cursor-not-allowed'
									: inputValue.trim()
										? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
										: 'bg-gray-300 text-gray-500 cursor-not-allowed'
							}`}
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-1" />
							</svg>
						</button>
					</div>
				</div>



				{/* Footer Disclaimer */}
				<div className="text-center mt-6">
					<p className="text-xs text-gray-400 max-w-md mx-auto">
						Ager provides general health information only. Always consult healthcare professionals for medical advice.
					</p>
				</div>
			</footer>
			

		</div>
	)
}
