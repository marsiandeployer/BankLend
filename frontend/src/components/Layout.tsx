import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800 mt-16 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500">
          BankLend — Transparent Lending on BSC · Powered by{' '}
          <a
            href="https://onout.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300"
          >
            onout.org
          </a>
        </div>
      </footer>
    </div>
  )
}
