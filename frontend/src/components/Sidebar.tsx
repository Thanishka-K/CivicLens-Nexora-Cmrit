import { useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, Command, Leaf, PanelLeftClose } from 'lucide-react'
import { motion } from 'framer-motion'
import { navItems, type PageId } from '../app/navigation'
import { api } from '../api/client'

type Props = { page: PageId; onNavigate: (page: PageId) => void; collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onCloseMobile: () => void }

export function Sidebar({ page, onNavigate, collapsed, onToggle, mobileOpen, onCloseMobile }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)
  const groups = [...new Set(navItems.map((item) => item.group))]
  useEffect(() => {
    let active = true
    const check = () => { void api.getHealth().then(() => { if (active) setApiConnected(true) }).catch(() => { if (active) setApiConnected(false) }) }
    check()
    const timer = window.setInterval(check, 30000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  return <>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onCloseMobile} />}
    <motion.aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`} animate={{ width: collapsed ? 76 : 258 }} transition={{ duration: 0.2 }}>
      <div className="brand-row">
        <div className="brand-mark"><Leaf size={19} strokeWidth={2.4} /></div>
        {!collapsed && <div className="brand-copy"><strong>Civic<span>Lens</span></strong><small>INTELLIGENCE PLATFORM</small></div>}
        <button className="icon-button sidebar-collapse" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><PanelLeftClose size={17} /></button>
      </div>
      <div className="workspace-switch">
        <div className="workspace-avatar"><Command size={15} /></div>
        {!collapsed && <><span><b>Metro City</b><small>Demo workspace</small></span><ChevronDown size={14} className="muted-icon" /></>}
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {groups.map((group) => {
          const items = navItems.filter((item) => item.group === group)
          const groupOpen = openGroups[group] ?? true
          return <section className="nav-group" key={group}>
            {!collapsed && <button className="nav-group-label" onClick={() => setOpenGroups((prev) => ({ ...prev, [group]: !groupOpen }))}>{group}<ChevronDown size={13} className={groupOpen ? '' : 'chevron-closed'} /></button>}
            {(groupOpen || collapsed) && items.map((item) => {
              const Icon = item.icon
              return <button key={item.id} className={`nav-item ${page === item.id ? 'nav-item--active' : ''}`} onClick={() => { onNavigate(item.id); onCloseMobile() }} title={collapsed ? item.label : undefined} aria-label={item.label} aria-current={page === item.id ? 'page' : undefined}>
                <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>
              </button>
            })}
          </section>
        })}
      </nav>
      {!collapsed && <div className="sidebar-footer"><div className="sidebar-status"><span className="status-dot" /> {apiConnected === null ? 'Checking API connection…' : apiConnected ? 'CivicLens API connected' : 'CivicLens API unavailable'}</div><div className="sidebar-version">CIVICLENS <span>·</span> PROTOTYPE 0.1</div></div>}
      <button className="mobile-sidebar-close icon-button" onClick={onCloseMobile} aria-label="Close navigation"><ChevronLeft size={19} /></button>
    </motion.aside>
  </>
}
