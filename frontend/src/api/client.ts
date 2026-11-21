export type Severity = 'Low' | 'Medium' | 'High' | 'Critical'
export type ComplaintStatus = 'Submitted' | 'New' | 'In Progress' | 'On Hold' | 'Resolved'

export interface Department {
  id: string
  name: string
  responsible_categories: string[]
  demo: boolean
  complaint_count: number
  open_count: number
}

export interface Complaint {
  id: string
  title: string
  description: string
  language: 'English' | 'Kannada' | 'Hindi' | 'Telugu' | string
  category: string
  location: string
  latitude: number | null
  longitude: number | null
  image_reference: string | null
  severity: Severity
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  status: ComplaintStatus
  department_id: string | null
  department_name: string | null
  submitted_at: string
  demo: boolean
  ai_analysis?: AIAnalysis | null
}
export interface AIAnalysis { complaint_id: string; predicted_category: string; severity: Severity; priority_score: number; explanation: string; confidence: number; department_name: string | null; urgency: string; knowledge_references: { id: string; title: string; excerpt: string; score: number }[]; analysis_at: string; source: string; model_version: string }
export interface KnowledgeAnswer { answer: string; references: AIAnalysis['knowledge_references']; demo_guidance: boolean }
export interface Incident { id: string; title: string; complaint_ids: string[]; complaint_count: number; location: string; dominant_category: string; severity: Severity; status: string; review_status: 'Suggested' | 'Confirmed' | 'Rejected'; first_reported_at: string; latest_reported_at: string; demo: boolean; similarity_score: number; possible_relationships: string[]; departments: string[]; latitude: number | null; longitude: number | null; coordinates_are_fictional: boolean }
export interface IncidentDetail extends Incident { complaints: Complaint[]; timeline: { complaint_id: string; title: string; reported_at: string; status: string }[] }
export interface DuplicateDetection { incidents_created: number; incident_count: number; incidents: Incident[]; possible_relationships: { complaint_ids: string[]; label: string; reasons: string[] }[]; complaints_preserved: number; message: string }
export interface Health { status: string; service: string; database: string }

export interface ComplaintList {
  items: Complaint[]
  total: number
  page: number
  page_size: number
}
export interface ComplaintHistory { id: number; complaint_id: string; previous_status: string; new_status: string; changed_at: string; changed_by: string }

export interface TrendPoint { day: string; received: number; resolved: number }
export interface DashboardStats {
  total_complaints: number
  unresolved_complaints: number
  critical_incidents: number
  resolved_this_week: number
  average_resolution_days: number | null
  complaints_by_category: { category: string; count: number; percent: number }[]
  trend_7_days: TrendPoint[]
  trend_30_days: TrendPoint[]
  demo: boolean
}

export interface ComplaintInput {
  title: string
  description: string
  category: string
  location: string
  language: 'English' | 'Kannada' | 'Hindi' | 'Telugu'
  latitude?: number | null
  longitude?: number | null
  image_reference?: string | null
  severity: Severity
  department_id?: string | null
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '')

export function mediaUrl(reference: string): string {
  return /^https?:\/\//i.test(reference) ? reference : `${API_BASE_URL}${reference.startsWith('/') ? reference : `/${reference}`}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: init?.body instanceof FormData
        ? { ...init?.headers }
        : { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('CivicLens API is unavailable. Start the backend and try again.', 0)
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json() as { detail?: unknown }
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) message = body.detail.map((item) => typeof item === 'object' && item && 'msg' in item ? String(item.msg) : String(item)).join('. ')
    } catch { /* The response may not contain JSON. */ }
    throw new ApiError(message, response.status)
  }
  return response.json() as Promise<T>
}

function queryString(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const api = {
  getHealth: () => request<Health>('/health'),
  getDashboardStats: () => request<DashboardStats>('/api/dashboard/stats'),
  getDepartments: () => request<Department[]>('/api/departments'),
  getComplaints: (filters: { category?: string; severity?: string; status?: string; department?: string; page_size?: string } = {}) => request<ComplaintList>(`/api/complaints${queryString({ page_size: filters.page_size ?? '100', ...filters })}`),
  getComplaint: (id: string) => request<Complaint>(`/api/complaints/${encodeURIComponent(id)}`),
  getComplaintHistory: (id: string) => request<ComplaintHistory[]>(`/api/complaints/${encodeURIComponent(id)}/history`),
  createComplaint: (input: ComplaintInput) => request<Complaint>('/api/complaints', { method: 'POST', body: JSON.stringify(input) }),
  submitCitizenComplaint: (input: ComplaintInput, image: File | null) => {
    const body = new FormData()
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== null && value !== '') body.append(key, String(value))
    }
    if (image) body.append('image', image)
    return request<Complaint>('/api/complaints/intake', { method: 'POST', body, headers: {} })
  },
  updateComplaint: (id: string, input: Partial<Pick<Complaint, 'status' | 'severity' | 'priority' | 'category' | 'department_id'>>) => request<Complaint>(`/api/complaints/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  analyzeComplaint: (id: string) => request<AIAnalysis>(`/api/ai/analyze/${encodeURIComponent(id)}`, { method: 'POST' }),
  getAnalysis: (id: string) => request<AIAnalysis>(`/api/ai/analysis/${encodeURIComponent(id)}`),
  askKnowledge: (question: string) => request<KnowledgeAnswer>('/api/ai/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  getIncidents: () => request<Incident[]>('/api/incidents'),
  getIncident: (id: string) => request<IncidentDetail>(`/api/incidents/${encodeURIComponent(id)}`),
  getIncidentComplaints: (id: string) => request<Complaint[]>(`/api/incidents/${encodeURIComponent(id)}/complaints`),
  detectDuplicates: () => request<DuplicateDetection>('/api/incidents/detect-duplicates', { method: 'POST' }),
  decideIncident: (id: string, confirmed: boolean) => request<Incident>(`/api/incidents/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: JSON.stringify({ confirmed }) }),
}
