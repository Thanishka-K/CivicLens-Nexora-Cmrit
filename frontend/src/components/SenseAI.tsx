import { useEffect, useState } from 'react'
import { AlertCircle, BrainCircuit, LoaderCircle, Search, Sparkles } from 'lucide-react'
import { api, type AIAnalysis, type Complaint, type KnowledgeAnswer } from '../api/client'
import { DemoTag, PageHeader, PriorityBadge } from './ui'

export function SenseAI({ mode = 'sense' }: { mode?: 'sense' | 'impact' }) {
  const [items, setItems] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null)
  const [asking, setAsking] = useState(false)
  async function load() {
    setLoading(true); setError('')
    try { setItems((await api.getComplaints({ page_size: '100' })).items) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load reports.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  async function analyze(item: Complaint) {
    setBusy(item.id); setError('')
    try {
      const result: AIAnalysis = await api.analyzeComplaint(item.id)
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, ai_analysis: result, severity: result.severity, priority: result.priority_score >= 85 ? 'Critical' : result.priority_score >= 65 ? 'High' : result.priority_score >= 40 ? 'Medium' : 'Low', department_name: result.department_name } : row))
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed.') }
    finally { setBusy(null) }
  }
  async function ask(event: React.FormEvent) {
    event.preventDefault(); if (!question.trim()) return
    setAsking(true)
    try { setAnswer(await api.askKnowledge(question.trim())) }
    catch (e) { setError(e instanceof Error ? e.message : 'Knowledge lookup failed.') }
    finally { setAsking(false) }
  }
  return <div className="page-content module-page">
    <PageHeader eyebrow="INTELLIGENCE · LOCAL ENGINE" title={mode === 'impact' ? 'ImpactIQ' : 'SenseAI'} description={mode === 'impact' ? 'Review hazard severity and response priority with transparent safety rules.' : 'Explainable complaint triage and a local civic knowledge assistant.'} actions={<DemoTag>OFFLINE DEMO ENGINE</DemoTag>} />
    <section className="panel" style={{ padding: 20, marginBottom: 18 }}>
      <div className="panel-header"><div><h2><BrainCircuit size={17} /> Complaint analysis</h2><p>Deterministic category matching, safety rules, transparent priority, and retrieved guidance.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div>
      {error && <div className="api-alert" role="alert"><AlertCircle size={16} />{error}</div>}
      {loading ? <div className="empty-state">Loading reports…</div> : items.length === 0 ? <div className="empty-state">No reports available to analyze.</div> : <div className="capability-list">{items.map((item) => <article key={item.id} className="sense-record">
        <div className="sense-record-head"><div><b>{item.title}</b><small>{item.id} · {item.location} · {item.demo ? 'Demonstration record' : 'Citizen report'}</small></div><button className="secondary-button" disabled={busy === item.id} onClick={() => void analyze(item)}>{busy === item.id ? <><LoaderCircle size={14} className="spin" /> Analyzing…</> : <><Sparkles size={14} /> Analyze</>}</button></div>
        <p className="sense-original">{item.description}</p>
        {item.ai_analysis && <div className="sense-result"><div className="sense-result-line"><b>{item.ai_analysis.predicted_category}</b><PriorityBadge priority={item.ai_analysis.severity} /><span>Priority {item.ai_analysis.priority_score}/100</span><span>{Math.round(item.ai_analysis.confidence * 100)}% confidence</span></div><p>{item.ai_analysis.explanation}</p><small>Recommended: {item.ai_analysis.department_name ?? 'Officer review'} · {item.ai_analysis.urgency} · {item.ai_analysis.source}</small>{item.ai_analysis.knowledge_references?.length > 0 && <small>Retrieved: {item.ai_analysis.knowledge_references.map((ref) => ref.title).join(' · ')}</small>}</div>}
      </article>)}</div>}
    </section>
    {mode === 'sense' && <section className="panel" style={{ padding: 20 }}><div className="panel-header"><div><h2><Search size={17} /> Civic knowledge assistant</h2><p>Answers are retrieved from local demonstration guidance; no official SOPs or laws are represented.</p></div><DemoTag>GROUNDED RETRIEVAL</DemoTag></div>
      <form className="knowledge-form" onSubmit={(e) => void ask(e)}><input aria-label="Ask a civic knowledge question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about exposed wires, potholes, waste, leaks, or drainage…" minLength={4} required /><button className="primary-button" disabled={asking}>{asking ? 'Searching…' : 'Ask'}</button></form>
      {answer && <div className="sense-result knowledge-answer"><b>Demonstration guidance</b><p>{answer.answer}</p><div>{answer.references.map((ref) => <small key={ref.id}>Source: {ref.title} · {ref.id}</small>)}</div></div>}
    </section>}
  </div>
}
