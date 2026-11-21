import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { api, type Complaint } from '../api/client'
import type { PageId } from '../app/navigation'
import { PriorityBadge, SelectButton } from './ui'

function formatAge(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.floor(hours / 24)} d ago`
}

export function IncidentTable({ search, onNavigate }: { search: string; onNavigate: (page: PageId) => void }) {
  const [priority, setPriority] = useState('Critical & High')
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.getComplaints({ page_size: '100' })
      .then((result) => { if (active) { setComplaints(result.items); setTotal(result.total); setError('') } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load complaints.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const filtered = complaints.filter((complaint) => {
    const matchesSearch = `${complaint.id} ${complaint.title} ${complaint.description} ${complaint.location} ${complaint.category} ${complaint.language} ${complaint.department_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (priority === 'All priorities' || (priority === 'Critical & High' ? complaint.priority === 'Critical' || complaint.priority === 'High' : complaint.priority === priority))
  }).slice(0, 5)
  return <section className="panel incident-panel"><div className="panel-header"><div><h2>Priority incidents</h2><p>Latest complaint records from the backend</p></div><div className="incident-actions"><SelectButton label="Filter by priority" value={priority} options={['Critical & High', 'All priorities', 'Critical', 'High', 'Medium']} onChange={setPriority} /></div></div>
    {error ? <div className="api-inline-error" role="alert">{error}</div> : loading ? <div className="empty-state"><span>Loading complaints…</span></div> : filtered.length ? <div className="table-scroll"><table className="incident-table"><thead><tr><th>Incident</th><th>Location</th><th>Priority</th><th>Department</th><th>Reported</th><th></th></tr></thead><tbody>{filtered.map((complaint) => <tr key={complaint.id}><td><div className="incident-title">{complaint.title}</div><span className="incident-id">{complaint.id} <i>·</i> {complaint.category}{complaint.demo && <i> · Demo</i>}</span></td><td className="location-cell">{complaint.location}</td><td><PriorityBadge priority={complaint.priority} /></td><td className="department-cell">{complaint.department_name ?? 'Unassigned'}</td><td className="age-cell">{formatAge(complaint.submitted_at)}</td><td><button className="row-link" aria-label={`Review ${complaint.id} in complaint inbox`} onClick={() => onNavigate('inbox')}><ArrowUpRight size={15} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>No complaints match your filters</span><small>Try another search term or priority.</small></div>}
    <div className="table-footer"><span>Showing <b>{filtered.length}</b> of {total} records{loading ? ' · loading' : ''}</span><button className="text-link" onClick={() => onNavigate('inbox')}>Open complaint inbox <span>→</span></button></div>
  </section>
}
