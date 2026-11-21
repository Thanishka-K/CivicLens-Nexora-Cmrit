import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Command, Menu, Moon, Search, Sun } from 'lucide-react'
import { navItems, type PageId } from '../app/navigation'

type Props = { page: PageId; theme: 'dark' | 'light'; onThemeToggle: () => void; onOpenMobile: () => void; onNavigate: (page: PageId) => void; onSearchChange: (query: string) => void }

export function Topbar({ page, theme, onThemeToggle, onOpenMobile, onNavigate, onSearchChange }: Props) {
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = navItems.find((item) => item.id === page)?.label ?? 'Command Centre'
  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) { setSearchOpen(false); setNotificationsOpen(false); setProfileOpen(false) } }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const results = navItems.filter((item) => item.label.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
  return <header className="topbar">
    <div className="topbar-leading"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onOpenMobile}><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{current}</strong></div></div>
    <div className="topbar-tools" ref={ref}>
      <div className={`global-search ${searchOpen ? 'global-search--active' : ''}`}>
        <Search size={16} /><input aria-label="Search CivicLens pages or incidents" placeholder="Search anything..." value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); onSearchChange(event.target.value); setSearchOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchOpen(false); setSearch(''); onSearchChange('') } if (event.key === 'Enter' && results[0]) { onNavigate(results[0].id); setSearch(''); onSearchChange(''); setSearchOpen(false) } }} /><kbd><Command size={10} /> K</kbd>
        {searchOpen && search.length > 0 && <div className="popover search-results">{results.length ? <>{results.map((item) => <button key={item.id} onClick={() => { onNavigate(item.id); setSearch(''); onSearchChange(''); setSearchOpen(false) }}><item.icon size={15} /><span>{item.label}</span><small>{item.group}</small></button>)}{page === 'command' && <div className="search-hint">Dashboard incidents are filtered as you type</div>}</> : <p className="popover-empty">No matching pages{page === 'command' ? ' · dashboard incidents are still filtered' : ''}</p>}</div>}
      </div>
      <div className="popover-anchor"><button className={`icon-button notification-button ${notificationsOpen ? 'control-active' : ''}`} aria-label="Notifications" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }}><Bell size={17} /><i /></button>{notificationsOpen && <div className="popover notification-popover"><div className="popover-heading"><b>Notifications</b><span className="demo-mini-tag">DEMO</span></div><div className="notification-row"><span className="notification-dot amber-dot" /><div><b>Critical incident needs review</b><small>Waterlogging · Central Ward · 12m ago</small></div></div><div className="notification-row"><span className="notification-dot blue-dot" /><div><b>3 new reports received</b><small>Complaint inbox · 24m ago</small></div></div><div className="notification-footer">You’re all caught up</div></div>}</div>
      <button className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={onThemeToggle}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
      <div className="popover-anchor"><button className="profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false) }} aria-expanded={profileOpen}><span className="profile-avatar">AS</span><span className="profile-copy"><b>Arjun Sharma</b><small>City Administrator</small></span><ChevronDown size={14} /></button>{profileOpen && <div className="popover profile-popover"><div className="profile-menu-head"><span className="profile-avatar">AS</span><div><b>Arjun Sharma</b><small>arjun@metro.demo</small></div></div><div className="profile-menu-note">Demo workspace account</div></div>}</div>
    </div>
  </header>
}
