import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowDownToLine, Check, Copy, LoaderCircle, Play, RefreshCw } from 'lucide-react'
import { api, type AIAnalysis, type Complaint, type ComplaintStatus, type DashboardStats, type Department, type Health } from '../api/client'
import { DemoTag, PageHeader, PriorityBadge } from './ui'

const statusOptions: ComplaintStatus[] = ['New', 'In Progress', 'On Hold', 'Resolved']
const severityRank = (value: string) => ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[value] ?? 0)
const displayDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))

function useRecords() {
  const [items, setItems] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setItems((await api.getComplaints({ page_size: '200' })).items) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load complaint records.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  return { items, setItems, loading, error, setError, load }
}

function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return message ? <div className="api-alert" role="alert"><AlertCircle size={15} /><span>{message}</span>{retry && <button onClick={retry}>Retry</button>}</div> : null
}

export function ImpactIQ() {
  const records = useRecords()
  const [category, setCategory] = useState('All categories')
  const [severity, setSeverity] = useState('All severity')
  const [selected, setSelected] = useState<Complaint | null>(null)
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const filtered = records.items.filter((item) => (category === 'All categories' || item.category === category) && (severity === 'All severity' || item.severity === severity))
  const severityCounts = ['Critical', 'High', 'Medium', 'Low'].map((name) => ({ name, count: filtered.filter((item) => item.severity === name).length }))
  const highRisk = filtered.filter((item) => item.severity === 'Critical' || item.severity === 'High').length
  async function inspect(item: Complaint) {
    setSelected(item); setAnalysis(null); setNotice('')
    try { setAnalysis(await api.getAnalysis(item.id)) } catch { /* analysis can be generated from the detail action */ }
  }
  async function analyze(item: Complaint) {
    setBusy(item.id); setNotice('')
    try { const result = await api.analyzeComplaint(item.id); setAnalysis(result); records.setItems((prev) => prev.map((c) => c.id === item.id ? { ...c, severity: result.severity } : c)); setNotice(`Analysis saved for ${item.id}.`) }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Analysis failed.') }
    finally { setBusy('') }
  }
  return <div className="page-content operational-page"><PageHeader eyebrow="INTELLIGENCE · RISK TRIAGE" title="ImpactIQ" description="Assess the severity and response priority of actual reports. Risk indicators are recommendations for officer review." actions={<DemoTag>DATABASE RECORDS</DemoTag>} />
    <ErrorBox message={records.error} retry={() => void records.load()} /><div className="module-filter-row"><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option>All categories</option>{[...new Set(records.items.map((x) => x.category))].map((x) => <option key={x}>{x}</option>)}</select></label><label>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)}>{['All severity', 'Critical', 'High', 'Medium', 'Low'].map((x) => <option key={x}>{x}</option>)}</select></label><button className="secondary-button" onClick={() => void records.load()}><RefreshCw size={14} /> Refresh</button></div>
    <div className="impact-metrics">{severityCounts.map((row) => <div className={`panel impact-stat ${row.name.toLowerCase()}`} key={row.name}><small>{row.name} severity</small><b>{records.loading ? '…' : row.count}</b><span>{filtered.length ? Math.round(row.count * 100 / filtered.length) : 0}% of filtered reports</span></div>)}<div className="panel impact-stat risk"><small>High impact queue</small><b>{records.loading ? '…' : highRisk}</b><span>Critical and high severity</span></div></div>
    <section className="panel"><div className="panel-header"><div><h2>Impact assessment queue</h2><p>Scores appear after a complaint analysis is loaded or run.</p></div></div>{records.loading ? <div className="empty-state">Loading impact data…</div> : <div className="table-scroll"><table className="incident-table"><thead><tr><th>Complaint</th><th>Category</th><th>Severity</th><th>Priority score</th><th>Department</th><th>Assessment</th></tr></thead><tbody>{filtered.sort((a,b) => severityRank(b.severity)-severityRank(a.severity)).map((item) => <tr key={item.id}><td><button className="module-link" onClick={() => void inspect(item)}>{item.title}</button><small>{item.id} · {item.location}</small></td><td>{item.category}</td><td><PriorityBadge priority={item.severity} /></td><td>{analysis?.complaint_id === item.id ? `${analysis.priority_score}/100` : item.ai_analysis?.priority_score ? `${item.ai_analysis.priority_score}/100` : '—'}</td><td>{item.department_name ?? 'Unassigned'}</td><td><button className="secondary-button" onClick={() => void analyze(item)} disabled={busy === item.id}>{busy === item.id ? 'Analyzing…' : 'Analyze'}</button></td></tr>)}</tbody></table></div>}</section>
    {notice && <div className="module-feedback" role="status">{notice}</div>}
    {selected && <section className="panel module-detail"><div className="panel-header"><div><h2>{selected.title}</h2><p>{selected.id} · {selected.location} · {selected.category}</p></div><button className="secondary-button" onClick={() => setSelected(null)}>Close</button></div><p>{selected.description}</p><div className="impact-detail-grid"><span>Reported severity <PriorityBadge priority={selected.severity} /></span><span>Priority score <b>{analysis?.priority_score ?? 'Not analyzed'}</b></span><span>Department <b>{analysis?.department_name ?? selected.department_name ?? 'Unassigned'}</b></span><span>Risk signal <b>{analysis?.urgency ?? 'Run analysis to assess urgency'}</b></span></div>{analysis && <p className="analysis-note">{analysis.explanation}</p>}</section>}
  </div>
}

export function ResponseAI() {
  const records = useRecords()
  const [departments, setDepartments] = useState<Department[]>([])
  const [selected, setSelected] = useState<Complaint | null>(null)
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { void api.getDepartments().then(setDepartments).catch((e) => setMessage(e instanceof Error ? e.message : 'Departments unavailable.')) }, [])
  async function getPlan(item: Complaint) {
    setSelected(item); setBusy(true); setMessage('')
    try { let result: AIAnalysis; try { result = await api.getAnalysis(item.id); if (result.source !== 'hybrid-rules-tfidf-demo') result = await api.analyzeComplaint(item.id) } catch { result = await api.analyzeComplaint(item.id) }; setAnalysis(result) }
    catch (e) { setAnalysis(null); setMessage(e instanceof Error ? e.message : 'Could not generate a response recommendation.') }
    finally { setBusy(false) }
  }
  async function useRouting() {
    if (!selected || !analysis) return
    const team = departments.find((d) => d.name === analysis.department_name)
    if (!team) { setMessage('The suggested department is not available in the department directory.'); return }
    setBusy(true)
    try { const saved = await api.updateComplaint(selected.id, { department_id: team.id }); records.setItems((rows) => rows.map((x) => x.id === saved.id ? saved : x)); setMessage(`Routing saved to ${team.name}.`) }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save routing.') }
    finally { setBusy(false) }
  }
  async function copyPlan() {
    if (!analysis) return
    const text = `${analysis.urgency}\n${analysis.explanation}\n${analysis.knowledge_references.map((ref) => `${ref.title}: ${ref.excerpt}`).join('\n')}`
    try { await navigator.clipboard.writeText(text); setMessage('Grounded response guidance copied.') } catch { setMessage('Clipboard access is unavailable in this browser.') }
  }
  return <div className="page-content operational-page"><PageHeader eyebrow="OPERATIONS · GROUNDED GUIDANCE" title="ResponseAI" description="Review local demonstration guidance and route reports. Recommendations are not official municipal instructions." actions={<DemoTag>OFFLINE KNOWLEDGE BASE</DemoTag>} />
    <ErrorBox message={records.error} retry={() => void records.load()} />{message && <div className="module-feedback" role="status">{message}</div>}
    <section className="panel"><div className="panel-header"><div><h2>Reports needing a response plan</h2><p>Open a record to retrieve a department suggestion and grounded guidance.</p></div></div>{records.loading ? <div className="empty-state">Loading reports…</div> : records.items.length ? <div className="response-list">{records.items.filter((x) => x.status !== 'Resolved').slice(0, 80).map((item) => <button key={item.id} className={`response-row ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => void getPlan(item)}><span><b>{item.title}</b><small>{item.id} · {item.location}</small></span><PriorityBadge priority={item.severity} /><span>{item.department_name ?? 'Unassigned'}</span></button>)}</div> : <div className="empty-state">No reports available.</div>}</section>
    {selected && <section className="panel module-detail"><div className="panel-header"><div><h2>Response recommendation</h2><p>{selected.title} · {selected.id}</p></div>{busy && <LoaderCircle size={17} className="spin" />}</div>{analysis ? <><div className="impact-detail-grid"><span>Suggested team <b>{analysis.department_name ?? 'Officer review'}</b></span><span>Suggested urgency <b>{analysis.urgency}</b></span><span>Priority <b>{analysis.priority_score}/100</b></span><span>Engine <b>{analysis.source}</b></span></div><p className="analysis-note">{analysis.explanation}</p><h3 className="detail-subhead">Retrieved guidance · demonstration sources</h3>{analysis.knowledge_references.map((ref) => <article className="knowledge-ref" key={ref.id}><b>{ref.title}</b><small>{ref.id} · local sample</small><p>{ref.excerpt}</p></article>)}<div className="module-actions"><button className="primary-button" disabled={busy} onClick={() => void useRouting()}><Check size={14} /> Use department recommendation</button><button className="secondary-button" onClick={() => void copyPlan()}><Copy size={14} /> Copy guidance</button></div></> : <div className="empty-state">{busy ? 'Retrieving analysis…' : 'No analysis available.'}</div>}</section>}
  </div>
}

export function ActionTracker() {
  const records = useRecords()
  const [departments, setDepartments] = useState<Department[]>([])
  const [view, setView] = useState<'Pending'|'In Progress'|'Resolved'>('Pending')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { void api.getDepartments().then(setDepartments).catch((e) => setNotice(e instanceof Error ? e.message : 'Departments unavailable.')) }, [])
  const shown = records.items.filter((x) => view === 'Pending' ? x.status === 'Submitted' || x.status === 'New' || x.status === 'On Hold' : view === 'Resolved' ? x.status === 'Resolved' : x.status === 'In Progress')
  async function update(item: Complaint, patch: { status?: ComplaintStatus; department_id?: string | null; severity?: Complaint['severity']; priority?: Complaint['priority'] }) {
    setBusy(item.id); setNotice('')
    try { const next = await api.updateComplaint(item.id, patch); records.setItems((xs) => xs.map((x) => x.id === next.id ? next : x)); setNotice(`Saved updates to ${item.id}.`) }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Update failed.'); void records.load() }
    finally { setBusy('') }
  }
  return <div className="page-content operational-page"><PageHeader eyebrow="OPERATIONS · PERSISTENT WORKFLOW" title="ActionTracker" description="Update report status, responsible team, and severity. Changes are saved to the CivicLens database." actions={<DemoTag>SQLITE WORKFLOW</DemoTag>} />
    <ErrorBox message={records.error} retry={() => void records.load()} />{notice && <div className="module-feedback" role="status">{notice}</div>}
    <div className="workflow-tabs">{(['Pending','In Progress','Resolved'] as const).map((x) => <button key={x} className={view===x?'active':''} onClick={() => setView(x)}>{x}<b>{records.items.filter((r) => x==='Pending'?['Submitted','New','On Hold'].includes(r.status):r.status===x).length}</b></button>)}</div>
    <section className="panel"><div className="panel-header"><div><h2>{view} reports</h2><p>Edits persist through the complaint PATCH API.</p></div><button className="secondary-button" onClick={() => void records.load()}><RefreshCw size={14} /> Refresh</button></div>{records.loading ? <div className="empty-state">Loading work queue…</div> : shown.length ? <div className="table-scroll"><table className="incident-table"><thead><tr><th>Complaint</th><th>Status</th><th>Department</th><th>Severity</th><th>Priority</th><th>Updated</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td><div className="incident-title">{item.title}</div><small>{item.id} · {item.location}</small></td><td><select className="workflow-select" aria-label={`Status ${item.id}`} value={item.status==='Submitted'?'New':item.status} disabled={busy===item.id} onChange={(e) => void update(item,{status:e.target.value as ComplaintStatus})}>{statusOptions.map((x)=><option key={x}>{x}</option>)}</select></td><td><select className="workflow-select" aria-label={`Department ${item.id}`} value={item.department_id ?? ''} disabled={busy===item.id} onChange={(e) => void update(item,{department_id:e.target.value||null})}><option value="">Unassigned</option>{departments.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></td><td><select className="workflow-select" aria-label={`Severity ${item.id}`} value={item.severity} disabled={busy===item.id} onChange={(e) => void update(item,{severity:e.target.value as Complaint['severity']})}>{['Critical','High','Medium','Low'].map((x)=><option key={x}>{x}</option>)}</select></td><td><select className="workflow-select" aria-label={`Priority ${item.id}`} value={item.priority} disabled={busy===item.id} onChange={(e) => void update(item,{priority:e.target.value as Complaint['priority']})}>{['Critical','High','Medium','Low'].map((x)=><option key={x}>{x}</option>)}</select></td><td>{displayDate(item.submitted_at)}</td></tr>)}</tbody></table></div> : <div className="empty-state">No reports in this view.</div>}</section>
  </div>
}

export function CivicMemory() {
  const records = useRecords()
  const [selectedCategory, setSelectedCategory] = useState('All categories')
  const items = records.items.filter((x) => selectedCategory==='All categories' || x.category===selectedCategory)
  const byCategory = [...items.reduce((map,x) => map.set(x.category,(map.get(x.category)??0)+1),new Map<string,number>())].sort((a,b)=>b[1]-a[1])
  const byLocation = [...items.reduce((map,x) => map.set(x.location,(map.get(x.location)??0)+1),new Map<string,number>())].sort((a,b)=>b[1]-a[1]).slice(0,8)
  return <div className="page-content operational-page"><PageHeader eyebrow="INSIGHTS · HISTORICAL PATTERNS" title="CivicMemory" description="Explore recurring categories and reported locations from the complaint database. Counts are descriptive, not forecasts." actions={<DemoTag>{records.items.some((x)=>x.demo)?'SYNTHETIC + LOCAL RECORDS':'LOCAL RECORDS'}</DemoTag>} />
    <ErrorBox message={records.error} retry={() => void records.load()} /><div className="module-filter-row"><label>Focus category<select value={selectedCategory} onChange={(e)=>setSelectedCategory(e.target.value)}><option>All categories</option>{byCategory.map(([x])=><option key={x}>{x}</option>)}</select></label><span className="memory-total">{records.loading?'Loading…':`${items.length} records in this view`}</span></div>
    <div className="memory-grid"><section className="panel"><div className="panel-header"><div><h2>Recurring civic problems</h2><p>Select a category to filter location patterns.</p></div></div>{byCategory.length?byCategory.map(([name,count])=><button key={name} className={`memory-row ${selectedCategory===name?'active':''}`} onClick={()=>setSelectedCategory(selectedCategory===name?'All categories':name)}><span>{name}</span><b>{count}</b><i><em style={{width:`${items.length?count/items.length*100:0}%`}}/></i></button>):<div className="empty-state">No records available.</div>}</section><section className="panel"><div className="panel-header"><div><h2>Frequently reported locations</h2><p>Locations with more than one report appear first.</p></div></div>{byLocation.length?byLocation.map(([name,count],index)=><div className="memory-location" key={name}><span className="memory-rank">0{index+1}</span><span><b>{name}</b><small>{selectedCategory==='All categories'?'Across categories':selectedCategory}</small></span><strong>{count}</strong></div>):<div className="empty-state">No location records available.</div>}</section></div>
    <p className="module-footnote">Historical counts use current local SQLite records. No causal or predictive claims are made.</p>
  </div>
}

export function CivicSim() {
  const records=useRecords()
  const [crews,setCrews]=useState(4); const [staff,setStaff]=useState(3); const [strategy,setStrategy]=useState('Highest severity first'); const [ran,setRan]=useState(false)
  const urgent=records.items.filter((x)=>x.status!=='Resolved'&&(x.severity==='Critical'||x.severity==='High')).length
  const regular=records.items.filter((x)=>x.status!=='Resolved'&&x.severity==='Medium').length
  const capacity=crews; const open=records.items.filter((x)=>x.status!=='Resolved')
  const ordered=[...open].sort((a,b)=>strategy==='Oldest report first'?new Date(a.submitted_at).getTime()-new Date(b.submitted_at).getTime():strategy==='Department balanced'?a.department_name?.localeCompare(b.department_name??'')??0:severityRank(b.severity)-severityRank(a.severity))
  if(strategy==='Department balanced'){ordered.sort((a,b)=>(a.department_name??'').localeCompare(b.department_name??''));const byTeam=new Map<string,Complaint[]>();for(const item of open){const key=item.department_name??'Unassigned';byTeam.set(key,[...(byTeam.get(key)??[]),item])};ordered.length=0;let pending=[...byTeam.values()];while(pending.length){for(const team of pending)if(team.length)ordered.push(team.shift()!);pending=pending.filter((team)=>team.length)}}
  const allocated=ordered.slice(0,capacity);const criticalCovered=allocated.filter((x)=>x.severity==='Critical'||x.severity==='High').length;const routineCovered=allocated.filter((x)=>x.severity==='Medium').length
  return <div className="page-content operational-page"><PageHeader eyebrow="PLANNING · HYPOTHETICAL" title="CivicSim" description="Compare staffing assumptions against current open workload. Simulation changes do not update complaints or dispatch real crews." actions={<DemoTag>SIMULATED OUTCOMES</DemoTag>} />
    <ErrorBox message={records.error} retry={()=>void records.load()} /><section className="panel sim-controls"><div className="panel-header"><div><h2>Response allocation scenario</h2><p>Adjust the hypothetical resources, then run the scenario.</p></div><button className="primary-button" onClick={()=>setRan(true)} disabled={records.loading}><Play size={14}/> Run simulation</button></div><div className="sim-input-grid"><label>Available crews<input type="range" min="1" max="20" value={crews} onChange={(e)=>{setCrews(+e.target.value);setRan(false)}}/><b>{crews} crews</b></label><label>Staff per crew<input type="range" min="1" max="8" value={staff} onChange={(e)=>{setStaff(+e.target.value);setRan(false)}}/><b>{staff} staff</b></label><label>Allocation strategy<select value={strategy} onChange={(e)=>{setStrategy(e.target.value);setRan(false)}}><option>Highest severity first</option><option>Department balanced</option><option>Oldest report first</option></select></label></div></section>
    {ran&&<div className="sim-results"><div className="panel impact-stat"><small>Open high-risk reports</small><b>{urgent}</b><span>From local records</span></div><div className="panel impact-stat"><small>Hypothetical crews</small><b>{crews}</b><span>{staff} staff per crew · one crew per task</span></div><div className="panel impact-stat"><small>High-risk reports allocated</small><b>{criticalCovered}/{urgent}</b><span>{urgent?Math.round(criticalCovered/urgent*100):100}% by this strategy</span></div><div className="panel impact-stat"><small>Routine reports allocated</small><b>{routineCovered}/{regular}</b><span>Medium-severity reports</span></div><section className="panel sim-explanation"><h2>{strategy}</h2><p>This deterministic demo allocates each of {capacity} crews to one open report according to the selected ordering strategy. It estimates workload coverage only and does not predict resolution or impact; changing inputs does not alter city records.</p></section></div>}
    {!ran&&<div className="empty-state panel">{records.loading?'Loading current workload…':'Adjust inputs and run the scenario to view a hypothetical allocation.'}</div>}
  </div>
}

export function AnalyticsReports() {
  const records=useRecords(); const [stats,setStats]=useState<DashboardStats|null>(null); const [departments,setDepartments]=useState<Department[]>([]); const [range,setRange]=useState('All records'); const [category,setCategory]=useState('All categories'); const [message,setMessage]=useState('')
  useEffect(()=>{void Promise.all([api.getDashboardStats(),api.getDepartments()]).then(([s,d])=>{setStats(s);setDepartments(d)}).catch((e)=>setMessage(e instanceof Error?e.message:'Analytics unavailable.'))},[])
  const recent=range==='Last 7 days'?records.items.filter((x)=>Date.now()-new Date(x.submitted_at).getTime()<=7*86400000):records.items
  const filtered=recent.filter((x)=>category==='All categories'||x.category===category)
  const resolved=filtered.filter((x)=>x.status==='Resolved').length
  const categoryRows=[...filtered.reduce((m,x)=>m.set(x.category,(m.get(x.category)??0)+1),new Map<string,number>())].sort((a,b)=>b[1]-a[1])
  const trend=range==='Last 7 days'?(stats?.trend_7_days??[]):(stats?.trend_30_days??[])
  function download() {
    const header=['id','title','category','severity','priority','status','department','location','submitted_at']
    const rows=filtered.map((x)=>[x.id,x.title,x.category,x.severity,x.priority,x.status,x.department_name??'',x.location,x.submitted_at])
    const csv=[header,...rows].map((r)=>r.map((v)=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='civiclens-complaint-report.csv';link.click();URL.revokeObjectURL(url);setMessage(`Exported ${filtered.length} complaint records.`)
  }
  return <div className="page-content operational-page"><PageHeader eyebrow="INSIGHTS · REPORTING" title="Analytics & Reports" description="Database-backed trends and a downloadable complaint summary." actions={<button className="primary-button" onClick={download} disabled={records.loading}><ArrowDownToLine size={15}/> Export filtered CSV</button>} />
    <ErrorBox message={records.error||message} retry={()=>{void records.load();void api.getDashboardStats().then(setStats).catch(()=>{})}}/><div className="module-filter-row"><label>Period<select value={range} onChange={(e)=>setRange(e.target.value)}><option>All records</option><option>Last 7 days</option></select></label><label>Category<select value={category} onChange={(e)=>setCategory(e.target.value)}><option>All categories</option>{[...new Set(records.items.map((x)=>x.category))].map((x)=><option key={x}>{x}</option>)}</select></label><span className="memory-total">{records.loading?'Loading…':`${filtered.length} filtered complaints`}</span></div>
    <div className="impact-metrics"><div className="panel impact-stat"><small>Complaints</small><b>{filtered.length}</b><span>Filtered records</span></div><div className="panel impact-stat"><small>Resolved</small><b>{resolved}</b><span>{filtered.length?Math.round(resolved/filtered.length*100):0}% of filtered records</span></div><div className="panel impact-stat"><small>Unresolved critical</small><b>{filtered.filter((x)=>x.status!=='Resolved'&&x.severity==='Critical').length}</b><span>Requires urgent review</span></div><div className="panel impact-stat"><small>Database total</small><b>{stats?.total_complaints??'—'}</b><span>API dashboard count</span></div></div>
    <div className="memory-grid"><section className="panel"><div className="panel-header"><div><h2>Category distribution</h2><p>Actual complaint counts in current filter.</p></div></div>{categoryRows.map(([name,count])=><div className="memory-row static" key={name}><span>{name}</span><b>{count}</b><i><em style={{width:`${filtered.length?count/filtered.length*100:0}%`}}/></i></div>)}</section><section className="panel"><div className="panel-header"><div><h2>Complaint trend</h2><p>Received and resolved by API reporting window.</p></div></div><div className="trend-list">{trend.map((x)=><div key={x.day}><span>{x.day}</span><i><em style={{width:`${Math.min(100,(x.received/Math.max(1,...trend.map((v)=>v.received)))*100)}%`}}/></i><b>{x.received} in · {x.resolved} out</b></div>)}</div></section></div>
    <section className="panel"><div className="panel-header"><div><h2>Department performance</h2><p>Open versus resolved workload from the database.</p></div></div><div className="department-list">{departments.map((d)=><div className="department-row" key={d.id}><div className="department-row-head"><span>{d.name}</span><span><b>{d.open_count}</b><small> open / {d.complaint_count} total</small></span></div><div className="workload-track"><i style={{width:`${d.complaint_count?Math.round((d.complaint_count-d.open_count)/d.complaint_count*100):0}%`}}/></div></div>)}</div></section>
    {message&&<div className="module-feedback" role="status">{message}</div>}
  </div>
}

export function SettingsModule({theme,onThemeToggle}:{theme:'dark'|'light';onThemeToggle:()=>void}) {
  const [health,setHealth]=useState<Health|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false)
  async function check(){setLoading(true);setError('');try{setHealth(await api.getHealth())}catch(e){setError(e instanceof Error?e.message:'API health check failed.')}finally{setLoading(false)}}
  useEffect(()=>{void check()},[])
  return <div className="page-content operational-page"><PageHeader eyebrow="WORKSPACE · CONFIGURATION" title="Settings" description="Check the active CivicLens services and adjust your local display preference." actions={<DemoTag>LOCAL WORKSPACE</DemoTag>} />
    {error&&<ErrorBox message={error} retry={()=>void check()}/>}<section className="panel settings-grid"><div className="panel-header"><div><h2>Service connection</h2><p>Live status from the configured FastAPI backend.</p></div><button className="secondary-button" onClick={()=>void check()} disabled={loading}><RefreshCw size={14}/>{loading?'Checking…':'Check again'}</button></div><div className="settings-facts"><span><small>BACKEND</small><b>{health?.service??'CivicLens API'} · http://127.0.0.1:8765</b></span><span><small>DATABASE</small><b>{health?.database??(error?'Unavailable':'Checking…')}</b></span><span><small>STATUS</small><b className={health?.status==='ok'?'status-ok':''}>{health?.status??(error?'Connection error':'Checking…')}</b></span><span><small>FRONTEND API BASE</small><b>{import.meta.env.VITE_API_BASE_URL||'http://127.0.0.1:8765'}</b></span></div></section><section className="panel settings-grid"><div className="panel-header"><div><h2>Appearance</h2><p>Theme choice applies across CivicLens.</p></div></div><div className="theme-setting"><span>Current theme <b>{theme==='dark'?'Dark':'Light'}</b></span><button className="secondary-button" onClick={onThemeToggle}>Switch to {theme==='dark'?'light':'dark'} theme</button></div></section><section className="module-note"><div><b>Prototype data and roles</b><p>Seed complaints and AI/routing recommendations are labeled demonstration data. This local build does not include account authentication or production access controls.</p></div></section>
  </div>
}

