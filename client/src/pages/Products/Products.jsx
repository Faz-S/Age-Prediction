import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'

export default function Products() {
	const location = useLocation()
	const navigate = useNavigate()
	const [predictedAge, setPredictedAge] = useState(null)
	const [ageGroup, setPredictedAgeGroup] = useState('')
	const [selectedCategory, setSelectedCategory] = useState('all')

	// Get predicted age from navigation state
	useEffect(() => {
		if (location.state?.predictedAge) {
			const age = location.state.predictedAge
			setPredictedAge(age)
			
			// Determine age group for appropriate recommendations
			if (age < 13) {
				setPredictedAgeGroup('child')
			} else if (age < 18) {
				setPredictedAgeGroup('teen')
			} else if (age < 30) {
				setPredictedAgeGroup('young-adult')
			} else if (age < 50) {
				setPredictedAgeGroup('adult')
			} else {
				setPredictedAgeGroup('senior')
			}
		} 
	}, [location.state, navigate])

	// Age-specific product categories
	const getAgeSpecificCategories = () => {
		switch (ageGroup) {
			case 'child':
				return [
					{ id: 'nutrition', name: 'Child Nutrition', icon: '🥗', color: 'bg-green-100 text-green-800' },
					{ id: 'toys', name: 'Educational Toys', icon: '🧸', color: 'bg-blue-100 text-blue-800' },
					{ id: 'clothing', name: 'Kids Clothing', icon: '👕', color: 'bg-purple-100 text-purple-800' },
					{ id: 'books', name: 'Children Books', icon: '📚', color: 'bg-orange-100 text-orange-800' }
				]
			case 'teen':
				return [
					{ id: 'skincare', name: 'Teen Skincare', icon: '🧴', color: 'bg-pink-100 text-pink-800' },
					{ id: 'fitness', name: 'Fitness & Sports', icon: '🏃', color: 'bg-green-100 text-green-800' },
					{ id: 'tech', name: 'Tech Gadgets', icon: '📱', color: 'bg-blue-100 text-blue-800' },
					{ id: 'fashion', name: 'Teen Fashion', icon: '👗', color: 'bg-purple-100 text-purple-800' }
				]
			case 'young-adult':
				return [
					{ id: 'fitness', name: 'Fitness & Wellness', icon: '💪', color: 'bg-green-100 text-green-800' },
					{ id: 'skincare', name: 'Skincare & Beauty', icon: '✨', color: 'bg-pink-100 text-pink-800' },
					{ id: 'tech', name: 'Technology', icon: '💻', color: 'bg-blue-100 text-blue-800' },
					{ id: 'lifestyle', name: 'Lifestyle', icon: '🌟', color: 'bg-purple-100 text-purple-800' }
				]
			case 'adult':
				return [
					{ id: 'health', name: 'Health & Wellness', icon: '🏥', color: 'bg-green-100 text-green-800' },
					{ id: 'fitness', name: 'Fitness & Nutrition', icon: '🏋️', color: 'bg-blue-100 text-blue-800' },
					{ id: 'beauty', name: 'Beauty & Anti-aging', icon: '💄', color: 'bg-pink-100 text-pink-800' },
					{ id: 'home', name: 'Home & Lifestyle', icon: '🏠', color: 'bg-orange-100 text-orange-800' }
				]
			case 'senior':
				return [
					{ id: 'health', name: 'Health & Mobility', icon: '🩺', color: 'bg-green-100 text-green-800' },
					{ id: 'wellness', name: 'Wellness & Care', icon: '🧘', color: 'bg-blue-100 text-blue-800' },
					{ id: 'comfort', name: 'Comfort & Safety', icon: '🛡️', color: 'bg-purple-100 text-purple-800' },
					{ id: 'hobbies', name: 'Hobbies & Leisure', icon: '🎨', color: 'bg-orange-100 text-orange-800' }
				]
			default:
				return []
		}
	}

	// Age-specific product recommendations
	const getProductsByCategory = (category) => {
		const products = {
			child: {
				nutrition: [
					{ id: 1, name: 'Organic Kids Multivitamin', price: '$24.99', image: '🥗', rating: 4.8, discount: '15% OFF' },
					{ id: 2, name: 'Healthy Snack Pack', price: '$19.99', image: '🍎', rating: 4.6, discount: '20% OFF' },
					{ id: 3, name: 'Probiotic Gummies', price: '$29.99', image: '🦠', rating: 4.7, discount: '10% OFF' }
				],
				toys: [
					{ id: 4, name: 'STEM Building Blocks', price: '$39.99', image: '🧱', rating: 4.9, discount: '25% OFF' },
					{ id: 5, name: 'Educational Puzzle Set', price: '$24.99', image: '🧩', rating: 4.5, discount: '30% OFF' },
					{ id: 6, name: 'Creative Art Kit', price: '$34.99', image: '🎨', rating: 4.7, discount: '15% OFF' }
				]
			},
			teen: {
				skincare: [
					{ id: 7, name: 'Teen Acne Treatment', price: '$19.99', image: '🧴', rating: 4.6, discount: '20% OFF' },
					{ id: 8, name: 'Gentle Face Wash', price: '$14.99', image: '🧼', rating: 4.5, discount: '25% OFF' },
					{ id: 9, name: 'Moisturizing Cream', price: '$22.99', image: '💧', rating: 4.7, discount: '15% OFF' }
				],
				fitness: [
					{ id: 10, name: 'Wireless Earbuds', price: '$79.99', image: '🎧', rating: 4.8, discount: '30% OFF' },
					{ id: 11, name: 'Fitness Tracker', price: '$129.99', image: '⌚', rating: 4.9, discount: '40% OFF' },
					{ id: 12, name: 'Sports Water Bottle', price: '$24.99', image: '💧', rating: 4.6, discount: '20% OFF' }
				]
			},
			'young-adult': {
				fitness: [
					{ id: 13, name: 'Premium Gym Membership', price: '$49.99/month', image: '💪', rating: 4.9, discount: 'First Month Free' },
					{ id: 14, name: 'Protein Powder', price: '$59.99', image: '🥛', rating: 4.7, discount: '25% OFF' },
					{ id: 15, name: 'Yoga Mat Set', price: '$34.99', image: '🧘', rating: 4.8, discount: '30% OFF' }
				],
				skincare: [
					{ id: 16, name: 'Anti-aging Serum', price: '$89.99', image: '✨', rating: 4.8, discount: '20% OFF' },
					{ id: 17, name: 'Vitamin C Cream', price: '$64.99', image: '🍊', rating: 4.7, discount: '15% OFF' },
					{ id: 18, name: 'Retinol Treatment', price: '$119.99', image: '🌟', rating: 4.9, discount: '30% OFF' }
				]
			},
			adult: {
				health: [
					{ id: 19, name: 'Health Monitoring Device', price: '$199.99', image: '🩺', rating: 4.8, discount: '50% OFF' },
					{ id: 20, name: 'Premium Supplements', price: '$79.99', image: '💊', rating: 4.7, discount: '25% OFF' },
					{ id: 21, name: 'Stress Relief Kit', price: '$44.99', image: '🧘', rating: 4.6, discount: '20% OFF' }
				],
				fitness: [
					{ id: 22, name: 'Home Gym Equipment', price: '$299.99', image: '🏋️', rating: 4.9, discount: '40% OFF' },
					{ id: 23, name: 'Personal Trainer App', price: '$19.99/month', image: '📱', rating: 4.8, discount: '3 Months Free' },
					{ id: 24, name: 'Nutrition Plan', price: '$89.99', image: '🥗', rating: 4.7, discount: '30% OFF' }
				]
			},
			senior: {
				health: [
					{ id: 25, name: 'Mobility Walker', price: '$149.99', image: '🦼', rating: 4.8, discount: '25% OFF' },
					{ id: 26, name: 'Health Alert System', price: '$299.99', image: '🚨', rating: 4.9, discount: '40% OFF' },
					{ id: 27, name: 'Joint Support Supplements', price: '$69.99', image: '🦴', rating: 4.7, discount: '20% OFF' }
				],
				wellness: [
					{ id: 28, name: 'Meditation App Premium', price: '$9.99/month', image: '🧘', rating: 4.8, discount: '6 Months Free' },
					{ id: 29, name: 'Comfort Cushion Set', price: '$89.99', image: '🪑', rating: 4.6, discount: '30% OFF' },
					{ id: 30, name: 'Wellness Retreat Package', price: '$599.99', image: '🏖️', rating: 4.9, discount: '50% OFF' }
				]
			}
		}

		if (category === 'all') {
			// Return products from all categories for this age group
			const allProducts = []
			Object.values(products[ageGroup] || {}).forEach(categoryProducts => {
				allProducts.push(...categoryProducts)
			})
			return allProducts
		}

		return products[ageGroup]?.[category] || []
	}

	// Age-specific marketing messages
	const getMarketingMessage = () => {
		switch (ageGroup) {
			case 'child':
				return {
					title: "Give Your Child the Best Start in Life! 🚀",
					subtitle: "Age-appropriate products for healthy growth and development",
					highlight: "Up to 30% OFF on educational toys and nutrition products"
				}
			case 'teen':
				return {
					title: "Teen Years Made Amazing! ✨",
					subtitle: "Products that boost confidence and support healthy habits",
					highlight: "Special teen discounts on skincare, fitness, and tech"
				}
			case 'young-adult':
				return {
					title: "Your Prime Years, Our Priority! 💎",
					subtitle: "Premium products for active, healthy lifestyle",
					highlight: "Exclusive deals on fitness, beauty, and wellness"
				}
			case 'adult':
				return {
					title: "Maintain Your Best Self! 🌟",
					subtitle: "Quality products for health, fitness, and beauty",
					highlight: "Adult-focused wellness products with great savings"
				}
			case 'senior':
				return {
					title: "Age Gracefully with Premium Care! 🎯",
					subtitle: "Specialized products for comfort, health, and wellness",
					highlight: "Senior-friendly products with exceptional support"
				}
			default:
				return {
					title: "Personalized Recommendations for You! 🎁",
					subtitle: "Products tailored to your age and lifestyle",
					highlight: "Special discounts on selected items"
				}
		}
	}

	const categories = getAgeSpecificCategories()
	const products = getProductsByCategory(selectedCategory)
	const marketing = getMarketingMessage()

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<div className="flex items-center space-x-3">
							<button
								onClick={() => navigate('/chatbot', { state: { predictedAge } })}
								className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
							>
								<svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
								</svg>
							</button>
							<div>
								<h1 className="text-xl font-semibold text-gray-900">Product Recommendations</h1>
								<p className="text-sm text-gray-500">Based on your age: {Math.round(predictedAge)} years</p>
							</div>
						</div>
						<div className="flex items-center space-x-2">
							<span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
								ageGroup === 'child' ? 'bg-green-100 text-green-800' :
								ageGroup === 'teen' ? 'bg-blue-100 text-blue-800' :
								ageGroup === 'young-adult' ? 'bg-purple-100 text-purple-800' :
								ageGroup === 'adult' ? 'bg-orange-100 text-orange-800' :
								'bg-red-100 text-red-800'
							}`}>
								{ageGroup === 'child' ? 'Child' :
								 ageGroup === 'teen' ? 'Teen' :
								 ageGroup === 'young-adult' ? 'Young Adult' :
								 ageGroup === 'adult' ? 'Adult' : 'Senior'}
							</span>
						</div>
					</div>
				</div>
			</header>

			{/* Marketing Banner */}
			<div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="text-center"
					>
						<h2 className="text-3xl font-bold mb-2">{marketing.title}</h2>
						<p className="text-xl text-blue-100 mb-4">{marketing.subtitle}</p>
						<div className="inline-block bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-semibold text-lg">
							{marketing.highlight}
						</div>
					</motion.div>
				</div>
			</div>

			{/* Category Filter */}
			<div className="bg-white border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex items-center space-x-4 overflow-x-auto">
						<button
							onClick={() => setSelectedCategory('all')}
							className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
								selectedCategory === 'all'
									? 'bg-blue-600 text-white shadow-lg'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
							}`}
						>
							All Products
						</button>
						{categories.map((category) => (
							<button
								key={category.id}
								onClick={() => setSelectedCategory(category.id)}
								className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap flex items-center space-x-2 ${
									selectedCategory === category.id
										? 'bg-blue-600 text-white shadow-lg'
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
								}`}
							>
								<span>{category.icon}</span>
								<span>{category.name}</span>
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Products Grid */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					<AnimatePresence mode="wait">
						{products.map((product, index) => (
							<motion.div
								key={product.id}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{ delay: index * 0.1, duration: 0.3 }}
								className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-200"
							>
								{/* Product Image */}
								<div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
									<span className="text-6xl">{product.image}</span>
								</div>

								{/* Product Info */}
								<div className="p-4">
									{/* Discount Badge */}
									{product.discount && (
										<div className="inline-block bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full mb-2">
											{product.discount}
										</div>
									)}

									{/* Product Name */}
									<h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>

									{/* Rating */}
									<div className="flex items-center space-x-1 mb-2">
										<div className="flex items-center">
											{[...Array(5)].map((_, i) => (
												<svg
													key={i}
													className={`w-4 h-4 ${
														i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-gray-300'
													}`}
													fill="currentColor"
													viewBox="0 0 20 20"
												>
													<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
												</svg>
											))}
										</div>
										<span className="text-sm text-gray-600 ml-1">{product.rating}</span>
									</div>

									{/* Price */}
									<div className="flex items-center justify-between">
										<span className="text-xl font-bold text-gray-900">{product.price}</span>
										<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
											Add to Cart
										</button>
									</div>
								</div>
							</motion.div>
						))}
					</AnimatePresence>
				</div>

				{/* Empty State */}
				{products.length === 0 && (
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className="text-center py-12"
					>
						<div className="text-gray-400 text-6xl mb-4">🛍️</div>
						<h3 className="text-xl font-semibold text-gray-600 mb-2">No products found</h3>
						<p className="text-gray-500">Try selecting a different category or check back later.</p>
					</motion.div>
				)}
			</div>

			{/* Footer CTA */}
			<div className="bg-gray-900 text-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
					<div className="text-center">
						<h3 className="text-2xl font-bold mb-4">Ready to Transform Your Life?</h3>
						<p className="text-gray-300 mb-6">Get personalized recommendations and exclusive deals based on your age and lifestyle.</p>
						<button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors">
							Start Shopping Now
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
