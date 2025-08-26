import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    try { localStorage.clear() } catch {}
    navigate('/')
  }

  const NavLink = ({ to, children }) => (
    <Link
      to={to}
      className={`px-3 py-2 text-base md:text-[18px] ${
        isActive(to)
          ? 'text-black font-semibold underline underline-offset-[10px] decoration-2'
          : 'text-gray-700 hover:text-black hover:underline underline-offset-[10px]'
      }`}
      onClick={() => setOpen(false)}
    >
      {children}
    </Link>
  )

  return (
    <div className="w-full bg-white border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4">
        <nav className="flex items-center justify-between py-3">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm" />
            </div>
            <span className="text-lg md:text-xl font-extrabold tracking-tight text-gray-900 select-none">AgeWise</span>
          </div>

          {/* Center: Links (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            <NavLink to="/wellness">Wellness</NavLink>
            <NavLink to="/chatbot">Chatbot</NavLink>
            {/* <NavLink to="/home">Age Prediction</NavLink> */}
          </div>

          {/* Right: Actions */}
          <div className="hidden md:flex items-center gap-2">
            {localStorage.getItem('token') ? (
              <>
                <Link
                  to="/profile"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50"
                  aria-label="Profile"
                  title="Profile"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 3.134-7 7h2a5 5 0 015-5 5 5 0 015 5h2c0-3.866-3.134-7-7-7z" />
                  </svg>
                </Link>
                <button onClick={handleLogout} className="px-3 py-2 text-sm text-gray-700 hover:text-black">Logout</button>
              </>
            ) : (
              <NavLink to="/">Login</NavLink>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 text-gray-700"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
              <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </nav>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-gray-200 py-2">
            <div className="flex flex-col">
              <NavLink to="/wellness">Wellness</NavLink>
              <NavLink to="/chatbot">Chatbot</NavLink>
              {/* <NavLink to="/home">Age Prediction</NavLink> */}
              {/* <NavLink to="/wellness">Jobs</NavLink> */}
              {/* <NavLink to="/profile">Book a Demo</NavLink> */}
              {localStorage.getItem('token') && (
                <Link to="/profile" className="px-3 py-2 text-base md:text-lg text-gray-700 hover:text-black" onClick={() => setOpen(false)}>Profile</Link>
              )}
              {localStorage.getItem('token') ? (
                <button onClick={handleLogout} className="text-left px-3 py-2 text-sm text-gray-700 hover:text-black">Logout</button>
              ) : (
                <NavLink to="/">Login</NavLink>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
