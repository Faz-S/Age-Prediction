import React, { useEffect, useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import config from '../../config'
// import hero from '../../assets/hero.png'
import fullHero from '../../assets/image.png'
import heroAlt1 from '../../assets/img_1.png'
import heroAlt2 from '../../assets/img_2.png'
import heroAlt3 from '../../assets/img_3.png'

export default function Wellness() {
  const location = useLocation()
  const navigate = useNavigate()
  const [age, setAge] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [ageImage, setAgeImage] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [photoDescription, setPhotoDescription] = useState('')
  const [userName, setUserName] = useState('')
  const [heroSrc, setHeroSrc] = useState(fullHero)
  // Hospitals state
  const [hospitals, setHospitals] = useState([])
  const [hospitalsLoading, setHospitalsLoading] = useState(false)
  const [hospitalsError, setHospitalsError] = useState('')
  const [cityQuery, setCityQuery] = useState('')
  // CSE image caches
  const [productImages, setProductImages] = useState({})
  const [hospitalImages, setHospitalImages] = useState({})

  // Pick a random hero image on mount
  useEffect(() => {
    const options = [fullHero, heroAlt1, heroAlt2, heroAlt3]
    const idx = Math.floor(Math.random() * options.length)
    setHeroSrc(options[idx])
  }, [])

  // Helper: batch fetch CSE images
  const fetchCseImages = async (queries) => {
    try {
      if (!queries || !queries.length) return {}
      const res = await fetch(config.getApiUrl('/api/cse-images'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries })
      })
      if (!res.ok) return {}
      const js = await res.json()
      try { console.debug('[CSE] batch response', { queries, js }) } catch {}
      return js.images || {}
    } catch {
      return {}
    }
  }

  // Nearby hospitals fetcher
  const fetchHospitals = async (opts) => {
    try {
      setHospitalsLoading(true)
      setHospitalsError('')
      const res = await fetch(config.getApiUrl('/api/nearby-hospitals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts || {})
      })
      if (!res.ok) throw new Error('Failed to load nearby hospitals')
      const js = await res.json()
      setHospitals(Array.isArray(js.hospitals) ? js.hospitals : [])
    } catch (e) {
      setHospitalsError(e.message || 'Something went wrong')
      setHospitals([])
    } finally {
      setHospitalsLoading(false)
    }
  }

  // Try to use browser geolocation for hospitals on mount
  useEffect(() => {
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords || {}
            if (latitude && longitude) fetchHospitals({ lat: latitude, lon: longitude })
          },
          () => {
            // Ignore denial; user can search by city
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        )
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch CSE images for products when data loads
  useEffect(() => {
    (async () => {
      try {
        const products = (data?.products || []).slice(0, 3)
        if (!products.length) return
        const names = products.map(p => (p?.title || p?.subtitle || '').trim()).filter(Boolean)
        const queries = names.map(t => `${t} product`)
        const images = await fetchCseImages(queries)
        if (images && Object.keys(images).length) {
          const byName = {}
          names.forEach((name) => {
            const q = `${name} product`
            if (images[q]) byName[name] = images[q]
          })
          const mapped = {}
          products.forEach((p) => {
            const titleKey = (p?.title || '').trim()
            const subKey = (p?.subtitle || '').trim()
            if (titleKey && byName[titleKey]) mapped[titleKey] = byName[titleKey]
            if (subKey && byName[subKey]) mapped[subKey] = byName[subKey]
          })
          try { console.debug('[CSE] product mapped images', mapped) } catch {}
          setProductImages(prev => ({ ...prev, ...mapped }))
        }
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.products])

  // Fetch CSE images for hospitals whenever hospitals list changes
  useEffect(() => {
    (async () => {
      try {
        if (!hospitals || !hospitals.length) return
        const names = hospitals.map(h => (h?.name || '').trim()).filter(Boolean)
        const queries = names.map(n => `${n} hospital`)
        const images = await fetchCseImages(queries)
        if (images && Object.keys(images).length) {
          const mapped = {}
          names.forEach((name, idx) => {
            const q = queries[idx]
            if (name && images[q]) mapped[name] = images[q]
          })
          try { console.debug('[CSE] hospital mapped images', mapped) } catch {}
          setHospitalImages(prev => ({ ...prev, ...mapped }))
        }
      } catch {}
    })()
  }, [hospitals])

  // Proxy external images via backend to avoid CORS/referrer blocks
  const toProxy = (url) => {
    try {
      if (!url) return ''
      // If it's already our proxy, return as-is
      if (typeof url === 'string' && url.includes('/api/proxy-image')) return url
      const api = new URL(config.getApiUrl('/api/proxy-image'), window.location.origin)
      api.searchParams.set('url', url)
      return api.toString()
    } catch {
      return url
    }
  }

  // Page-level loading gate: wait for BOTH data and image to finish
  const isPageLoading = loading || imageLoading || !data

  const handleLogout = () => {
    try {
      localStorage.clear()
    } catch {}
    navigate('/')
  }

  // Build a richer, age-aware wellness description from any short photo description
  const buildHealthAgeDescription = (ageVal, baseDesc) => {
    if (!baseDesc) return ''
    const ageNum = Number(ageVal) || 0
    let ageBand = 'in your 20s'
    if (ageNum < 20) ageBand = 'in your teens'
    else if (ageNum < 25) ageBand = 'in your early 20s'
    else if (ageNum < 30) ageBand = 'in your mid-20s'
    else if (ageNum < 35) ageBand = 'in your early 30s'
    else if (ageNum < 40) ageBand = 'in your late 30s'
    else if (ageNum < 50) ageBand = 'in your 40s'
    else if (ageNum < 60) ageBand = 'in your 50s'
    else ageBand = 'in your 60s or above'

    // Simple feature/issue cues from the base description, if present
    const lower = baseDesc.toLowerCase()
    const hasDarkCircles = lower.includes('dark circle') || lower.includes('under-eye') || lower.includes('tired')
    const hasAcne = lower.includes('acne') || lower.includes('blemish') || lower.includes('pimple')
    const hasDryness = lower.includes('dry') || lower.includes('flaky')

    let healthLine = 'Facial features suggest generally healthy skin with minimal visible signs of aging.'
    let recs = []

    if (hasDarkCircles) {
      healthLine = 'Mild under-eye darkness suggests possible sleep variability or screen fatigue.'
      recs.push('prioritize 7–9 hours of consistent sleep and short screen breaks')
    }
    if (hasAcne) {
      recs.push('maintain a gentle cleanser and non-comedogenic moisturizer routine')
    }
    if (hasDryness) {
      recs.push('increase hydration and use a ceramide-rich moisturizer')
    }

    // Age-tailored general guidance
    if (ageNum < 30) {
      recs.push('stay hydrated', 'use daily broad‑spectrum SPF 30+', 'keep a balanced diet and regular activity')
    } else if (ageNum < 40) {
      recs.push('add resistance training 2–3x/week', 'prioritize protein and fiber', 'use SPF and consider vitamin C/retinoid as tolerated')
    } else if (ageNum < 50) {
      recs.push('schedule routine health screenings', 'focus on sleep quality and stress management', 'maintain strength and mobility work')
    } else {
      recs.push('regular checkups with your provider', 'protein-rich meals with hydration', 'low-impact strength and balance exercises')
    }

    const recText = recs.length ? `A wellness recommendation is to ${recs.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : ''

    return `${baseDesc}. You appear ${ageBand}. ${healthLine} ${recText}`
  }

  // Age-banded FAQs
  const getFaqForAge = (ageVal) => {
    const a = Number(ageVal) || 0
    if (a < 18) {
      return [
        {
          q: 'How much sleep does a child or teen need?',
          a: 'Most school‑age children and teens benefit from 8–10 hours of quality sleep nightly to support growth, learning, and mood.'
        },
        {
          q: 'What are healthy snack ideas for younger ages?',
          a: 'Pair protein with fiber—yogurt with fruit, cheese with whole‑grain crackers, or hummus with veggies to keep energy steady.'
        },
        {
          q: 'How much screen time is okay?',
          a: 'Aim to limit recreational screen time and build in regular outdoor play and movement breaks throughout the day.'
        },
        {
          q: 'When should I see a pediatrician?',
          a: 'For routine vaccinations and wellness checks per schedule, or sooner if you notice fever, persistent fatigue, or concerns with growth.'
        }
      ]
    } else if (a < 60) {
      return [
        {
          q: 'How often should adults schedule a check‑up?',
          a: 'An annual wellness visit is common; discuss frequency with your provider based on family history and risk factors.'
        },
        {
          q: 'What supports energy and focus during busy weeks?',
          a: 'Prioritize consistent sleep, hydrate, include protein and fiber at meals, and fit in brief activity breaks to reduce screen fatigue.'
        },
        {
          q: 'How do I protect my skin as I age?',
          a: 'Daily broad‑spectrum SPF 30+, gentle cleanser, and consider vitamin C in the morning and a retinoid at night as tolerated.'
        },
        {
          q: 'When should I seek medical advice for stress or low mood?',
          a: 'If stress interferes with daily life, sleep, or relationships, reach out to a clinician; early support is effective.'
        }
      ]
    }
    // 60+
    return [
      {
        q: 'How often should older adults have check‑ups?',
        a: 'At least annually, with regular reviews of medications, vision/hearing, balance, and vaccinations.'
      },
      {
        q: 'What kind of exercise is best?',
        a: 'Combine low‑impact cardio, strength, and balance work (e.g., walking, light resistance, tai chi) most days of the week.'
      },
      {
        q: 'How much protein and hydration do I need?',
        a: 'Protein at each meal (as advised by your provider) and steady hydration through the day support muscle and cognition.'
      },
      {
        q: 'When should I talk to a doctor about memory concerns?',
        a: 'If you or family notice changes in memory, judgment, or mood, schedule an assessment—early evaluation helps.'
      }
    ]
  }

  // Age‑targeted doctor profiles
  const getDoctorForAge = (ageVal) => {
    const a = Number(ageVal) || 0
    if (a < 18) {
      return {
        name: 'Dr. Maya Singh',
        role: 'Pediatrician',
        specialty: 'Specialist in Child & Adolescent Health',
        url: 'https://www.aap.org',
        image: 'https://images.unsplash.com/photo-1584467735871-6fd3d5a4a7f2?q=80&w=1024&auto=format&fit=crop'
      }
    } else if (a < 60) {
      return {
        name: 'Dr. Daniel Alvarez',
        role: 'Internist',
        specialty: 'Specialist in Adult & Preventive Medicine',
        url: 'https://www.acponline.org',
        image: 'https://images.unsplash.com/photo-1550831107-1553da8c8464?q=80&w=1024&auto=format&fit=crop'
      }
    }
    return {
      name: 'Dr. Emily Carter',
      role: 'Geriatrician',
      specialty: 'Specialist in Senior Health & Healthy Aging',
      url: 'https://www.americangeriatrics.org',
      image: 'https://images.unsplash.com/photo-1527613426441-4da17471b66d?q=80&w=1024&auto=format&fit=crop'
    }
  }

  const fetchWellness = async (ageVal) => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(config.getApiUrl('/api/age-wellness'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age: ageVal })
      })
      if (!res.ok) throw new Error('Failed to load wellness content')
      const json = await res.json()
      // Debug: log the image URLs we received to inspect failures
      try {
        const imgs = (json?.wellness?.products || []).map(p => p.image)
        // eslint-disable-next-line no-console
        console.debug('[Wellness] product images', imgs)
      } catch {}
      setData(json.wellness)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }
  const fetchAgeImage = async (ageVal) => {
    try {
      setImageLoading(true)
      const url = new URL(config.getApiUrl('/api/age-images'))
      url.searchParams.set('age', String(ageVal))
      url.searchParams.set('_', String(Date.now())) // cache-buster
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Failed to load image')
      const json = await res.json()
      setAgeImage(json.image || '')
    } catch (e) {
      // leave a silent fallback; image is optional UX
      setAgeImage('')
    } finally {
      setImageLoading(false)
    }
  }

  // Resolve initial age from navigation state or localStorage and fetch
  useEffect(() => {
    // Load user name for greeting
    try {
      const name = localStorage.getItem('userName')
      if (name) setUserName(name)
    } catch {}
    // Fallback: fetch from backend if not present in localStorage
    ;(async () => {
      try {
        if (!userName) {
          const token = localStorage.getItem('token')
          if (token) {
            const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
            if (res.ok) {
              const profile = await res.json()
              if (profile && typeof profile.name === 'string') {
                setUserName(profile.name)
                try { localStorage.setItem('userName', profile.name) } catch {}
              }
              if (profile && typeof profile.email === 'string') {
                try { localStorage.setItem('userEmail', profile.email) } catch {}
              }
            }
          }
        }
      } catch {}
    })()

    let initialAge = ''
    if (location.state?.age) {
      initialAge = String(Math.round(location.state.age))
    } else {
      try {
        const stored = localStorage.getItem('predictedAge')
        if (stored) initialAge = stored
      } catch {}
    }

    if (!initialAge) initialAge = '30'
    setAge(initialAge)
    fetchWellness(initialAge)
    fetchAgeImage(initialAge)
    // Load any previously saved short photo description
    try {
      const savedDesc = localStorage.getItem('photoDescription')
      if (savedDesc) setPhotoDescription(savedDesc)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Error full-screen state
  if (error && !isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-6">
          <h1 className="text-2xl font-bold text-gray-900">Unable to load wellness content</h1>
          <p className="text-gray-600 mt-2">{error}</p>
          <button
            onClick={() => { fetchWellness(age); fetchAgeImage(age); }}
            className="mt-6 inline-flex items-center rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-900"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Full-screen loading until all content is ready
  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg className="h-10 w-10 animate-spin text-gray-900" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <div>
            <p className="text-lg font-semibold text-gray-900">Preparing your wellness plan…</p>
            <p className="text-sm text-gray-600 mt-1">This usually takes a few seconds.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff]">
      <Navbar />

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top controls */}
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
                {data?.profileTitle || 'Health Profile'}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                {userName && (
                  <p className="text-sm text-gray-700">Welcome, {userName}.</p>
                )}
                {age && (
                  <span className="inline-flex items-center text-xs font-medium text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">Age: {age}</span>
                )}
              </div>
              <p className="text-sm text-blue-700 mt-2">Personalized tips based on your age</p>
            </div>

            <div className="flex items-center gap-3">
              {/* <label className="text-sm text-gray-600">Your age</label>
              <input
                type="number"
                min="0"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                readOnly
                disabled
                className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  // Refresh dynamic content for the current age
                  fetchWellness(age)
                  fetchAgeImage(age)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
              >
                Refresh
              </button> */}
            </div>
            
          </div>
          {/* Full image directly below the subtitle, full width, no crop */}
          <div className="mt-4">
            <img src={heroSrc} alt="Wellness full hero" className="w-full h-auto object-contain rounded-xl" />
            {photoDescription && (
              <div className="mt-3">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Appearance & Wellness Insight</h2>
                <p className="text-base md:text-lg text-gray-700">{buildHealthAgeDescription(age, photoDescription)}</p>
              </div>
            )}
          </div>
          {error && <p className="text-red-600 mt-3">{error}</p>}
        </header>

        {/* Intro and Tips */}
        <section className="bg-white border border-gray-400 rounded-2xl p-6 md:p-8">
          {/* Hero age image */}
          {imageLoading ? (
            <div className="w-full h-48 md:h-64 rounded-xl bg-gray-100 animate-pulse mb-6" />
          ) : ageImage ? (
            <div className="w-full mb-6 overflow-hidden rounded-xl">
              <img src={ageImage} alt="Age-based wellness" className="w-full h-48 md:h-64 object-cover" />
            </div>
          ) : null}
          {loading ? (
            <p className="text-gray-500">Loading age-based content…</p>
          ) : (
            <>
              <p className="text-gray-700">{data?.intro}</p>
              {/* Full-width hero image between intro and tips */}
              <div className="mt-6 -mx-2 md:mx-0">
                {/* <img
                  src={hero}
                  alt="Wellness plan hero"
                  className="w-[calc(100%+1rem)] md:w-full h-48 md:h-72 object-cover rounded-xl md:rounded-2xl"
                /> */}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mt-6">{data?.tipsTitle || 'Health Tips for Your Age'}</h2>
              <p className="text-gray-700 mt-2">{data?.tips}</p>
            </>
          )}
        </section>

        {/* Products */}
        <section className="mt-10">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{data?.productsTitle || 'Recommended Products'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(data?.products || []).slice(0, 3).map((p, i) => (
              <article key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="aspect-[4/3] bg-gray-100">
                  <img
                    src={toProxy(productImages[p.title] || productImages[p.subtitle] || p.image)}
                    alt={p.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{p.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{p.subtitle}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Articles */}
        <section className="mt-10">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{data?.articlesTitle || 'Health Articles'}</h2>
          <div className="space-y-6">
            {(data?.articles || []).slice(0, 3).map((a, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500">Article</p>
                  <h3 className="text-lg md:text-xl font-semibold text-gray-900 mt-1">{a.title}</h3>
                  <p className="text-gray-600 mt-2">{a.summary}</p>
                </div>
                <div className="rounded-xl overflow-hidden bg-gray-100">
                  <img
                    className="w-full h-40 md:h-32 object-cover"
                    src={toProxy(a.image)}
                    alt={a.title}
                    onError={(e) => {
                      const seed = encodeURIComponent(`${a.title || 'article'}-${i}`)
                      e.currentTarget.src = `https://picsum.photos/seed/${seed}/800/400`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-gray-900">Frequently Asked Questions</h2>
          <div className="mt-6 space-y-3 max-w-3xl mx-auto">
            {getFaqForAge(age).map((item, idx) => (
              <FaqItem key={idx} item={item} />
            ))}
          </div>
        </section>

        {/* Nearby Hospitals & Clinics */}
        <section className="mt-12">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Nearby Hospitals & Clinics</h3>
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  try {
                    if ('geolocation' in navigator) {
                      navigator.geolocation.getCurrentPosition((pos) => {
                        const { latitude, longitude } = pos.coords || {}
                        if (latitude && longitude) fetchHospitals({ lat: latitude, lon: longitude })
                      })
                    }
                  } catch {}
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Use My Location
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="City, Region, Country"
                className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  if (cityQuery.trim()) {
                    // naive parse: try commas
                    const parts = cityQuery.split(',').map(s => s.trim()).filter(Boolean)
                    const [city, region, country] = [parts[0] || '', parts[1] || '', parts[2] || '']
                    fetchHospitals({ city, region, country })
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
              >
                Search
              </button>
            </div>
          </div>
          {hospitalsError && (
            <div className="text-red-600 text-sm mb-3">{hospitalsError}</div>
          )}
          {hospitalsLoading ? (
            <div className="space-y-4">
              {[0,1,2].map(i => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shadow-sm animate-pulse">
                  <div className="w-full h-28 bg-gray-100 rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                    <div className="h-5 w-2/3 bg-gray-200 rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded" />
                    <div className="h-3 w-1/3 bg-gray-100 rounded" />
                    <div className="h-8 w-28 bg-gray-200 rounded mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {hospitals.map((h, idx) => (
                <article key={idx} className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shadow-sm">
                  <div className="w-full h-28 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={toProxy(hospitalImages[h.name] || h.image)}
                      alt={h.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const seed = encodeURIComponent(`${h.name || 'hospital'}-${idx}`)
                        e.currentTarget.src = `https://picsum.photos/seed/${seed}/400/300`
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{h.category || 'Hospital'}</span>
                    <h4 className="text-lg md:text-xl font-semibold text-gray-900">{h.name}</h4>
                    <div className="mt-2 text-sm text-gray-700 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span>{h.address || 'N/A'}</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-700 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.81.3 1.6.54 2.36a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.72-1.06a2 2 0 0 1 2.11-.45c.76.24 1.55.42 2.36.54A2 2 0 0 1 22 16.92z"/></svg>
                      <span>{h.phone || 'N/A'}</span>
                    </div>
                    <div className="mt-3">
                      {h.website ? (
                        <a href={h.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">View Details</a>
                      ) : (
                        <button disabled className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-200 text-gray-600 text-sm cursor-not-allowed">View Details</button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {(!hospitals || hospitals.length === 0) && !hospitalsError && (
                <div className="text-sm text-gray-600">No results yet. Use your location or search by city to find nearby hospitals.</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// Local accordion item component (kept inside this file for simplicity)
function FaqItem({ item }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left px-4 py-3"
      >
        <span className="text-gray-900 font-medium">{item.q}</span>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.17l3.71-2.94a.75.75 0 111.04 1.08l-4.24 3.36a.75.75 0 01-.94 0L5.21 8.31a.75.75 0 01.02-1.1z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 -mt-1 text-gray-600">{item.a}</div>
      )}
    </div>
  )
}
