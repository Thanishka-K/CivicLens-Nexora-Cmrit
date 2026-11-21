import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { AlertCircle, Layers, MapPin, Minus, Plus, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { api, type Complaint, type Department, type Incident } from '../api/client'
import { DemoTag, PageHeader, PriorityBadge } from './ui'

const HEIGHT = 560
const WORLD = 256
function project(lat: number, lon: number, zoom: number) {
  const scale = WORLD * 2 ** zoom, sin = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180)
  return { x: (lon + 180) / 360 * scale, y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale }
}
function unproject(x: number, y: number, zoom: number) {
  const scale = WORLD * 2 ** zoom
  return { longitude: x / scale * 360 - 180, latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180 / Math.PI }
}
function date(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
function demoPoint(item: Complaint) {
  const hash = [...item.id].reduce((n, c) => n + c.charCodeAt(0), 0)
  return item.demo ? { latitude: item.latitude ?? 20.59 + ((hash % 30) - 15) / 500, longitude: item.longitude ?? 78.96 + ((hash % 42) - 21) / 500, fictional: true } : { latitude: item.latitude, longitude: item.longitude, fictional: false }
}

export function CityVision({ search, onNavigate }: { search: string; onNavigate: (page: 'pulse' | 'inbox') => void }) {
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const [size, setSize] = useState({ width: 850, height: HEIGHT })
  const [center, setCenter] = useState({ latitude: 17.385, longitude: 78.4867 })
  const [zoom, setZoom] = useState(11)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [category, setCategory] = useState('All categories')
  const [severity, setSeverity] = useState('All severity')
  const [department, setDepartment] = useState('All departments')
  const [showHeat, setShowHeat] = useState(true)
  const [showGroups, setShowGroups] = useState(true)
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tileError, setTileError] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [result, groups, teams] = await Promise.all([api.getComplaints({ page_size: '200' }), api.getIncidents(), api.getDepartments()])
      setComplaints(result.items); setIncidents(groups); setDepartments(teams)
      const realPoints = result.items.filter((item) => !item.demo && item.latitude != null && item.longitude != null)
      if (realPoints.length) setCenter({ latitude: realPoints.reduce((sum, item) => sum + item.latitude!, 0) / realPoints.length, longitude: realPoints.reduce((sum, item) => sum + item.longitude!, 0) / realPoints.length })
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load map records.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!box.current) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: HEIGHT }))
    observer.observe(box.current); return () => observer.disconnect()
  }, [])
  const visible = useMemo(() => complaints.filter((c) => (category === 'All categories' || c.category === category || c.ai_analysis?.predicted_category === category) && (severity === 'All severity' || c.severity === severity) && (department === 'All departments' || c.department_name === department) && `${c.id} ${c.title} ${c.location} ${c.category}`.toLowerCase().includes(search.toLowerCase())), [complaints, category, severity, department, search])
  const incidentMembers = useMemo(() => new Set(incidents.flatMap((item) => item.complaint_ids)), [incidents])
  const filteredIncidents = incidents.filter((item) => showGroups && (category === 'All categories' || item.dominant_category === category) && (severity === 'All severity' || item.severity === severity) && (department === 'All departments' || item.departments.includes(department)) && `${item.id} ${item.title} ${item.location}`.toLowerCase().includes(search.toLowerCase()))
  const centerPixel = project(center.latitude, center.longitude, zoom)
  const left = centerPixel.x - size.width / 2 - offset.x, top = centerPixel.y - size.height / 2 - offset.y
  const startX = Math.floor(left / WORLD), endX = Math.floor((left + size.width) / WORLD), startY = Math.floor(top / WORLD), endY = Math.floor((top + size.height) / WORLD)
  const tiles = []
  for (let ty = startY - 1; ty <= endY + 1; ty++) for (let tx = startX - 1; tx <= endX + 1; tx++) {
    const count = 2 ** zoom, wrappedX = ((tx % count) + count) % count
    if (ty >= 0 && ty < count) tiles.push({ key: `${zoom}/${tx}/${ty}`, url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`, x: tx * WORLD - left, y: ty * WORLD - top })
  }
  function mapPoint(lat: number, lon: number) { const point = project(lat, lon, zoom); return { x: point.x - left, y: point.y - top } }
  function onDown(e: PointerEvent<HTMLDivElement>) { drag.current = { x: e.clientX, y: e.clientY, px: left, py: top }; e.currentTarget.setPointerCapture(e.pointerId) }
  function onMove(e: PointerEvent<HTMLDivElement>) { if (drag.current) setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }) }
  function onUp(e: PointerEvent<HTMLDivElement>) { if (drag.current) { const next = unproject(drag.current.px + size.width / 2 + drag.current.x - e.clientX, drag.current.py + size.height / 2 + drag.current.y - e.clientY, zoom); setCenter({ latitude: next.latitude, longitude: next.longitude }); setOffset({ x: 0, y: 0 }); drag.current = null } }
  const locationMarkers = visible.flatMap((item) => { const point = demoPoint(item); if (point.latitude == null || point.longitude == null || (showGroups && incidentMembers.has(item.id))) return []; const pos = mapPoint(point.latitude, point.longitude); return [{ item, pos, fictional: point.fictional }] })
  const incidentMarkers = filteredIncidents.filter((item) => item.latitude != null && item.longitude != null).map((item) => ({ item, pos: mapPoint(item.latitude!, item.longitude!) }))
  const hotspotBuckets = new Map<string, typeof incidentMarkers>()
  for (const entry of incidentMarkers) { const key = `${Math.round(entry.item.latitude! / .006)}:${Math.round(entry.item.longitude! / .006)}`; hotspotBuckets.set(key, [...(hotspotBuckets.get(key) ?? []), entry]) }
  const hotspots = [...hotspotBuckets.values()].filter((bucket) => bucket.length > 1).map((bucket) => ({ items: bucket, x: bucket.reduce((sum, entry) => sum + entry.pos.x, 0) / bucket.length, y: bucket.reduce((sum, entry) => sum + entry.pos.y, 0) / bucket.length }))
  const densities = locationMarkers.map(({ item, pos }) => <i key={`heat-${item.id}`} className="heat-point" style={{ left: pos.x, top: pos.y }} />)
  return <div className="page-content cityvision-page">
    <PageHeader eyebrow="OPERATIONS · GEOSPATIAL" title="CityVision" description="Explore complaint locations, severity, and suggested incident clusters. Demo record coordinates are fictional." actions={<><DemoTag>MAP DATA · LOCAL API</DemoTag><button className="secondary-button" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button></>} />
    <div className="map-filter-bar panel"><label><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>All categories</option>{[...new Set(complaints.map((item) => item.ai_analysis?.predicted_category ?? item.category))].map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Severity</span><select value={severity} onChange={(e) => setSeverity(e.target.value)}>{['All severity', 'Critical', 'High', 'Medium', 'Low'].map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Department</span><select value={department} onChange={(e) => setDepartment(e.target.value)}><option>All departments</option>{departments.map((item) => <option key={item.id}>{item.name}</option>)}</select></label><button className={`secondary-button ${showHeat ? 'control-active' : ''}`} onClick={() => setShowHeat(!showHeat)}><Layers size={14} /> Density</button><button className={`secondary-button ${showGroups ? 'control-active' : ''}`} onClick={() => setShowGroups(!showGroups)}>Incident clusters</button></div>
    {error && <div className="api-alert"><AlertCircle size={16} />{error}<button onClick={() => void load()}>Retry</button></div>}
    <div className="cityvision-layout"><section className="panel city-map-panel"><div className="panel-header"><div><h2>Complaint and incident map</h2><p>{visible.length} reports · {filteredIncidents.length} grouped incidents</p></div><span className="demo-mini-tag">{loading ? 'LOADING' : 'LIVE API DATA'}</span></div>
      <div ref={box} className="slippy-map" style={{ height: HEIGHT }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="tile-layer">{tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" draggable={false} onError={() => setTileError(true)} style={{ left: tile.x, top: tile.y }} />)}</div>
        <div className="map-overlay" style={{ pointerEvents: 'none' }}>
          {showHeat && densities}
          {hotspots.map((spot) => <button key={`hotspot-${spot.items[0].item.id}`} className="hotspot-marker" style={{ left: spot.x, top: spot.y }} title={`${spot.items.length} nearby incident groups · proximity only, no causal link`} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setSelectedIncident(spot.items[0].item); setSelectedComplaint(null) }}>{spot.items.length} nearby</button>)}
          {locationMarkers.map(({ item, pos, fictional }) => <button key={item.id} className={`complaint-map-marker marker-${item.severity.toLowerCase()} ${fictional ? 'fictional' : ''} ${item.priority === 'Critical' || item.priority === 'High' ? 'priority-hot' : ''}`} style={{ left: pos.x, top: pos.y }} title={`${item.title}${fictional ? ' · Fictional demo coordinate' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setSelectedComplaint(item); setSelectedIncident(null) }}><MapPin size={16} fill="currentColor" /></button>)}
          {incidentMarkers.map(({ item, pos }) => <button key={item.id} className={`incident-map-marker marker-${item.severity.toLowerCase()} ${item.coordinates_are_fictional ? 'fictional' : ''}`} style={{ left: pos.x, top: pos.y }} title={`${item.title} · ${item.complaint_count} reports${item.coordinates_are_fictional ? ' · Fictional demo coordinate' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setSelectedIncident(item); setSelectedComplaint(null) }}>{item.complaint_count}</button>)}
        </div>
        <div className="map-zoom-controls" onPointerDown={(e) => e.stopPropagation()}><button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(17, z + 1))}><Plus size={15} /></button><button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(3, z - 1))}><Minus size={15} /></button><button aria-label="Recenter map" onClick={() => { setCenter({ latitude: 17.385, longitude: 78.4867 }); setZoom(11) }}>◎</button></div>
        <div className="map-key"><span><i className="key-dot complaint" /> Complaint</span><span><i className="key-dot incident" /> Incident group</span><span><i className="key-dot heat" /> Report density</span><span><i className="key-dot hotspot" /> Nearby groups</span><b>Demo coordinates are fictional</b></div>
        <div className="osm-credit">{tileError ? 'Map tiles unavailable · marker overlay still active' : '© OpenStreetMap contributors'}</div>
      </div>
    </section>
    <aside className="panel map-side-panel"><div className="panel-header"><div><h2>{selectedIncident ? 'Incident group' : selectedComplaint ? 'Complaint detail' : 'Map summary'}</h2><p>Click a map marker to inspect its report.</p></div>{(selectedIncident || selectedComplaint) && <button className="panel-icon-button" onClick={() => { setSelectedIncident(null); setSelectedComplaint(null) }} aria-label="Close details"><X size={15} /></button>}</div>
      {selectedIncident ? <div className="map-selected-detail"><DemoTag>{selectedIncident.review_status}</DemoTag><h3>{selectedIncident.title}</h3><p>{selectedIncident.id} · {selectedIncident.complaint_count} reports</p><PriorityBadge priority={selectedIncident.severity} /><p>{selectedIncident.dominant_category} · {selectedIncident.location}</p><small>Similarity {Math.round(selectedIncident.similarity_score * 100)}% · suggested grouping</small><button className="secondary-button" onClick={() => onNavigate('pulse')}>Review in CivicPulse</button></div> : selectedComplaint ? <div className="map-selected-detail"><span className="eyebrow">{selectedComplaint.id}{selectedComplaint.demo ? ' · SYNTHETIC REPORT' : ''}</span><h3>{selectedComplaint.title}</h3><p>{selectedComplaint.description}</p><PriorityBadge priority={selectedComplaint.severity} /><p>{selectedComplaint.category} · {selectedComplaint.location}</p><small>{selectedComplaint.department_name ?? 'Unassigned'} · {date(selectedComplaint.submitted_at)}</small>{selectedComplaint.demo && <small>Marker uses fictional demonstration coordinates.</small>}<button className="secondary-button" onClick={() => onNavigate('inbox')}>Open Complaint Inbox</button></div> : <div className="map-summary-stats"><div><b>{visible.length}</b><span>matching complaints</span></div><div><b>{incidentMarkers.length}</b><span>incident groups on map</span></div><div><b>{visible.filter((item) => item.severity === 'Critical').length}</b><span>critical reports</span></div><p><ShieldAlert size={14} /> Density is a visual count of reports, not a forecast or verified hotspot.</p></div>}{!selectedIncident && !selectedComplaint && visible.some((item) => item.latitude == null || item.longitude == null) && <section className="unmapped-reports"><b>Location-only reports</b><small>These reports have no coordinates; they are listed by citizen-provided place and are not plotted.</small>{visible.filter((item) => item.latitude == null || item.longitude == null).slice(0, 8).map((item) => <button key={item.id} onClick={() => setSelectedComplaint(item)}><span>{item.title}</span><small>{item.location}</small></button>)}</section>}
      <div className="map-legend-list"><b>Severity</b><span><i className="sev critical" /> Critical</span><span><i className="sev high" /> High</span><span><i className="sev medium" /> Medium</span><span><i className="sev low" /> Low</span><small>Department filter applies to complaint markers. Group markers use the incident's dominant category and highest severity.</small></div>
    </aside></div>
  </div>
}
