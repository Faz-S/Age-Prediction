import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import config from './config.js'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import Home from './pages/Home/Home'
import Chatbot from './pages/Chatbot/Chatbot'
import Wellness from './pages/Wellness/Wellness'

function App() {
  const [authTick, setAuthTick] = useState(0)

  // On app load, validate existing token against backend. If invalid, remove it so guards redirect to login.
  useEffect(() => {
    let cancelled = false
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      fetch(config.getApiUrl('/api/me'), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok && !cancelled) {
            localStorage.removeItem('token')
            setAuthTick((t) => t + 1)
          }
        })
        .catch(() => {
          if (!cancelled) {
            localStorage.removeItem('token')
            setAuthTick((t) => t + 1)
          }
        })
    } catch {}
    return () => { cancelled = true }
  }, [])
  const isAuthed = () => {
    try {
      const token = localStorage.getItem('token')
      return !!token
    } catch {
      return false
    }
  }

  const hasPredictedAge = () => {
    try {
      const ageStr = localStorage.getItem('predictedAge')
      const n = ageStr != null ? Number(ageStr) : NaN
      return Number.isFinite(n) && n >= 0
    } catch {
      return false
    }
  }

  const RequireAuth = () => {
    return isAuthed() ? <Outlet /> : <Navigate to="/" replace />
  }

  const PublicOnly = () => {
    return isAuthed() ? <Navigate to="/home" replace /> : <Outlet />
  }

  const RequireAge = () => {
    return hasPredictedAge() ? <Outlet /> : <Navigate to="/home" replace />
  }

  return (
    <Routes>
      {/* Public routes (redirect to /home if already logged in) */}
      <Route element={<PublicOnly /> }>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Protected routes */}
      <Route element={<RequireAuth /> }>
        <Route path="/home" element={<Home />} />
        <Route element={<RequireAge /> }>
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/wellness" element={<Wellness />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={isAuthed() ? '/home' : '/'} replace />} />
    </Routes>
  )
}

export default App
