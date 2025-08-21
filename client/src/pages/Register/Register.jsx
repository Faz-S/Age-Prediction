import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import register from './img.png'
export default function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Registration failed')
      setSuccess('Registered successfully. You can now sign in.')
      setTimeout(() => navigate('/'), 800)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <section>
            {/* <header className="mb-10 flex items-center gap-2">
              <span className="size-2 rounded-full bg-violet-600" />
              <span className="text-violet-700 font-bold">Finnger</span>
            </header> */}

            <div className="mb-8">
              <h1 className="text-5xl font-extrabold leading-tight text-gray-900">Create Your Account</h1>
              <p className="mt-3 text-gray-500">Join us and start your journey today</p>
            </div>

            <form className="max-w-md space-y-3" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Full name"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-violet-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="email@example.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-violet-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Create password"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-violet-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />

              {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              {success && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

              <button className="mt-2 inline-flex rounded-xl bg-[#26efe9] px-10 py-3 font-semibold text-black hover:bg-violet-800 disabled:opacity-50" type="submit" disabled={isLoading}>
                {isLoading ? 'Signing up...' : 'Sign Up'}
              </button>

              <p className="pt-3 text-gray-600">Already have an account? <Link to="/" className="text-black font-semibold underline underline-offset-2">Sign In</Link></p>
            </form>
          </section>

          <section className="relative">
            <div className="relative overflow-hidden rounded-2xl">
              <img src={register} alt="register" className="w-full h-full object-cover" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
} 