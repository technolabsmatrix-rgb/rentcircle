import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Frontend from './pages/Frontend.jsx'
import Admin from './pages/Admin.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Frontend — public store */}
        <Route path="/*" element={<Frontend />} />

        {/* Admin portal */}
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/*" element={<Admin />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
