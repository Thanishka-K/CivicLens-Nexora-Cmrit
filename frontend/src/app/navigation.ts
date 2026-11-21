import {
  Activity, BarChart3, BrainCircuit, Building2, ChevronDown, CircleHelp,
  ClipboardList, Cpu, Gauge, GitBranch, Map, Radio, Settings, ShieldCheck,
  Sparkles, UsersRound, type LucideIcon,
} from 'lucide-react'

export type PageId =
  | 'command' | 'citizen' | 'inbox' | 'sense' | 'pulse' | 'impact' | 'city'
  | 'response' | 'tracker' | 'memory' | 'sim' | 'analytics' | 'settings'

export type NavItem = { id: PageId; label: string; icon: LucideIcon; group: string }

export const navItems: NavItem[] = [
  { id: 'command', label: 'Command Centre', icon: Gauge, group: 'Overview' },
  { id: 'citizen', label: 'Citizen Connect', icon: UsersRound, group: 'Overview' },
  { id: 'inbox', label: 'Complaint Inbox', icon: ClipboardList, group: 'Overview' },
  { id: 'sense', label: 'SenseAI', icon: BrainCircuit, group: 'Intelligence' },
  { id: 'pulse', label: 'CivicPulse', icon: Radio, group: 'Intelligence' },
  { id: 'impact', label: 'ImpactIQ', icon: Activity, group: 'Intelligence' },
  { id: 'city', label: 'CityVision', icon: Map, group: 'Operations' },
  { id: 'response', label: 'ResponseAI', icon: Sparkles, group: 'Operations' },
  { id: 'tracker', label: 'ActionTracker', icon: GitBranch, group: 'Operations' },
  { id: 'memory', label: 'CivicMemory', icon: Building2, group: 'Insights' },
  { id: 'sim', label: 'CivicSim', icon: Cpu, group: 'Insights' },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3, group: 'Insights' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'Workspace' },
]

export const pageCopy: Record<Exclude<PageId, 'command'>, { eyebrow: string; title: string; description: string; icon: LucideIcon; bullets: string[] }> = {
  citizen: { eyebrow: 'PUBLIC SERVICE', title: 'Citizen Connect', description: 'A clear, accessible entry point for residents to report an issue and follow progress.', icon: UsersRound, bullets: ['Guided complaint submission', 'Status tracking and updates', 'Feedback and community corroboration'] },
  inbox: { eyebrow: 'OPERATIONS', title: 'Complaint Inbox', description: 'Review incoming reports, confirm details and move work to the right team.', icon: ClipboardList, bullets: ['Triage by urgency and department', 'Review original citizen evidence', 'Assign and track next actions'] },
  sense: { eyebrow: 'INTELLIGENCE', title: 'SenseAI', description: 'Structure complaint details while keeping the citizen’s original report intact.', icon: BrainCircuit, bullets: ['Language and intent suggestions', 'Key detail extraction', 'Human review for uncertain results'] },
  pulse: { eyebrow: 'INTELLIGENCE', title: 'CivicPulse', description: 'Surface reports that may describe a connected incident for staff review.', icon: Radio, bullets: ['Similar complaint candidates', 'Time and distance context', 'Reviewable incident groupings'] },
  impact: { eyebrow: 'INTELLIGENCE', title: 'ImpactIQ', description: 'Explain why an issue may need attention, with visible factors and clear uncertainty.', icon: Activity, bullets: ['Transparent priority factors', 'Safety rule escalation', 'Officer override and audit history'] },
  city: { eyebrow: 'OPERATIONS', title: 'CityVision', description: 'Explore a spatial view of reports and emerging service hotspots.', icon: Map, bullets: ['Geographic complaint patterns', 'Department and time filters', 'Jurisdiction context'] },
  response: { eyebrow: 'OPERATIONS', title: 'ResponseAI', description: 'Give officers grounded next-step suggestions based on approved municipal guidance.', icon: Sparkles, bullets: ['Department routing suggestions', 'Cited knowledge sources', 'Officer-approved action plans'] },
  tracker: { eyebrow: 'OPERATIONS', title: 'ActionTracker', description: 'Coordinate assignments, status changes and service-level milestones.', icon: GitBranch, bullets: ['Work order ownership', 'Status and SLA history', 'Resolution verification'] },
  memory: { eyebrow: 'INSIGHTS', title: 'CivicMemory', description: 'Understand recurring service needs through historical, evidence-backed patterns.', icon: Building2, bullets: ['Repeat issue summaries', 'Location and time trends', 'Descriptive insights with provenance'] },
  sim: { eyebrow: 'PLANNING', title: 'CivicSim', description: 'Explore hypothetical response plans against clearly stated assumptions.', icon: Cpu, bullets: ['Scenario inputs and constraints', 'Resource allocation comparisons', 'Outputs marked as simulations'] },
  analytics: { eyebrow: 'INSIGHTS', title: 'Analytics & Reports', description: 'Monitor service performance and operational trends with privacy-safe aggregates.', icon: BarChart3, bullets: ['Resolution and SLA trends', 'Department workload', 'Exportable operational summaries'] },
  settings: { eyebrow: 'WORKSPACE', title: 'Settings', description: 'Manage workspace preferences, roles and approved knowledge sources.', icon: Settings, bullets: ['Profile and display preferences', 'Role and access configuration', 'Knowledge source administration'] },
}

export const helperIcon = ShieldCheck
export const collapseIcon = ChevronDown
export const helpIcon = CircleHelp
