import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Profile() {
  const navigate = useNavigate()

  const defaultProfile = {
    avatar: '',
    name: 'Your Name',
    gender: 'Male',
    location: '',
    occupation: '',
    dob: '',
    phone: '',
    email: '',
    vitals: { bmi: '22.4', weight: '72', height: '175', bp: '120/80' },
    diagnosis: [''],
    barriers: [],
    medical: {
      chronic: '',
      emergencies: '',
      surgery: '',
      family: '',
      complications: ''
    },
    timeline: [
      { date: 'Dec 2022', title: 'Pre‑diabetic', note: 'A1c: —' },
      { date: 'Jan 2022', title: 'Type 2', note: 'A1c: —' }
    ],
    medications: '',
    diet: '',
    notes: ''
  }

  const [profile, setProfile] = useState(defaultProfile)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('userProfile')
      if (stored) setProfile({ ...defaultProfile, ...JSON.parse(stored) })
      const storedName = localStorage.getItem('userName')
      if (storedName) setProfile((p) => ({ ...p, name: storedName }))
      const email = localStorage.getItem('userEmail')
      if (email) setProfile((p) => ({ ...p, email }))
    } catch {}
  }, [])

  const saveProfile = async () => {
    try {
      localStorage.setItem('userProfile', JSON.stringify(profile))
    } catch {}
    setEditing(false)
    // optional backend sync
    try {
      const token = localStorage.getItem('token')
      if (token) {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(profile)
        })
      }
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

  const addTimeline = () => setProfile((p) => ({ ...p, timeline: [{ date: '', title: '', note: '' }, ...p.timeline] }))
  const updateTimeline = (idx, key, value) => setProfile((p) => ({ ...p, timeline: p.timeline.map((t, i) => i === idx ? { ...t, [key]: value } : t) }))
  const removeTimeline = (idx) => setProfile((p) => ({ ...p, timeline: p.timeline.filter((_, i) => i !== idx) }))

  const Badge = ({ children }) => (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 mr-2 mb-1">{children}</span>
  )

  const Field = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      {editing ? (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <div className="text-sm text-gray-900 min-h-[38px] flex items-center">{value || '—'}</div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fff]">
      {/* Top Navbar */}
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <nav className="w-full rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-5 text-sm text-gray-800">
              <Link to="/wellness" className="hover:text-black">Wellness</Link>
              <Link to="/chatbot" className="hover:text-black">Chatbot</Link>
            </div>
            <div className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 select-none">AgeWise</div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="rounded-full bg-gray-900 text-white text-sm px-4 py-2 hover:bg-black">Back</button>
            </div>
          </div>
        </nav>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Header card */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-center">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-gray-500">🙂</span>
                )}
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  {editing ? (
                    <input
                      value={profile.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span>{profile.name}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-700">
                  <Field label="Gender" value={profile.gender} onChange={(v) => updateField('gender', v)} />
                  <Field label="Location" value={profile.location} onChange={(v) => updateField('location', v)} />
                  <Field label="Occupation" value={profile.occupation} onChange={(v) => updateField('occupation', v)} />
                  <Field label="DOB" value={profile.dob} onChange={(v) => updateField('dob', v)} type="date" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="BMI" value={profile.vitals.bmi} onChange={(v) => updateField('vitals.bmi', v)} />
              <Field label="Weight (kg)" value={profile.vitals.weight} onChange={(v) => updateField('vitals.weight', v)} />
              <Field label="Height (cm)" value={profile.vitals.height} onChange={(v) => updateField('vitals.height', v)} />
              <Field label="Blood Pressure" value={profile.vitals.bp} onChange={(v) => updateField('vitals.bp', v)} />
            </div>
            <div className="flex flex-col items-end gap-3">
              <button onClick={() => setEditing((e) => !e)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-50">
                {editing ? 'Cancel' : 'Edit'}
              </button>
              {editing && (
                <button onClick={saveProfile} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Save</button>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Phone" value={profile.phone} onChange={(v) => updateField('phone', v)} />
            <Field label="Email" value={profile.email} onChange={(v) => updateField('email', v)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(profile.diagnosis || []).filter(Boolean).map((d, i) => <Badge key={i}>{d}</Badge>)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(profile.barriers || []).filter(Boolean).map((b, i) => <Badge key={i}>{b}</Badge>)}
          </div>
          {editing && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Add diagnosis (comma‑separated)" value={(profile.diagnosis || []).join(', ')} onChange={(v) => updateField('diagnosis', v.split(',').map(s => s.trim()))} />
              <Field label="Add barriers (comma‑separated)" value={(profile.barriers || []).join(', ')} onChange={(v) => updateField('barriers', v.split(',').map(s => s.trim()))} />
            </div>
          )}
        </section>

        {/* Middle cards */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Timeline</h3>
              {editing ? (
                <button onClick={addTimeline} className="text-sm text-blue-600">Add</button>
              ) : null}
            </div>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
              {profile.timeline.map((t, idx) => (
                <div key={idx} className="grid grid-cols-[80px_1fr] gap-3 items-start">
                  {editing ? (
                    <>
                      <input value={t.date} onChange={(e) => updateTimeline(idx, 'date', e.target.value)} className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-xs" />
                      <div className="space-y-2">
                        <input value={t.title} onChange={(e) => updateTimeline(idx, 'title', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                        <input value={t.note} onChange={(e) => updateTimeline(idx, 'note', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600" />
                        <button onClick={() => removeTimeline(idx)} className="text-xs text-red-600">Remove</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-gray-500">{t.date}</div>
                      <div>
                        <div className="text-sm text-gray-900">{t.title}</div>
                        <div className="text-xs text-gray-500">{t.note}</div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {profile.timeline.length === 0 && (
                <div className="text-sm text-gray-500">No events yet.</div>
              )}
            </div>
          </div>

          {/* Medical history */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Medical history</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Chronic disease" value={profile.medical.chronic} onChange={(v) => updateField('medical.chronic', v)} />
              <Field label="Diabetes Emergencies" value={profile.medical.emergencies} onChange={(v) => updateField('medical.emergencies', v)} />
              <Field label="Surgery" value={profile.medical.surgery} onChange={(v) => updateField('medical.surgery', v)} />
              <Field label="Family disease" value={profile.medical.family} onChange={(v) => updateField('medical.family', v)} />
              <div className="md:col-span-2">
                <Field label="Related complications" value={profile.medical.complications} onChange={(v) => updateField('medical.complications', v)} />
              </div>
            </div>
          </div>
        </section>

        {/* Bottom 3 cards */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Medications</h3>
            {editing ? (
              <textarea value={profile.medications} onChange={(e) => updateField('medications', e.target.value)} rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[120px]">{profile.medications || '—'}</p>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Diet</h3>
            {editing ? (
              <textarea value={profile.diet} onChange={(e) => updateField('diet', e.target.value)} rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[120px]">{profile.diet || '—'}</p>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
            {editing ? (
              <textarea value={profile.notes} onChange={(e) => updateField('notes', e.target.value)} rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[120px]">{profile.notes || '—'}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
