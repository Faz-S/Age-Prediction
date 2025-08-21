import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import login from './img_2.png'
export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Login failed')
      if (data.token) localStorage.setItem('token', data.token)
      navigate('/home')
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
          {/* Left: form */}
          <section>
            {/* <header className="mb-10 flex items-center gap-2">
              <span className="size-2 rounded-full bg-violet-600" />
            </header> */}

            <div className="mb-8">
              <h1 className="text-5xl font-extrabold leading-tight text-gray-900">
                Hello,
                <br />
                Welcome Back
              </h1>
              <p className="mt-3 text-gray-500">Hey, welcome back to your special place</p>
            </div>

            <form className="max-w-md space-y-3" onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="stanley@gmail.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-violet-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="•••••••••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-violet-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />

              <div className="flex items-center justify-between pt-1 text-sm">
                <label className="inline-flex items-center gap-2 text-gray-600">
                  <input type="checkbox" defaultChecked className="size-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                  <span>Remember me</span>
                </label>
                <button className="text-black font-semibold" type="button">Forgot Password?</button>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <button
                className="mt-2 inline-flex rounded-xl bg-[#26efe9] px-10 py-3 font-semibold text-black hover:bg-violet-800 disabled:opacity-50"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>

              <p className="pt-3 text-gray-600">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="text-black font-semibold underline-offset-2 underline">Sign Up</Link>
              </p>
            </form>
          </section>

          {/* Right: illustration */}
          <section className="relative">
            <div className="relative overflow-hidden rounded-2xl">
              <img src={login} alt="login" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
} 