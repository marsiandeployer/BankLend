import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

function readInitialTheme(): Theme {
  const urlParams = new URLSearchParams(window.location.search)
  const urlTheme = urlParams.get('theme') as Theme | null
  if (urlTheme === 'light' || urlTheme === 'dark') return urlTheme

  const stored = localStorage.getItem('theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'light') {
      html.classList.add('light')
      html.classList.remove('dark')
    } else {
      html.classList.remove('light')
      html.classList.add('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return { isDark: theme === 'dark', theme, toggle }
}
