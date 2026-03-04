import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Markets } from './pages/Markets'
import { Dashboard } from './pages/Dashboard'
import { AdminPanel } from './pages/AdminPanel'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/markets" replace />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/markets" replace />} />
      </Route>
    </Routes>
  )
}
