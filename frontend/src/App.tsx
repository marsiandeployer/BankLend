import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Markets } from './pages/Markets'
import { Dashboard } from './pages/Dashboard'
import { AdminPanel } from './pages/AdminPanel'

function RedirectToMarkets() {
  const { search } = useLocation()
  return <Navigate to={`/markets${search}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<RedirectToMarkets />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<RedirectToMarkets />} />
      </Route>
    </Routes>
  )
}
