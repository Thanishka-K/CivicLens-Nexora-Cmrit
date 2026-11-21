import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dashboard } from '../components/Dashboard'
import { ComplaintInbox } from '../components/ComplaintInbox'
import { CitizenConnect } from '../components/CitizenConnect'
import { SenseAI } from '../components/SenseAI'
import { CivicPulse } from '../components/CivicPulse'
import { CityVision } from '../components/CityVision'
import { ActionTracker, AnalyticsReports, CivicMemory, CivicSim, ImpactIQ, ResponseAI, SettingsModule } from '../components/OperationalModules'
import { ModulePage } from '../components/ModulePage'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'
import type { PageId } from './navigation'

type Theme = 'dark' | 'light'
export default function App() {
  const [page, setPage] = useState<PageId>('command')
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('civiclens-theme') as Theme) || 'dark')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('civiclens-theme', theme) }, [theme])
  useEffect(() => { const handle = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('.global-search input')?.focus() } if (event.key === 'Escape') setMobileOpen(false) }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle) }, [])
  return <div className="app-shell"><Sidebar page={page} onNavigate={setPage} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} /><div className="main-shell"><Topbar page={page} theme={theme} onThemeToggle={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} onOpenMobile={() => setMobileOpen(true)} onNavigate={setPage} onSearchChange={setSearch} /><main className="main-content"><AnimatePresence mode="wait"><motion.div key={page} className="route-view" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>{page === 'command' ? <Dashboard search={search} onNavigate={setPage} /> : page === 'citizen' ? <CitizenConnect /> : page === 'inbox' ? <ComplaintInbox search={search} onNavigate={setPage} /> : page === 'sense' ? <SenseAI /> : page === 'impact' ? <ImpactIQ /> : page === 'pulse' ? <CivicPulse search={search} /> : page === 'city' ? <CityVision search={search} onNavigate={setPage} /> : page === 'response' ? <ResponseAI /> : page === 'tracker' ? <ActionTracker /> : page === 'memory' ? <CivicMemory /> : page === 'sim' ? <CivicSim /> : page === 'analytics' ? <AnalyticsReports /> : page === 'settings' ? <SettingsModule theme={theme} onThemeToggle={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} /> : <ModulePage page={page} />}</motion.div></AnimatePresence></main></div></div>
}
