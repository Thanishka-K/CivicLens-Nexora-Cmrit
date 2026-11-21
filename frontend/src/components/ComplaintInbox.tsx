import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowUpRight, Check, Clock3, Plus, RefreshCw, X } from 'lucide-react'
import { api, mediaUrl, type Complaint, type ComplaintHistory, type ComplaintInput, type ComplaintStatus, type Department, type Severity } from '../api/client'
import type { PageId } from '../app/navigation'
import { DemoTag, PageHeader, PriorityBadge, SelectButton } from './ui'

const categories = ['Road Potholes', 'Garbage Overflow', 'Water Leakage', 'Exposed Electrical Wires', 'Fallen Trees', 'Blocked Drainage', 'Waterlogging']
const statuses: ComplaintStatus[] = ['Submitted', 'New', 'In Progress', 'On Hold', 'Resolved']
const severities: Severity[] = ['Low', 'Medium', 'High', 'Critical']

const emptyForm: ComplaintInput = { title: '', description: '', category: categories[0], location: '', language: 'English', severity: 'Medium' }

function formatTime(value: string): string {
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function ComplaintInbox({ search, onNavigate }: { search: string; onNavigate: (page: PageId) => void }) {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [severityFilter, setSeverityFilter] = useState('All severity')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ComplaintInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [selected, setSelected] = useState<Complaint | null>(null)
  const [history, setHistory] = useState<ComplaintHistory[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [result, departmentList] = await Promise.all([
        api.getComplaints({
          status: statusFilter === 'All statuses' ? undefined : statusFilter,
          severity: severityFilter === 'All severity' ? undefined : severityFilter,
          department: departmentFilter === 'All departments' ? undefined : departmentFilter,
          page_size: '100',
        }),
        api.getDepartments(),
      ])
      setComplaints(result.items)
      setTotal(result.total)
      setDepartments(departmentList)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load complaint records.')
    } finally { setLoading(false) }
  }, [statusFilter, severityFilter, departmentFilter])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => complaints.filter((complaint) => `${complaint.id} ${complaint.title} ${complaint.description} ${complaint.category} ${complaint.location} ${complaint.language} ${complaint.department_name ?? ''}`.toLowerCase().includes(search.toLowerCase())), [complaints, search])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await api.createComplaint({ ...form, title: form.title.trim() || form.description.trim().slice(0, 120) || 'Civic report' })
      setModalOpen(false)
      setForm(emptyForm)
      await load()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Could not save complaint.')
    } finally { setSaving(false) }
  }

  async function changeStatus(complaint: Complaint, status: ComplaintStatus) {
    try {
      const updated = await api.updateComplaint(complaint.id, { status })
      setComplaints((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSelected((current) => current?.id === updated.id ? { ...current, status: updated.status } : current)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update complaint status.')
    }
  }

  async function showDetails(complaint: Complaint) {
    setSelected(complaint)
    setDetailLoading(true)
    setDetailError('')
    try {
      const [detail, events] = await Promise.all([api.getComplaint(complaint.id), api.getComplaintHistory(complaint.id)])
      setSelected(detail)
      setHistory(events)
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : 'Could not load complaint details.')
    } finally { setDetailLoading(false) }
  }

  return <div className="page-content inbox-page">
    <PageHeader eyebrow="OPERATIONS · LOCAL API" title="Complaint Inbox" description="Review reports, update ownership and track their status." actions={<><DemoTag>LOCAL DATABASE</DemoTag><button className="primary-button" onClick={() => { setFormError(''); setModalOpen(true) }}><Plus size={15} /> New complaint</button></>} />
    <div className="inbox-summary"><div><b>{total}</b><span>records in selected view</span></div><div><span className="inbox-live-dot" />Connected to CivicLens API</div><button className="panel-icon-button" onClick={() => void load()} aria-label="Refresh complaint list"><RefreshCw size={15} /></button></div>
    {error && <div className="api-alert" role="alert"><AlertCircle size={16} /><span><b>Could not load complaint records</b>{error}</span><button onClick={() => void load()}>Retry</button></div>}
    <section className="panel inbox-panel"><div className="panel-header"><div><h2>All complaints</h2><p>Filter and update locally persisted reports</p></div><div className="inbox-filters"><SelectButton label="Filter by status" value={statusFilter} options={['All statuses', ...statuses]} onChange={setStatusFilter} /><SelectButton label="Filter by severity" value={severityFilter} options={['All severity', ...severities]} onChange={setSeverityFilter} /><SelectButton label="Filter by department" value={departmentFilter} options={['All departments', ...departments.map((department) => department.name)]} onChange={setDepartmentFilter} /></div></div>
      {loading ? <div className="empty-state"><span>Loading complaints…</span><small>Contacting the local CivicLens API.</small></div> : visible.length ? <div className="inbox-table-scroll"><table className="inbox-table"><thead><tr><th>Complaint</th><th>Category</th><th>Location</th><th>Severity</th><th>Department</th><th>Status</th><th>Submitted</th><th /></tr></thead><tbody>{visible.map((complaint) => <tr key={complaint.id}><td><div className="incident-title">{complaint.title}</div><span className="incident-id">{complaint.id} · {complaint.language}{complaint.demo && <i> · Demo data</i>}</span></td><td>{complaint.category}</td><td>{complaint.location}</td><td><PriorityBadge priority={complaint.priority} /></td><td>{complaint.department_name ?? 'Unassigned'}</td><td><select className={`inbox-status-select status-${complaint.status.toLowerCase().replaceAll(' ', '-')}`} aria-label={`Update status for ${complaint.id}`} value={complaint.status} onChange={(event) => void changeStatus(complaint, event.target.value as ComplaintStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></td><td>{formatTime(complaint.submitted_at)}</td><td><button className="row-link" onClick={() => void showDetails(complaint)} aria-label={`View ${complaint.id} details`}><ArrowUpRight size={15} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>{search ? 'No records match your search' : 'No complaints in this view'}</span><small>Change a filter or submit a new complaint.</small><button className="text-link" onClick={() => { setFormError(''); setModalOpen(true) }}>Create a complaint <span>→</span></button></div>}
      <div className="table-footer"><span>Showing <b>{visible.length}</b> of {total} records</span><span className="table-footnote">Original report text is stored separately from rule-based analysis.</span></div>
    </section>
    {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}><form className="civic-modal complaint-form" onSubmit={(event) => void submit(event)}><div className="modal-header"><div><span className="eyebrow">NEW REPORT · STORED LOCALLY</span><h2>Submit a complaint</h2><p>This creates a persistent complaint record and an auditable demo analysis.</p></div><button type="button" className="panel-icon-button" onClick={() => setModalOpen(false)} aria-label="Close form"><X size={16} /></button></div>
      {formError && <div className="form-error" role="alert"><AlertCircle size={15} />{formError}</div>}
      <label className="form-field form-field-wide"><span>Description</span><textarea required minLength={8} maxLength={4000} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe what happened and what needs attention…" /></label>
      <div className="form-row"><label className="form-field"><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>Severity</span><select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as Severity })}>{severities.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <label className="form-field form-field-wide"><span>Location</span><input required minLength={2} maxLength={240} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Ward, street or landmark" /></label>
      <label className="form-field form-field-wide"><span>Department <small>Optional · auto-routed by category</small></span><select value={form.department_id ?? ''} onChange={(event) => setForm({ ...form, department_id: event.target.value || null })}><option value="">Automatic category routing</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <div className="modal-footer"><span><Clock3 size={13} /> A demo rule summary will be attached.</span><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : <><Check size={15} /> Save complaint</>}</button></div>
    </form></div>}
    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="civic-modal detail-modal"><div className="modal-header"><div><span className="eyebrow">{selected.id} · {selected.demo ? 'DEMONSTRATION RECORD' : 'LOCAL RECORD'}</span><h2>{selected.title}</h2><p>{selected.category} · {selected.location} · {selected.language}</p></div><button type="button" className="panel-icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={16} /></button></div>{detailLoading ? <div className="empty-state">Loading record details…</div> : detailError ? <div className="form-error"><AlertCircle size={15} />{detailError}</div> : <><div className="detail-description">{selected.description}</div><div className="detail-grid"><div><small>Severity</small><PriorityBadge priority={selected.priority} /></div><div><small>Department</small><b>{selected.department_name ?? 'Unassigned'}</b></div><div><small>Submitted</small><b>{formatTime(selected.submitted_at)}</b></div><div><small>Coordinates</small><b>{selected.latitude != null && selected.longitude != null ? `${selected.latitude.toFixed(4)}, ${selected.longitude.toFixed(4)}` : 'Not supplied'}</b></div></div>{selected.image_reference && <div className="detail-subhead">Attached image</div>}{selected.image_reference && <img className="detail-image" src={mediaUrl(selected.image_reference)} alt="Citizen submitted evidence" />}<div className="detail-subhead">AI recommendation � officer review required</div>{selected.ai_analysis ? <div className="analysis-note"><span>{selected.ai_analysis.source} � {Math.round(selected.ai_analysis.confidence * 100)}% confidence � Priority {selected.ai_analysis.priority_score}/100</span><p>{selected.ai_analysis.predicted_category} � {selected.ai_analysis.severity} � {selected.ai_analysis.department_name ?? 'Unassigned'}</p><p>{selected.ai_analysis.explanation}</p><small>{selected.ai_analysis.urgency}</small>{selected.ai_analysis.knowledge_references?.map((reference) => <small key={reference.id}>Retrieved demo guidance: {reference.title}</small>)}</div> : <div className="analysis-note">No analysis record available.</div>}<div className="detail-subhead">Status history</div><div className="history-list">{history.map((event) => <div key={event.id}><span className="history-dot" /><b>{event.new_status}</b><small>{event.previous_status} → {event.new_status} · {formatTime(event.changed_at)} · {event.changed_by}</small></div>)}</div><div className="modal-footer"><span>History is kept as status events.</span><button className="secondary-button" onClick={() => { setSelected(null); onNavigate('command') }}>Back to Command Centre</button></div></>}</section></div>}
  </div>
}
