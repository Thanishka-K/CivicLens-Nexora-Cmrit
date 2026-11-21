import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Check, CheckCircle2, Clock3, FileImage, LocateFixed, MapPin, Search, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react'
import { api, mediaUrl, type Complaint, type ComplaintHistory, type ComplaintInput } from '../api/client'
import { DemoTag, PageHeader } from './ui'

const categories = [
  { value: 'Roads and Infrastructure', hint: 'Road damage, potholes, or unsafe footpaths' },
  { value: 'Sanitation and Waste', hint: 'Missed collection or overflowing waste' },
  { value: 'Water Supply', hint: 'Leaks or interruptions to water service' },
  { value: 'Electricity', hint: 'Street lighting or exposed electrical hazards' },
  { value: 'Parks and Trees', hint: 'Fallen trees or public green spaces' },
  { value: 'Drainage and Sewerage', hint: 'Blocked drains or waterlogging' },
]
const languages = ['English', 'Kannada', 'Hindi', 'Telugu'] as const
const maxImageBytes = 5 * 1024 * 1024
const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const emptyForm: ComplaintInput = { title: '', description: '', category: categories[0].value, location: '', language: 'English', severity: 'Medium' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function CitizenConnect() {
  const [form, setForm] = useState<ComplaintInput>(emptyForm)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<Complaint | null>(null)
  const [trackingId, setTrackingId] = useState('')
  const [trackedComplaint, setTrackedComplaint] = useState<Complaint | null>(null)
  const [trackingHistory, setTrackingHistory] = useState<ComplaintHistory[]>([])
  const [trackingError, setTrackingError] = useState('')
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const requestLock = useRef(false)

  useEffect(() => {
    if (!image) { setPreview(''); return }
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  function updateField<K extends keyof ComplaintInput>(field: K, value: ComplaintInput[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldError('')
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!supportedImageTypes.includes(file.type)) {
      setFieldError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > maxImageBytes) {
      setFieldError('Images must be 5 MB or smaller.')
      return
    }
    setFieldError('')
    setImage(file)
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Location lookup is unavailable in this browser. You can enter the location manually.')
      return
    }
    setLocationMessage('Waiting for location permission…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateField('latitude', Number(coords.latitude.toFixed(6)))
        updateField('longitude', Number(coords.longitude.toFixed(6)))
        setLocationMessage('Coordinates added. Location access was used only for this report.')
      },
      (error) => setLocationMessage(error.code === error.PERMISSION_DENIED ? 'Location access was declined. Enter a place or landmark to continue.' : 'Could not get a location fix. Enter a place or landmark to continue.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestLock.current || submitting) return
    const title = form.title.trim()
    const description = form.description.trim()
    const location = form.location.trim()
    if (title.length < 4 || description.length < 12 || location.length < 2) {
      setFieldError('Add a clear title, at least 12 characters of detail, and a location or landmark.')
      return
    }
    requestLock.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const saved = await api.submitCitizenComplaint({ ...form, title, description, location }, image)
      setReceipt(saved)
      setTrackedComplaint(null)
      setTrackingId(saved.id)
      setForm(emptyForm)
      setImage(null)
      setLocationMessage('')
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : 'The complaint could not be saved. Please try again.')
    } finally {
      requestLock.current = false
      setSubmitting(false)
    }
  }

  async function trackComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = trackingId.trim().toUpperCase()
    if (!id) { setTrackingError('Enter the ticket ID from your submission receipt.'); return }
    setTrackingLoading(true)
    setTrackingError('')
    setTrackedComplaint(null)
    try {
      const [complaint, history] = await Promise.all([api.getComplaint(id), api.getComplaintHistory(id)])
      setTrackedComplaint(complaint)
      setTrackingHistory(history)
    } catch (reason) {
      setTrackingError(reason instanceof Error && 'status' in reason && (reason as { status?: number }).status === 404
        ? 'We could not find that ticket. Check the ID from your receipt and try again.'
        : reason instanceof Error ? reason.message : 'Could not load this ticket.')
    } finally { setTrackingLoading(false) }
  }

  return <div className="page-content citizen-page">
    <PageHeader eyebrow="PUBLIC SERVICE · CITIZEN CONNECT" title="Report a civic issue" description="Tell us what needs attention. Your report goes to the team responsible for that service." actions={<DemoTag>LOCAL PROTOTYPE</DemoTag>} />
    <div className="citizen-layout">
      <section className="panel citizen-form-panel">
        {receipt ? <motion.div className="submission-receipt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <button className="receipt-close panel-icon-button" onClick={() => setReceipt(null)} aria-label="Start another complaint"><X size={15} /></button>
          <span className="receipt-check"><CheckCircle2 size={29} /></span><div className="eyebrow">REPORT RECEIVED</div><h2>Thank you for speaking up.</h2><p>Your report has been saved and routed to the responsible department.</p>
          <div className="ticket-card"><div><small>TICKET ID</small><strong>{receipt.id}</strong></div><span className="submitted-status"><i />Submitted</span></div>
          <div className="receipt-details"><span><b>{receipt.title}</b><small>{receipt.category}</small></span><span><b>{receipt.department_name ?? 'Routing pending'}</b><small>{receipt.location}</small></span></div>
          <button className="primary-button receipt-track" onClick={() => { setTrackedComplaint(null); setTrackingId(receipt.id); document.getElementById('tracking-id')?.focus() }}>Track this report <ArrowRight size={15} /></button>
          <button className="receipt-new" onClick={() => setReceipt(null)}>Submit another report</button>
        </motion.div> : <form className="citizen-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="citizen-form-heading"><div><div className="eyebrow">NEW COMPLAINT</div><h2>What’s happening?</h2><p>Fields marked with <span aria-hidden="true">*</span> are required.</p></div><span className="step-indicator">01 <i>/</i> 01</span></div>
          {(fieldError || submitError) && <div className="citizen-form-error" role="alert"><AlertCircle size={15} /><span>{fieldError || submitError}</span><button type="button" aria-label="Dismiss message" onClick={() => { setFieldError(''); setSubmitError('') }}><X size={14} /></button></div>}
          <label className="citizen-field"><span>Short title <b>*</b></span><input required minLength={4} maxLength={180} value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="e.g. Water pooling outside the library" autoComplete="off" /><small>A short, specific title helps the right team understand your report.</small></label>
          <label className="citizen-field"><span>Describe the issue <b>*</b></span><textarea required minLength={12} maxLength={4000} rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="What happened? When did you notice it? Is anyone at immediate risk?" /><small>{form.description.length}/4000 characters · Write in {form.language} or another language you’re comfortable with.</small></label>
          <fieldset className="citizen-fieldset"><legend>Issue category <b>*</b></legend><div className="category-choice-grid">{categories.map((item, index) => <label className={`category-choice ${form.category === item.value ? 'category-choice--selected' : ''}`} key={item.value}><input required type="radio" name="category" value={item.value} checked={form.category === item.value} onChange={() => updateField('category', item.value)} /><span className="category-choice-index">0{index + 1}</span><span><b>{item.value}</b><small>{item.hint}</small></span>{form.category === item.value && <Check size={14} />}</label>)}</div></fieldset>
          <div className="citizen-form-row">
            <label className="citizen-field"><span>Location or landmark <b>*</b></span><span className="input-with-icon"><MapPin size={15} /><input required minLength={2} maxLength={240} value={form.location} onChange={(event) => updateField('location', event.target.value)} placeholder="Ward, street, or nearby landmark" autoComplete="street-address" /></span><small>A nearby landmark is enough; don’t include your home address.</small></label>
            <label className="citizen-field"><span>Language</span><select value={form.language} onChange={(event) => updateField('language', event.target.value as ComplaintInput['language'])}>{languages.map((language) => <option key={language}>{language}</option>)}</select><small>Choose the language used in your description.</small></label>
          </div>
          <div className="location-actions"><button className="location-button" type="button" onClick={useCurrentLocation}><LocateFixed size={15} /> Use current location</button>{locationMessage && <span role="status">{locationMessage}</span>}</div>
          {(form.latitude != null || form.longitude != null) && <div className="coordinate-fields"><div><small>LATITUDE</small><b>{form.latitude?.toFixed(6) ?? '—'}</b></div><div><small>LONGITUDE</small><b>{form.longitude?.toFixed(6) ?? '—'}</b></div><button type="button" className="clear-coordinates" onClick={() => { updateField('latitude', null); updateField('longitude', null); setLocationMessage('Coordinates removed. Manual location is still available.') }}>Remove coordinates</button></div>}
          <div className="citizen-field"><span>Photo evidence <small>Optional</small></span><input ref={fileInput} className="visually-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} aria-label="Choose a complaint photo" />
            {preview ? <div className="image-preview-card"><img src={preview} alt={`Preview of ${image?.name ?? 'selected evidence'}`} /><div className="image-preview-meta"><FileImage size={15} /><span><b>{image?.name}</b><small>{image ? `${(image.size / (1024 * 1024)).toFixed(2)} MB · Private demo storage` : ''}</small></span><button type="button" onClick={() => setImage(null)} aria-label="Remove uploaded photo"><Trash2 size={15} /></button></div></div> : <button className="upload-dropzone" type="button" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (!file) return; if (!supportedImageTypes.includes(file.type)) { setFieldError('Choose a JPEG, PNG, or WebP image.'); return }; if (file.size > maxImageBytes) { setFieldError('Images must be 5 MB or smaller.'); return }; setFieldError(''); setImage(file) }}><span className="upload-icon"><UploadCloud size={19} /></span><b>Choose a photo or drag it here</b><small>JPEG, PNG or WebP · up to 5 MB</small></button>}
          </div>
          <div className="citizen-submit-row"><span><ShieldCheck size={15} /> Your report is stored securely for this prototype.</span><button className="primary-button citizen-submit" type="submit" disabled={submitting}>{submitting ? <><span className="button-spinner" /> Sending report…</> : <>Submit complaint <ArrowRight size={15} /></>}</button></div>
        </form>}
      </section>

      <aside className="citizen-side-column">
        <section className="citizen-side-card trust-card"><span className="side-card-icon"><ShieldCheck size={18} /></span><div><b>Your information stays private</b><p>This demo asks for no name, phone number, or account. Your ticket ID lets you look up this report.</p></div><small>PHASE 04 · LOCAL PROTOTYPE</small></section>
        <section className="panel track-panel" id="tracking-panel"><div className="panel-header"><div><div className="eyebrow">CITIZEN TRACKING</div><h2>Check a report</h2><p>Use the ticket ID from your receipt.</p></div><span className="track-panel-icon"><Search size={16} /></span></div>
          <form className="tracking-form" onSubmit={(event) => void trackComplaint(event)}><label htmlFor="tracking-id">Ticket ID</label><div className="track-input-row"><input id="tracking-id" value={trackingId} onChange={(event) => setTrackingId(event.target.value)} placeholder="e.g. CL-A1B2C3D4" autoCapitalize="characters" autoComplete="off" /><button type="submit" aria-label="Find ticket" disabled={trackingLoading}>{trackingLoading ? <span className="small-spinner" /> : <ArrowRight size={15} />}</button></div><small>Only someone with this unique ticket ID can view the report.</small></form>
          {trackingError && <div className="track-error" role="alert"><AlertCircle size={14} />{trackingError}</div>}
          {trackedComplaint && <motion.div className="tracked-card" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}><div className="tracked-card-head"><span><b>{trackedComplaint.id}</b><small>{trackedComplaint.title}</small></span><span className={`track-status track-status--${trackedComplaint.status.toLowerCase().replaceAll(' ', '-')}`}><i />{trackedComplaint.status}</span></div><div className="tracked-facts"><span><small>SUBMITTED</small><b>{formatDate(trackedComplaint.submitted_at)}</b></span><span><small>DEPARTMENT</small><b>{trackedComplaint.department_name ?? 'Being routed'}</b></span><span><small>LOCATION</small><b>{trackedComplaint.location}</b></span><span><small>LANGUAGE</small><b>{trackedComplaint.language}</b></span></div>{trackedComplaint.image_reference && <a className="tracked-photo" href={mediaUrl(trackedComplaint.image_reference)} target="_blank" rel="noreferrer"><FileImage size={14} /> View attached photo <ArrowRight size={13} /></a>}<div className="tracked-history-title"><Clock3 size={14} /> Status history</div><div className="tracked-history">{trackingHistory.map((entry) => <div key={entry.id}><span className="history-dot" /><b>{entry.new_status}</b><small>{formatDate(entry.changed_at)} · {entry.changed_by}</small></div>)}</div></motion.div>}
        </section>
        <section className="citizen-side-card process-card"><div className="eyebrow">WHAT HAPPENS NEXT</div><div className="process-step"><span>1</span><div><b>We route your report</b><small>It goes to the service department responsible.</small></div></div><div className="process-step"><span>2</span><div><b>A team reviews it</b><small>Staff can update status as work progresses.</small></div></div><div className="process-step"><span>3</span><div><b>Follow with your ticket</b><small>Use your ticket ID anytime to check updates.</small></div></div></section>
      </aside>
    </div>
  </div>
}
