import React, { useEffect, useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import config from '../../config'
import hero from '../../assets/hero.png'
import fullHero from '../../assets/image.png'

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
      {/* Top Navbar (Wellness page only) */}
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <nav className="w-full rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left nav links */}
            <div className="flex items-center gap-5 text-sm text-gray-800">
              <Link to="/chatbot" className="hover:text-black">Chatbot</Link>
              <Link to="/" className="hover:text-black">Age Prediction</Link>
            </div>
            {/* Center logo */}
            <div className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 select-none">AgeWise</div>
            {/* Right actions */}
            <div className="flex items-center gap-3">
              {userName && (
                <span className="hidden sm:inline text-sm text-gray-700">Hi, {userName.split(' ')[0]}</span>
              )}
              <button onClick={handleLogout} className="rounded-full bg-black text-white text-sm px-4 py-2 hover:bg-gray-900">Logout</button>
            </div>
          </div>
        </nav>
      </div>

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
            <img src={fullHero} alt="Wellness full hero" className="w-full h-auto object-contain rounded-xl" />
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
                    src={toProxy(p.image)}
                    alt={p.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const seed = encodeURIComponent(`${p.title || 'product'}-${i}`)
                      e.currentTarget.src = `https://picsum.photos/seed/${seed}/800/600`
                    }}
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

        {/* Authorized Doctor */}
        <section className="mt-12">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Authorized Doctor</h3>
          {(() => {
            const doc = getDoctorForAge(age)
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-white rounded-2xl border border-gray-100 p-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{doc.name}</h4>
                  <p className="text-sm text-gray-600">{doc.role}</p>
                  <p className="text-sm text-blue-700 mt-1">{doc.specialty}</p>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center mt-4 px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
                  >
                    Visit Website
                  </a>
                </div>
                <div className="rounded-xl overflow-hidden bg-gray-100">
                  <img src={doc.image} alt={doc.name} className="w-full h-56 object-cover" />
                </div>
              </div>
            )
          })()}
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
