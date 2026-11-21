import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, GitBranch, LoaderCircle, MapPin, RefreshCw, Search, ShieldAlert, X } from 'lucide-react'
import { api, type DuplicateDetection, type Incident, type IncidentDetail } from '../api/client'
import { DemoTag, PageHeader, PriorityBadge } from './ui'

function date(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }

export function CivicPulse({ search }: { search: string }) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selected, setSelected] = useState<IncidentDetail | null>(null)
  const [report, setReport] = useState<DuplicateDetection | null>(null)
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setIncidents(await api.getIncidents()) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load incidents.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  async function detect() {
    setDetecting(true); setError(''); setReport(null)
    try { const result = await api.detectDuplicates(); setReport(result); setIncidents(result.incidents) }
    catch (e) { setError(e instanceof Error ? e.message : 'Incident detection failed.') }
    finally { setDetecting(false) }
  }
  async function open(item: Incident) {
    setBusy(true); setError('')
    try { setSelected(await api.getIncident(item.id)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load incident details.') } finally { setBusy(false) }
  }
  async function decide(confirmed: boolean) {
    if (!selected) return
    setBusy(true); setError('')
    try { await api.decideIncident(selected.id, confirmed); setSelected(null); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Could not save officer decision.') } finally { setBusy(false) }
  }
  const visible = incidents.filter((item) => `${item.id} ${item.title} ${item.dominant_category} ${item.location} ${item.complaint_ids.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="page-content pulse-page">
    <PageHeader eyebrow="INTELLIGENCE · LOCAL MATCHING" title="CivicPulse" description="Review reports with similar wording, category, time, and location. Groups remain suggestions until an officer confirms them." actions={<><DemoTag>OFFLINE MATCHING</DemoTag><button className="primary-button" disabled={detecting} onClick={() => void detect()}>{detecting ? <><LoaderCircle size={15} className="spin" /> Scanning…</> : <><Search size={15} /> Detect duplicates</>}</button></>} />
    <div className="inbox-summary"><div><b>{incidents.length}</b><span>suggested or confirmed incident groups</span></div><div><GitBranch size={14} /> Every report remains preserved</div><button className="panel-icon-button" onClick={() => void load()} aria-label="Refresh incidents"><RefreshCw size={15} /></button></div>
    {error && <div className="api-alert" role="alert"><AlertCircle size={16} />{error}</div>}
    {report && <div className="demo-banner"><span className="demo-banner-icon"><ShieldAlert size={15} /></span><span><b>Detection complete</b> · {report.incidents_created} new groups from {report.complaints_preserved} preserved complaints. Candidate links are suggestions for officer review.</span></div>}
    {report?.possible_relationships.length ? <section className="panel pulse-relationships"><div className="panel-header"><div><h2>Possible relationships</h2><p>Cross-category reports may be related; cause is unverified.</p></div></div>{report.possible_relationships.map((r) => <div className="pulse-related" key={r.complaint_ids.join(':')}><b>{r.label}</b><span>{r.complaint_ids.join(' · ')}</span><small>{r.reasons.join(' · ')}</small></div>)}</section> : null}
    <section className="panel incident-panel"><div className="panel-header"><div><h2>Incident groups</h2><p>Grouped by a local text and proximity heuristic. Similarity is not proof of a duplicate.</p></div></div>
      {loading ? <div className="empty-state">Loading incidents…</div> : visible.length ? <div className="incident-table-scroll"><table className="incident-table"><thead><tr><th>Incident</th><th>Category</th><th>Location</th><th>Reports</th><th>Severity</th><th>Review</th><th>Latest report</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><button className="pulse-incident-link" onClick={() => void open(item)}>{item.title}</button><small>{item.id}</small></td><td>{item.dominant_category}</td><td><MapPin size={12} /> {item.location}</td><td><b>{item.complaint_count}</b></td><td><PriorityBadge priority={item.severity} /></td><td><span className={`review-chip ${item.review_status.toLowerCase()}`}>{item.review_status}</span></td><td>{date(item.latest_reported_at)}</td><td><button className="row-link" onClick={() => void open(item)} aria-label={`View ${item.id}`}><Search size={14} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>No incident groups yet</span><small>Run duplicate detection to find likely co-located reports in the same category.</small><button className="secondary-button" onClick={() => void detect()} disabled={detecting}>Run detection</button></div>}
    </section>
    {selected && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null) }}><section className="civic-modal detail-modal incident-detail"><div className="modal-header"><div><span className="eyebrow">{selected.id} · {selected.review_status.toUpperCase()}</span><h2>{selected.title}</h2><p>{selected.dominant_category} · {selected.location}</p></div><button className="panel-icon-button" onClick={() => setSelected(null)} aria-label="Close incident details"><X size={16} /></button></div><div className="detail-grid"><div><small>Reports</small><b>{selected.complaint_count}</b></div><div><small>Highest severity</small><PriorityBadge priority={selected.severity} /></div><div><small>First reported</small><b>{date(selected.first_reported_at)}</b></div><div><small>Latest report</small><b>{date(selected.latest_reported_at)}</b></div></div><h3 className="detail-subhead">Incident timeline</h3><div className="history-list">{selected.timeline.map((entry) => <div key={entry.complaint_id}><span className="history-dot" /><b>{entry.title}</b><small>{entry.complaint_id} · {date(entry.reported_at)} · {entry.status}</small></div>)}</div><h3 className="detail-subhead">Linked complaints</h3>{selected.complaints.map((complaint) => <div className="pulse-complaint" key={complaint.id}><b>{complaint.id} · {complaint.title}</b><small>{complaint.category} · {complaint.location} · {complaint.status}</small><p>{complaint.description}</p></div>)}{selected.possible_relationships.length > 0 && <div className="analysis-note"><span>POSSIBLE RELATIONSHIP · NOT PROVEN CAUSATION</span><p>{selected.possible_relationships.join(' · ')}</p></div>}<div className="modal-footer"><span>Similarity {Math.round(selected.similarity_score * 100)}% · review required</span>{selected.review_status === 'Suggested' && <div className="incident-actions"><button className="secondary-button" disabled={busy} onClick={() => void decide(false)}><X size={14} /> Reject</button><button className="primary-button" disabled={busy} onClick={() => void decide(true)}><Check size={14} /> Confirm group</button></div>}</div></section></div>}
    {busy && !selected && <span className="sr-only" role="status">Loading incident details</span>}
  </div>
}
