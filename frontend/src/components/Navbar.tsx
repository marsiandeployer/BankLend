import { NavLink } from 'react-router-dom'
import { ConnectWallet } from './ConnectWallet'
import { useAccount } from 'wagmi'
import { useAdmin } from '../hooks/useAdmin'
import { useTheme } from '../hooks/useTheme'

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function Navbar() {
  const { address } = useAccount()
  const { isAdmin } = useAdmin()
  const { isDark, toggle } = useTheme()

  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <NavLink to="/" className="text-xl font-bold text-white">
            Bank<span className="text-indigo-400">Lend</span>
          </NavLink>

          {/* Navigation links */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink
              to="/markets"
              className={({ isActive }) =>
                `px-3 py-2 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'text-white bg-slate-800'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`
              }
            >
              Markets
            </NavLink>
            {address && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'text-white bg-slate-800'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`
                }
              >
                Dashboard
              </NavLink>
            )}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'text-white bg-slate-800'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`
                }
              >
                Admin
                <span className="ml-1 text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                  Panel
                </span>
              </NavLink>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <ConnectWallet />
        </div>
      </div>
    </nav>
  )
}
