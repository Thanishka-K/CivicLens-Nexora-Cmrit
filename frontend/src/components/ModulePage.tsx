import { ArrowUpRight, Check, Clock3, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import type { PageId } from '../app/navigation'
import { pageCopy } from '../app/navigation'
import { DemoTag, PageHeader } from './ui'

export function ModulePage({ page }: { page: Exclude<PageId, 'command'> }) {
  const content = pageCopy[page]
  const Icon = content.icon
  return <motion.div className="page-content module-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
    <PageHeader eyebrow={content.eyebrow} title={content.title} description={content.description} actions={<DemoTag>PHASE 02 FOUNDATION</DemoTag>} />
    <section className="module-hero panel"><div className="module-hero-art"><div className="module-orbit orbit-one" /><div className="module-orbit orbit-two" /><div className="module-orbit orbit-three" /><div className="module-core"><Icon size={28} /></div><span className="orbit-node node-a"><Sparkles size={14} /></span><span className="orbit-node node-b"><Check size={14} /></span><span className="orbit-node node-c"><Clock3 size={14} /></span></div><div className="module-hero-copy"><div className="eyebrow">PRODUCT MODULE</div><h2>{content.title}</h2><p>{content.description} This screen establishes the visual foundation for the module; connected workflows will be added in a later phase.</p><span className="coming-soon"><i /> Interface foundation ready <span>·</span> Backend not connected</span></div></section>
    <div className="module-lower"><section className="panel module-capabilities"><div className="panel-header"><div><h2>Designed for the workflow</h2><p>Core capabilities planned for this module</p></div></div><div className="capability-list">{content.bullets.map((bullet, index) => <div className="capability-row" key={bullet}><span className="capability-index">0{index + 1}</span><span>{bullet}</span><ArrowUpRight size={15} /></div>)}</div></section><section className="module-note"><div className="module-note-icon"><Sparkles size={17} /></div><div><b>Building CivicLens step by step</b><p>This is a deliberate Phase 02 page foundation. It shows the intended purpose without implying that AI models, APIs, or live city data are already connected.</p><span>Next: shared data contracts and workflow implementation</span></div></section></div>
  </motion.div>
}
