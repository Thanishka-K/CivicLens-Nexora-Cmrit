import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronDown, type LucideIcon } from 'lucide-react'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>
}

export function MetricCard({ label, value, delta, trend, icon: Icon, accent, note }: { label: string; value: string; delta?: string; trend?: 'up' | 'down' | 'alert'; icon: LucideIcon; accent: string; note: string }) {
  return <article className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${accent}`}><Icon size={17} /></span></div><div className="metric-value-row"><strong>{value}</strong>{delta && trend && <span className={`metric-change ${trend}`} aria-label={`${trend === 'down' ? 'Down' : 'Up'} ${delta}`} >{trend === 'down' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{delta}</span>}</div><div className="metric-note">{note}</div></article>
}

export function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

export function DemoTag({ children = 'DEMO DATA' }: { children?: ReactNode }) { return <span className="demo-tag"><span />{children}</span> }

export function SelectButton({ label, value, options, onChange }: { label: string; value: string; options?: string[]; onChange?: (value: string) => void }) { return options && onChange ? <label className="select-control">{label && <span className="sr-only">{label}</span>}<select className="select-button" aria-label={label || value} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label> : <span className="select-button select-static">{label && <small>{label}</small>}{value}<ChevronDown size={14} /></span> }

export function PriorityBadge({ priority }: { priority: 'Critical' | 'High' | 'Medium' | 'Low' }) { return <span className={`priority-badge priority-${priority.toLowerCase()}`}><i />{priority}</span> }

export function StatusBadge({ status }: { status: string }) { return <span className={`status-badge status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span> }
