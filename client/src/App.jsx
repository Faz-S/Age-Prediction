import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import Home from './pages/Home/Home'
import AgeAI from './pages/AgeAI/AgeAI'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/home" element={<Home />} />
      <Route path="/age-ai" element={<AgeAI />} />
    </Routes>
  )
}

export default App
