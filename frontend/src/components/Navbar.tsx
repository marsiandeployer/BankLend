import { NavLink } from 'react-router-dom'
import { ConnectWallet } from './ConnectWallet'
import { useAccount } from 'wagmi'
import { useAdmin } from '../hooks/useAdmin'

export function Navbar() {
  const { address } = useAccount()
  const { isAdmin } = useAdmin()

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

        <ConnectWallet />
      </div>
    </nav>
  )
}
