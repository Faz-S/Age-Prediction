import React, { useEffect, useMemo, useState } from 'react'
import Navbar from '../../components/Navbar'
import config from '../../config'

export default function Profile() {

  const defaultProfile = {
    avatarUrl: '',
    name: 'Sophia Bennett',
    gender: 'Female',
    email: '',
    height: '', // cm (blank by default)
    weight: '', // kg (blank by default)
    // legacy fields kept to avoid breakage in rest of page
    location: '',
    occupation: '',
    dob: '',
    phone: '',
    vitals: { bmi: '', weight: '', height: '', bp: '' },
    diagnosis: [''],
    barriers: [],
    medical: { chronic: '', emergencies: '', surgery: '', family: '', complications: '' },
    timeline: [],
    medications: [], // [{ name, dose, schedule }]
    diet: '',
    notes: ''
  }

  const [profile, setProfile] = useState(defaultProfile)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [predictedAge, setPredictedAge] = useState(null)
  const [weightEditing, setWeightEditing] = useState(false)
  const [heightEditing, setHeightEditing] = useState(false)
  const [editingMedIdx, setEditingMedIdx] = useState(null)
  const [dietLoading, setDietLoading] = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const [dietError, setDietError] = useState('')

  // Derived: parsed diet JSON (if present)
  const dietObj = React.useMemo(() => {
    try {
      if (!profile?.dietJson) return null
      return JSON.parse(profile.dietJson)
    } catch {
      return null
    }
  }, [profile?.dietJson])

  useEffect(() => {
    // read local fallbacks
    try {
      const age = Number(localStorage.getItem('predictedAge') || '')
      if (!isNaN(age)) setPredictedAge(Math.round(age))
      const gender = localStorage.getItem('gender') || localStorage.getItem('userGender')
      if (gender) setProfile((p) => ({ ...p, gender }))
      const email = localStorage.getItem('userEmail')
      if (email) setProfile((p) => ({ ...p, email }))
    } catch {}

    // fetch from backend if logged in
    ;(async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch(config.getApiUrl('/api/profile'), {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (data?.profile) {
          const p = data.profile
          setProfile((prev) => ({
            ...prev,
            name: p.name || prev.name,
            email: p.email || prev.email,
            gender: p.gender || prev.gender,
            height: p.height ?? prev.height,
            weight: p.weight ?? prev.weight,
            avatarUrl: p.avatarUrl || prev.avatarUrl,
            notes: p.notes ?? prev.notes,
            medications: Array.isArray(p.medications) ? p.medications : prev.medications,
            diet: p.diet ?? prev.diet,
          }))
        }
      } catch {}
    })()
  }, [])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const body = {
          name: profile.name,
          gender: profile.gender,
          height: profile.height === '' ? null : profile.height,
          weight: profile.weight === '' ? null : profile.weight,
          medications: profile.medications,
          notes: profile.notes,
          diet: profile.diet,
        }
        await fetch(config.getApiUrl('/api/profile'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        })
      }
    } catch {}
    setSaving(false)
  }

  const saveNotes = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      await fetch(config.getApiUrl('/api/profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: profile.notes })
      })
    } catch {}
  }

  const updateField = (path, value) => {
    setProfile((prev) => {
      const next = { ...prev }
      let obj = next
      const parts = path.split('.')
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]]
      obj[parts[parts.length - 1]] = value
      return next
    })
  }

  const onHeightChange = (v) => {
    if (v === '') return setProfile((p) => ({ ...p, height: '' }))
    const n = Number(v)
    if (!isNaN(n)) setProfile((p) => ({ ...p, height: n }))
  }
  const onWeightChange = (v) => {
    if (v === '') return setProfile((p) => ({ ...p, weight: '' }))
    const n = Number(v)
    if (!isNaN(n)) setProfile((p) => ({ ...p, weight: n }))
  }

  const bmi = useMemo(() => {
    const h = Number(profile.height)
    const w = Number(profile.weight)
    if (!h || !w) return null
    const m = h / 100
    const b = w / (m * m)
    return Math.round(b * 100) / 100
  }, [profile.height, profile.weight])

  const bmiCategory = useMemo(() => {
    if (bmi == null) return { label: '—', color: 'text-gray-500' }
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-yellow-600' }
    if (bmi < 25) return { label: 'Normal weight', color: 'text-green-600' }
    if (bmi < 30) return { label: 'Overweight', color: 'text-orange-600' }
    return { label: 'Obesity', color: 'text-red-600' }
  }, [bmi])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const form = new FormData()
      form.append('avatar', file)
      const res = await fetch(config.getApiUrl('/api/profile/avatar'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.avatarUrl) setProfile((p) => ({ ...p, avatarUrl: config.getApiUrl(data.avatarUrl) }))
      }
    } catch {}
    setUploading(false)
  }

  const addTimeline = () => setProfile((p) => ({ ...p, timeline: [{ date: '', title: '', note: '' }, ...p.timeline] }))
  const updateTimeline = (idx, key, value) => setProfile((p) => ({ ...p, timeline: p.timeline.map((t, i) => i === idx ? { ...t, [key]: value } : t) }))
  const removeTimeline = (idx) => setProfile((p) => ({ ...p, timeline: p.timeline.filter((_, i) => i !== idx) }))

  const Badge = ({ children }) => (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 mr-2 mb-1">{children}</span>
  )

  const Field = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  // Medications helpers
  const addMedication = () => setProfile((p) => ({ ...p, medications: [...p.medications, { name: '', dose: '', schedule: '' }] }))
  const updateMedication = (idx, key, val) => setProfile((p) => ({ ...p, medications: p.medications.map((m, i) => i === idx ? { ...m, [key]: val } : m) }))
  const removeMedication = (idx) => setProfile((p) => ({ ...p, medications: p.medications.filter((_, i) => i !== idx) }))

  const generateDietPlan = async () => {
    setDietLoading(true)
    setDietError('')
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      // Guard on client too
      if (!predictedAge || !profile.height || !profile.weight) {
        setDietError('Please fill in Age, Height, and Weight before generating a diet plan.')
        return
      }
      const res = await fetch(config.getApiUrl('/api/diet-plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          age: predictedAge,
          height: profile.height,
          weight: profile.weight,
          bmi,
          gender: profile.gender,
          notes: profile.notes,
          medications: profile.medications,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.planJson) setProfile((p) => ({ ...p, dietJson: data.planJson, diet: '' }))
      } else {
        let msg = 'Failed to generate diet plan.'
        try {
          const err = await res.json()
          if (err?.message) msg = err.message
        } catch {}
        setDietError(msg)
      }
    } catch {}
    setDietLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#fff]">
      <Navbar />

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Header card - simplified to match mock */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-gray-500">🙂</span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow cursor-pointer hover:bg-blue-700">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                {uploading ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25"/><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                )}
              </label>
            </div>
            <div>
              {!nameEditing ? (
                <div className="flex items-center gap-2">
                  <div className="text-[22px] md:text-[26px] font-semibold text-gray-900">{profile.name}</div>
                  <button onClick={() => setNameEditing(true)} className="text-gray-600 hover:text-gray-800" title="Edit name">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <button onClick={() => { setNameEditing(false); saveProfile() }} className="text-blue-600 text-sm">Save</button>
                </div>
              )}
              <div className="text-gray-500 mt-1">Age: {predictedAge ?? '—'}, {profile.gender || '—'}</div>
            </div>
            <div className="ml-auto" />
          </div>
          <div className="mt-6 border-t border-gray-200" />
        </section>

        {/* Health Metrics */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Health Metrics</h3>
          <div className="grid grid-cols-2 gap-12 max-w-xl">
            <div>
              <div className="text-xs text-gray-500">Weight</div>
              {!weightEditing ? (
                <div className="mt-1 text-gray-900 font-semibold text-lg cursor-pointer" onClick={() => setWeightEditing(true)}>
                  {profile.weight !== '' ? `${profile.weight} kg` : '—'}
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" value={profile.weight ?? ''} onChange={(e) => onWeightChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => { setWeightEditing(false); saveProfile() }} className="text-blue-600 text-sm">Save</button>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500">Height</div>
              {!heightEditing ? (
                <div className="mt-1 text-gray-900 font-semibold text-lg cursor-pointer" onClick={() => setHeightEditing(true)}>
                  {profile.height !== '' ? `${profile.height} cm` : '—'}
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" value={profile.height ?? ''} onChange={(e) => onHeightChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => { setHeightEditing(false); saveProfile() }} className="text-blue-600 text-sm">Save</button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 max-w-xl ">
            <div className="text-xs text-gray-500">BMI (Body Mass Index)</div>
            <div className="mt-1 text-gray-900 font-medium">
              {bmi != null ? (
                <>
                  {bmi.toFixed(2)} - <span className={bmiCategory.color}>{bmiCategory.label}</span>
                </>
              ) : '—'}
            </div>
          </div>
        </section>

        {/* Medications + Notes */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Medications</h3>
              <button onClick={addMedication} className="text-sm text-blue-600">Add</button>
            </div>
            <div className="space-y-2">
              {profile.medications.length === 0 && (
                <div className="text-sm text-gray-500">—</div>
              )}
              {profile.medications.map((m, idx) => (
                <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-start justify-between">
                  {editingMedIdx === idx ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 mr-3">
                      <input value={m.name} onChange={(e) => updateMedication(idx, 'name', e.target.value)} placeholder="Name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      <input value={m.dose} onChange={(e) => updateMedication(idx, 'dose', e.target.value)} placeholder="Dose" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      <input value={m.schedule} onChange={(e) => updateMedication(idx, 'schedule', e.target.value)} placeholder="Schedule" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{m.name || '—'}</div>
                      <div className="text-sm text-gray-600">{[m.dose, m.schedule].filter(Boolean).join(', ') || '—'}</div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {editingMedIdx === idx ? (
                      <button onClick={() => { setEditingMedIdx(null); saveProfile() }} className="text-blue-600" title="Save">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                      </button>
                    ) : (
                      <button onClick={() => setEditingMedIdx(idx)} className="text-gray-600 hover:text-gray-800" title="Edit">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                      </button>
                    )}
                    <button onClick={() => { removeMedication(idx); saveProfile() }} className="text-red-600 hover:text-red-700" title="Delete">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
            <textarea value={profile.notes} onChange={(e) => updateField('notes', e.target.value)} rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Add any personal health notes here..." />
            <div className="mt-3 flex justify-end">
              <button onClick={saveNotes} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Save Notes</button>
            </div>
          </div>
        </section>

        {/* Personalized Diet Plan CTA - moved last */}
        <section className="bg-white border border-gray-200 rounded-2xl p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Personalized Diet Plan</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Get a comprehensive nutritional assessment and a diet plan tailored to your health goals.
            </p>
            <div className="flex flex-col items-center">
              <button onClick={generateDietPlan} disabled={dietLoading || !predictedAge || !profile.height || !profile.weight} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60">
                {dietLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25"/><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3"/></svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/></svg>
                    Generate Diet Plan
                  </>
                )}
              </button>
              {(!predictedAge || !profile.height || !profile.weight) && (
                <div className="mt-2 text-xs text-gray-500">Enter your Age, Height, and Weight to enable diet plan generation.</div>
              )}
              {dietError && (
                <div className="mt-2 text-sm text-red-600">{dietError}</div>
              )}
            </div>
            {dietLoading && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0,1,2,3].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm animate-pulse">
                    <div className="h-4 w-32 bg-gray-200 rounded mb-3"></div>
                    <div className="space-y-2">
                      <div className="h-3 w-5/6 bg-gray-100 rounded"></div>
                      <div className="h-3 w-4/6 bg-gray-100 rounded"></div>
                      <div className="h-3 w-3/6 bg-gray-100 rounded"></div>
                      <div className="h-3 w-2/6 bg-gray-100 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {dietObj && !dietLoading && (
              <div className="mt-6 space-y-6">
                {/* Overview */}
                {dietObj.overview && (
                  <div className="bg-blue-50 border border-blue-100 text-blue-900 rounded-xl p-4 text-sm">
                    {dietObj.overview}
                  </div>
                )}

                {/* Per-day plan */}
                {Array.isArray(dietObj.days) && dietObj.days.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dietObj.days.map((d, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                        <div className="font-semibold text-gray-900 mb-3">{d.day || `Day ${idx + 1}`}</div>
                        <div className="space-y-2 text-sm text-gray-800">
                          {d.breakfast && (
                            <div>
                              <div className="text-gray-500 text-xs uppercase tracking-wide">Breakfast</div>
                              <div>{d.breakfast}</div>
                            </div>
                          )}
                          {d.lunch && (
                            <div>
                              <div className="text-gray-500 text-xs uppercase tracking-wide">Lunch</div>
                              <div>{d.lunch}</div>
                            </div>
                          )}
                          {d.snack && (
                            <div>
                              <div className="text-gray-500 text-xs uppercase tracking-wide">Snack</div>
                              <div>{d.snack}</div>
                            </div>
                          )}
                          {d.dinner && (
                            <div>
                              <div className="text-gray-500 text-xs uppercase tracking-wide">Dinner</div>
                              <div>{d.dinner}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tips */}
                {Array.isArray(dietObj.tips) && dietObj.tips.length > 0 && (
                  <div>
                    <div className="font-semibold text-gray-900 mb-2">Tips</div>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-800">
                      {dietObj.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
            {!dietObj && profile.diet && !dietLoading && (
              <div className="mt-6">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-4">{profile.diet}</pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
