import { useState } from 'react'
import { Crosshair, Layers, MapPin, Plus, Minus } from 'lucide-react'
import type { PageId } from '../app/navigation'
import { Panel } from './ui'

const pins = [
  { x: 23, y: 42, type: 'teal' }, { x: 32, y: 70, type: 'amber' }, { x: 44, y: 32, type: 'blue' },
  { x: 52, y: 57, type: 'teal' }, { x: 61, y: 40, type: 'amber' }, { x: 68, y: 72, type: 'teal' },
  { x: 76, y: 29, type: 'blue' }, { x: 84, y: 51, type: 'teal' }, { x: 41, y: 78, type: 'blue' },
]

export function CityMap({ onNavigate, complaintCount = 1284, criticalCount = 12 }: { onNavigate: (page: PageId) => void; complaintCount?: number; criticalCount?: number }) {
  const [zoom, setZoom] = useState(1)
  const [showReports, setShowReports] = useState(true)
  return <Panel title="City overview" subtitle="Incident distribution across Metro City" action={<button className={`panel-icon-button ${showReports ? '' : 'control-active'}`} aria-label={showReports ? 'Hide map report markers' : 'Show map report markers'} onClick={() => setShowReports(!showReports)}><Layers size={15} /></button>} className="map-panel">
    <div className="map-canvas" role="img" aria-label="Illustrative map of Metro City with complaint markers">
      <div className="map-grid" /><svg className="map-streets" viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true"><path d="M-30 196 C90 170 84 92 216 100 S356 205 630 48" /><path d="M28 300 C126 232 170 204 199 0" /><path d="M160 300 C262 211 285 162 297 -10" /><path d="M414 300 C354 209 398 124 500 -10" /><path d="M-10 62 C174 86 358 44 610 122" /><path d="M-10 249 C192 204 392 267 620 191" /><path d="M70 -20 C118 86 438 157 563 310" /></svg>
      <div className="map-features" style={{ transform: `scale(${zoom})` }}><div className="map-park park-one" /><div className="map-park park-two" /><div className="map-river" />
      <div className="map-neighborhood n1">NORTH WARD</div><div className="map-neighborhood n2">CENTRAL WARD</div><div className="map-neighborhood n3">EAST WARD</div><div className="map-neighborhood n4">SOUTH WARD</div>
      {showReports && pins.map((pin, index) => <span key={index} className={`map-pin pin-${pin.type}`} style={{ left: `${pin.x}%`, top: `${pin.y}%` }}><MapPin size={13} fill="currentColor" /></span>)}</div>
      <div className="map-controls"><button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}><Plus size={14} /></button><button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}><Minus size={14} /></button><button aria-label="Recenter map" onClick={() => setZoom(1)}><Crosshair size={14} /></button></div>
      <div className="map-attribution">Illustrative demo map · not to scale</div>
    </div>
    <div className="map-footer"><span><i className="legend-dot received" />Complaint reports <b>{complaintCount.toLocaleString()}</b></span><span><i className="legend-dot critical" />Critical <b>{criticalCount}</b></span><button className="text-link" onClick={() => onNavigate('city')}>Explore map <span>↗</span></button></div>
  </Panel>
}
