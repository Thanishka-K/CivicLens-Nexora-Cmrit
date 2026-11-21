import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, CloudSun, FileWarning, Radio, ShieldAlert, Siren, TrendingUp } from 'lucide-react'
import type { PageId } from '../app/navigation'
import { api, type DashboardStats, type Department } from '../api/client'
import { activity } from '../data/demo'
import { CityMap } from './CityMap'
import { CategoryChart, ComplaintTrendChart } from './DashboardCharts'
import { IncidentTable } from './IncidentTable'
import { DemoTag, MetricCard, PageHeader, Panel } from './ui'

export function Dashboard({ search, onNavigate }: { search: string; onNavigate: (page: PageId) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([api.getDashboardStats(), api.getDepartments()])
      .then(([nextStats, nextDepartments]) => { if (active) { setStats(nextStats); setDepartments(nextDepartments); setError('') } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load CivicLens data.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()
  return <div className="page-content dashboard-page">
    <PageHeader eyebrow={dateLabel} title="Command Centre" description="Here’s what’s happening across Metro City today." actions={<><DemoTag>{stats?.demo ? 'SYNTHETIC SEED DATA' : 'LOCAL DATABASE'}</DemoTag><button className="primary-button" onClick={() => onNavigate('inbox')}><FileWarning size={15} /> View all reports <ArrowRight size={15} /></button></>} />
    {error && <div className="api-alert" role="alert"><ShieldAlert size={16} /><span><b>Backend connection issue</b>{error}</span><button onClick={() => window.location.reload()}>Retry</button></div>}
    <div className="demo-banner"><span className="demo-banner-icon"><ShieldAlert size={15} /></span><span><b>{stats?.demo ? 'Demonstration records included' : 'Local database connected'}</b> · {stats ? 'Seed complaints are synthetic; new submissions are stored locally.' : 'Dashboard values load from the local CivicLens API.'}</span></div>
    <div className="metric-grid">
      <MetricCard label="Complaints received" value={loading ? '…' : (stats?.total_complaints ?? '—').toLocaleString()} icon={FileWarning} accent="teal-accent" note="All records in local database" />
      <MetricCard label="Unresolved" value={loading ? '…' : String(stats?.unresolved_complaints ?? '—')} icon={Clock3} accent="blue-accent" note="Requires follow-up" />
      <MetricCard label="Critical incidents" value={loading ? '…' : String(stats?.critical_incidents ?? '—')} icon={Siren} accent="amber-accent" note="Unresolved critical severity" />
      <MetricCard label="Resolved this week" value={loading ? '…' : String(stats?.resolved_this_week ?? '—')} icon={TrendingUp} accent="violet-accent" note={stats?.average_resolution_days == null ? 'Resolution time not available yet' : `Average resolution ${stats.average_resolution_days} days`} />
    </div>
    <div className="dashboard-grid dashboard-grid-top"><ComplaintTrendChart stats={stats} /><CategoryChart stats={stats} /></div>
    <div className="dashboard-grid dashboard-grid-lower">
      <Panel title="Department workload" subtitle="Open complaints by responsible team" action={<button className="text-link" onClick={() => onNavigate('analytics')}>View departments <span>→</span></button>}>
        <div className="department-list">{departments.map((department, index) => <div className="department-row" key={department.id}><div className="department-row-head"><span>{department.name}</span><span><b>{department.open_count}</b><small> / {department.complaint_count} total</small></span></div><div className="workload-track"><i style={{ width: `${department.complaint_count ? Math.round((department.open_count / department.complaint_count) * 100) : 0}%`, background: ['#49d5c5', '#67a8f7', '#a08bf5', '#f1b957', '#e78392', '#7cc98d'][index % 6] }} /></div></div>)}</div>
        {!departments.length && <div className="department-empty">{loading ? 'Loading department data…' : 'No department records available.'}</div>}
        <div className="workload-foot"><span className="workload-indicator"><i /> Live counts from local database</span><span className="workload-link">{departments.length} departments</span></div>
      </Panel>
      <CityMap onNavigate={onNavigate} complaintCount={stats?.total_complaints} criticalCount={stats?.critical_incidents} />
      <Panel title="Recent activity" subtitle="Illustrative activity sample" action={<span className="demo-mini-tag">SAMPLE</span>}>
        <div className="activity-list">{activity.map((item) => <div className="activity-item" key={item.title}><span className={`activity-marker ${item.color}`}><i /></span><div className="activity-copy"><b>{item.title}</b><span>{item.detail}</span><small>{item.time}</small></div></div>)}</div>
        <div className="activity-more"><span>Showing the latest 3 updates</span><ArrowRight size={13} /></div>
      </Panel>
    </div>
    <IncidentTable search={search} onNavigate={onNavigate} />
    <div className="dashboard-footnote"><Radio size={13} /> Counts, departments, and priority complaints load from SQLite; map and recent activity remain illustrative.<span className="footnote-weather"><CloudSun size={14} /> Metro City · demo</span></div>
  </div>
}
