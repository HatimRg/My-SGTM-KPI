import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import { hseEventService } from '../../services/api'
import toast from 'react-hot-toast'

const ACCIDENT_CATEGORIES = [
  { value: 'near_miss' },
  { value: 'work_accident' },
  { value: 'incident' },
  { value: 'road_accident' },
]

const SHIFT_OPTIONS = [
  { value: 'day' },
  { value: 'night' },
]

const AGE_RANGES = [
  { value: '<25' },
  { value: '25-35' },
  { value: '36-45' },
  { value: '46-55' },
  { value: '>55' },
]

const EXPERIENCE_RANGES = [
  { value: '<6_months' },
  { value: '6-12_months' },
  { value: '1-5_years' },
  { value: '>5_years' },
]

const OUTCOMES = [
  { value: 'no_injury' },
  { value: 'first_aid_only' },
  { value: 'medical_treatment_no_lost_time' },
  { value: 'lost_time_accident' },
  { value: 'serious_hospitalization' },
  { value: 'fatal' },
]

const BODY_PARTS = [
  { value: 'head_neck' },
  { value: 'upper_limb' },
  { value: 'lower_limb' },
  { value: 'trunk' },
  { value: 'multiple' },
]

const INJURY_TYPES = [
  { value: 'sprain' },
  { value: 'cut_wound' },
  { value: 'contusion' },
  { value: 'fracture' },
  { value: 'burn' },
  { value: 'other' },
]

const ACTIVITIES = [
  { value: 'walking_circulation' },
  { value: 'manual_handling' },
  { value: 'mechanical_handling' },
  { value: 'machine_tool_use' },
  { value: 'vehicle_mobile_equipment' },
  { value: 'work_at_height' },
  { value: 'electrical_work' },
  { value: 'other' },
]

const GROUND_CONDITIONS = [
  { value: 'dry' },
  { value: 'wet' },
  { value: 'slippery' },
  { value: 'uneven' },
]

const LIGHTING_OPTIONS = [
  { value: 'adequate' },
  { value: 'insufficient' },
  { value: 'night_work' },
]

const WEATHER_OPTIONS = [
  { value: 'clear' },
  { value: 'rain' },
  { value: 'wind' },
  { value: 'heat' },
]

const WORK_AREA_OPTIONS = [
  { value: 'pedestrian_zone' },
  { value: 'shared_with_vehicles' },
  { value: 'restricted_confined' },
]

const PPE_OPTIONS = [
  { value: 'safety_shoes' },
  { value: 'helmet' },
  { value: 'gloves' },
  { value: 'hi_vis_vest' },
  { value: 'eye_protection' },
  { value: 'other' },
]

const COLLECTIVE_PROTECTIONS = [
  { value: 'present' },
  { value: 'absent' },
  { value: 'not_applicable' },
]

const IMMEDIATE_CAUSES = [
  { value: 'slip_trip_fall' },
  { value: 'loss_of_balance' },
  { value: 'contact_with_object' },
  { value: 'unsafe_movement' },
  { value: 'vehicle_interaction' },
  { value: 'other' },
]

const ROOT_CAUSE_CATEGORIES = [
  { value: 'human_factor' },
  { value: 'method_procedure' },
  { value: 'equipment_tools' },
  { value: 'environment_conditions' },
  { value: 'organization_planning' },
]

const METHOD_CONFORMITY = [
  { value: 'conforming' },
  { value: 'non_conforming' },
  { value: 'not_defined' },
]

const IMMEDIATE_ACTIONS = [
  { value: 'first_aid_provided' },
  { value: 'evacuation_to_infirmary' },
  { value: 'external_medical_care' },
  { value: 'area_secured' },
  { value: 'work_stopped' },
  { value: 'authorities_notified' },
  { value: 'crisis_committee_activated' },
]

const PREVENTIVE_ACTION_TYPES = [
  { value: 'technical' },
  { value: 'organizational' },
  { value: 'training' },
  { value: 'inspection' },
]

const ACTION_STATUSES = [
  { value: 'open' },
  { value: 'in_progress' },
  { value: 'closed' },
]

const makeVictim = () => ({
  full_name: '',
  matricule: '',
  company: 'sgtm',
  subcontractor_name: '',
  job_title: '',
  age_range: '',
  experience_range: '',
  outcome: '',
  body_part: '',
  injury_type: '',
  injury_type_other: '',
  death_timing: '',
  death_date: '',
  death_place: '',
})

const outcomeRank = (outcome) => {
  switch (outcome) {
    case 'fatal':
      return 6
    case 'serious_hospitalization':
      return 5
    case 'lost_time_accident':
      return 4
    case 'medical_treatment_no_lost_time':
      return 3
    case 'first_aid_only':
      return 2
    case 'no_injury':
      return 1
    default:
      return 0
  }
}

const computeSeverityFromVictims = (victims) => {
  const best = (victims || []).reduce((acc, v) => Math.max(acc, outcomeRank(v?.outcome)), 0)
  if (best >= 6) return 'fatal'
  if (best >= 5) return 'critical'
  if (best >= 4) return 'major'
  if (best >= 3) return 'moderate'
  if (best >= 2) return 'minor'
  return ''
}

const computeLostTime = (victims) => {
  return (victims || []).some((v) => ['lost_time_accident', 'serious_hospitalization', 'fatal'].includes(v?.outcome))
}

export default function AccidentIncidentModal({
  isOpen,
  onClose,
  onSubmit,
  projects,
  selectedProjectId,
  t,
  initial,
}) {
  const [saving, setSaving] = useState(false)
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [pendingFiles, setPendingFiles] = useState([])

  const tf = (key, fallback, params) => {
    try {
      return t?.(key, params) ?? fallback
    } catch {
      return fallback
    }
  }

  const [form, setForm] = useState(() => ({
    project_id: selectedProjectId || '',
    category: 'work_accident',
    location: '',
    event_date: new Date().toISOString().split('T')[0],
    event_time: '',
    shift: 'day',
    victims_count: 1,
    victims: [makeVictim()],
    activity: '',
    activity_other: '',
    ground_condition: '',
    lighting: '',
    weather: '',
    work_area: '',
    ppe_worn: [],
    ppe_other: '',
    collective_protections: 'not_applicable',
    immediate_cause: '',
    immediate_cause_other: '',
    root_causes: [],
    method_conformity: '',
    immediate_actions: [],
    corrective_actions: [],
    investigation_completed: false,
    accident_closed: false,
    closure_date: '',
    closed_by_role: '',
    description: '',
    lost_days: 0,
  }))

  useEffect(() => {
    if (!isOpen) return

    if (initial) {
      const merged = {
        ...form,
        project_id: String(initial.project_id ?? form.project_id ?? ''),
        location: initial.location ?? '',
        event_date: initial.event_date?.substring(0, 10) ?? form.event_date,
        description: initial.description ?? '',
        lost_days: initial.lost_days ?? 0,
      }

      const details = initial.details ?? null
      if (details && typeof details === 'object') {
        Object.assign(merged, {
          category: details.category ?? merged.category,
          event_time: details.event_time ?? merged.event_time,
          shift: details.shift ?? merged.shift,
          victims_count: details.victims_count ?? merged.victims_count,
          victims: Array.isArray(details.victims) && details.victims.length > 0 ? details.victims : merged.victims,
          activity: details.activity ?? merged.activity,
          activity_other: details.activity_other ?? merged.activity_other,
          ground_condition: details.ground_condition ?? merged.ground_condition,
          lighting: details.lighting ?? merged.lighting,
          weather: details.weather ?? merged.weather,
          work_area: details.work_area ?? merged.work_area,
          ppe_worn: Array.isArray(details.ppe_worn) ? details.ppe_worn : merged.ppe_worn,
          ppe_other: details.ppe_other ?? merged.ppe_other,
          collective_protections: details.collective_protections ?? merged.collective_protections,
          immediate_cause: details.immediate_cause ?? merged.immediate_cause,
          immediate_cause_other: details.immediate_cause_other ?? merged.immediate_cause_other,
          root_causes: Array.isArray(details.root_causes) ? details.root_causes : merged.root_causes,
          method_conformity: details.method_conformity ?? merged.method_conformity,
          immediate_actions: Array.isArray(details.immediate_actions) ? details.immediate_actions : merged.immediate_actions,
          corrective_actions: Array.isArray(details.corrective_actions) ? details.corrective_actions : merged.corrective_actions,
          investigation_completed: !!details.investigation_completed,
          accident_closed: !!details.accident_closed,
          closure_date: details.closure_date ?? merged.closure_date,
          closed_by_role: details.closed_by_role ?? merged.closed_by_role,
        })
      }

      setForm(merged)
      const initialAttachments = Array.isArray(details?.attachments) ? details.attachments : []
      setAttachments(initialAttachments)
      return
    }

    setForm((p) => ({ ...p, project_id: selectedProjectId || p.project_id }))
    setAttachments([])
    setPendingFiles([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initial, selectedProjectId])

  useEffect(() => {
    const run = async () => {
      if (!isOpen) return
      if (!initial?.id) return
      setAttachmentsLoading(true)
      try {
        const res = await hseEventService.listAttachments(initial.id)
        const list = res?.data?.data ?? res?.data
        setAttachments(Array.isArray(list) ? list : [])
      } catch {
        // ignore
      } finally {
        setAttachmentsLoading(false)
      }
    }
    run()
  }, [isOpen, initial?.id])

  const dayOfWeek = useMemo(() => {
    if (!form.event_date) return ''
    try {
      const d = new Date(form.event_date)
      if (Number.isNaN(d.getTime())) return ''
      return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
    } catch {
      return ''
    }
  }, [form.event_date])

  const severityFromVictims = useMemo(() => computeSeverityFromVictims(form.victims), [form.victims])
  const lostTimeFromVictims = useMemo(() => computeLostTime(form.victims), [form.victims])

  const setVictimsCount = (count) => {
    const c = Math.max(1, Math.min(20, Number(count) || 1))
    setForm((p) => {
      const victims = Array.isArray(p.victims) ? [...p.victims] : []
      while (victims.length < c) victims.push(makeVictim())
      while (victims.length > c) victims.pop()
      return { ...p, victims_count: c, victims }
    })
  }

  const toggleInList = (field, value) => {
    setForm((p) => {
      const list = Array.isArray(p[field]) ? [...p[field]] : []
      const idx = list.indexOf(value)
      if (idx >= 0) list.splice(idx, 1)
      else list.push(value)
      return { ...p, [field]: list }
    })
  }

  const setVictimField = (idx, field, value) => {
    setForm((p) => {
      const victims = Array.isArray(p.victims) ? [...p.victims] : []
      const current = victims[idx] ? { ...victims[idx] } : makeVictim()
      current[field] = value

      if (field === 'company' && value !== 'subcontractor') {
        current.subcontractor_name = ''
      }
      if (field === 'outcome') {
        if (value === 'no_injury') {
          current.body_part = ''
          current.injury_type = ''
          current.injury_type_other = ''
        }
        if (value !== 'fatal') {
          current.death_timing = ''
          current.death_date = ''
          current.death_place = ''
        }
      }

      if (field === 'injury_type' && value !== 'other') {
        current.injury_type_other = ''
      }

      if (field === 'death_timing' && value === 'same_day') {
        current.death_date = ''
      }

      victims[idx] = current
      return { ...p, victims }
    })
  }

  const addCorrectiveAction = () => {
    setForm((p) => ({
      ...p,
      corrective_actions: [
        ...(Array.isArray(p.corrective_actions) ? p.corrective_actions : []),
        { type: '', description: '', responsible_role: '', deadline: '', status: 'open' },
      ],
    }))
  }

  const removeCorrectiveAction = (idx) => {
    setForm((p) => {
      const rows = Array.isArray(p.corrective_actions) ? [...p.corrective_actions] : []
      rows.splice(idx, 1)
      return { ...p, corrective_actions: rows }
    })
  }

  const updateCorrectiveAction = (idx, field, value) => {
    setForm((p) => {
      const rows = Array.isArray(p.corrective_actions) ? [...p.corrective_actions] : []
      const row = rows[idx] ? { ...rows[idx] } : { type: '', description: '', responsible_role: '', deadline: '', status: 'open' }
      row[field] = value
      rows[idx] = row
      return { ...p, corrective_actions: rows }
    })
  }

  const close = () => {
    if (saving) return
    onClose()
  }

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || [])
    setPendingFiles(files)
  }

  const uploadPendingFiles = async (eventId) => {
    const files = Array.isArray(pendingFiles) ? pendingFiles : []
    if (!eventId || files.length === 0) return

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await hseEventService.uploadAttachment(eventId, { file })
    }

    setPendingFiles([])
    const res = await hseEventService.listAttachments(eventId)
    const list = res?.data?.data ?? res?.data
    setAttachments(Array.isArray(list) ? list : [])
  }

  const deleteAttachment = async (eventId, attachmentId) => {
    if (!eventId || !attachmentId) return
    setAttachmentsLoading(true)
    try {
      await hseEventService.deleteAttachment(eventId, attachmentId)
      const res = await hseEventService.listAttachments(eventId)
      const list = res?.data?.data ?? res?.data
      setAttachments(Array.isArray(list) ? list : [])
      toast.success(t?.('common.saved') ?? 'Saved')
    } catch {
      toast.error(t?.('common.error') ?? 'Error')
    } finally {
      setAttachmentsLoading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return

    if (!form.project_id) return
    if (!form.category) return
    if (!form.location) return
    if (!form.event_date) return
    if (!form.shift) return

    if (!form.victims_count || form.victims_count < 1) return

    const victims = Array.isArray(form.victims) ? form.victims : []
    if (victims.length !== form.victims_count) return

    for (const v of victims) {
      if (!v.full_name || !v.outcome) return
      if (v.company === 'subcontractor' && !v.subcontractor_name) return
      if (v.outcome !== 'no_injury') {
        if (!v.body_part || !v.injury_type) return
        if (v.injury_type === 'other' && !v.injury_type_other) return
      }
      if (v.outcome === 'fatal') {
        if (!v.death_timing || !v.death_place) return
        if (v.death_timing === 'later' && !v.death_date) return
      }
    }

    if (!form.activity) return
    if (form.activity === 'other' && !form.activity_other) return

    if (!form.ground_condition || !form.lighting || !form.weather || !form.work_area) return

    if (!form.immediate_cause) return
    if (form.immediate_cause === 'other' && !form.immediate_cause_other) return

    const severity = severityFromVictims
    const lost_time = lostTimeFromVictims

    const needsMethodConformity = ['major', 'critical', 'fatal'].includes(severity)
    if (needsMethodConformity && !form.method_conformity) return

    if (lost_time && Number(form.lost_days) < 0) return

    setSaving(true)
    try {
      const payload = {
        project_id: parseInt(form.project_id),
        event_date: form.event_date,
        type: form.category,
        description: form.description || null,
        severity: severity || null,
        lost_time,
        lost_days: lost_time ? (Number(form.lost_days) || 0) : 0,
        location: form.location,
        details: {
          schema_version: 'accident_v1',
          category: form.category,
          exact_location: form.location,
          event_time: form.event_time || null,
          shift: form.shift,
          day_of_week: dayOfWeek || null,
          victims_count: form.victims_count,
          victims,
          activity: form.activity,
          activity_other: form.activity === 'other' ? form.activity_other : null,
          ground_condition: form.ground_condition,
          lighting: form.lighting,
          weather: form.weather,
          work_area: form.work_area,
          ppe_worn: form.ppe_worn,
          ppe_other: form.ppe_worn.includes('other') ? (form.ppe_other || null) : null,
          collective_protections: form.collective_protections,
          immediate_cause: form.immediate_cause,
          immediate_cause_other: form.immediate_cause === 'other' ? form.immediate_cause_other : null,
          root_causes: form.root_causes,
          method_conformity: needsMethodConformity ? form.method_conformity : null,
          immediate_actions: form.immediate_actions,
          corrective_actions: form.corrective_actions,
          investigation_completed: !!form.investigation_completed,
          accident_closed: !!form.accident_closed,
          closure_date: form.accident_closed ? (form.closure_date || null) : null,
          closed_by_role: form.accident_closed ? (form.closed_by_role || null) : null,
        },
      }

      try {
        const saved = await onSubmit(payload)
        const eventId = saved?.id ?? initial?.id
        try {
          await uploadPendingFiles(eventId)
        } catch {
          toast.error(t?.('common.error') ?? 'Error')
        }

        onClose()
      } catch {
        // onSubmit is expected to display a toast/error message
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={initial ? (t?.('hseEvents.modal.editTitle') ?? 'Edit') : (t?.('hseEvents.modal.newTitle') ?? 'New')}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">1) {tf('hseEvents.accidentForm.sections.identification', 'Accident Identification')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.accidentId', 'Accident ID')}</label>
              <input className="input" value={initial?.id ? String(initial.id) : tf('hseEvents.accidentForm.fields.autoGenerated', 'Auto-generated')} readOnly />
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.accidentCategory', 'Accident category')}</label>
              <select className="input" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} required>
                {ACCIDENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.siteProject', 'Site / Project')}</label>
              <select className="input" value={form.project_id} onChange={(e) => setForm((p) => ({ ...p, project_id: e.target.value }))} required>
                <option value="">{t?.('common.select') ?? 'Select'}</option>
                {(projects || []).map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.code ? `${p.code} - ${p.name}` : p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.exactLocation', 'Exact location on site')}</label>
              <input className="input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} required />
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.date', 'Date')}</label>
              <input type="date" className="input" value={form.event_date} onChange={(e) => setForm((p) => ({ ...p, event_date: e.target.value }))} required />
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.time', 'Time')}</label>
              <input type="time" className="input" value={form.event_time} onChange={(e) => setForm((p) => ({ ...p, event_time: e.target.value }))} />
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.shift', 'Shift')}</label>
              <select className="input" value={form.shift} onChange={(e) => setForm((p) => ({ ...p, shift: e.target.value }))} required>
                {SHIFT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.dayOfWeek', 'Day of week')}</label>
              <input className="input" value={dayOfWeek} readOnly />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">2) {tf('hseEvents.accidentForm.sections.victimsOverview', 'Victims Overview')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.numberOfVictims', 'Number of victims')}</label>
              <input
                type="number"
                min="1"
                max="20"
                className="input"
                value={form.victims_count}
                onChange={(e) => setVictimsCount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.derivedSeverity', 'Derived severity')}</label>
              <input className="input" value={severityFromVictims || '-'} readOnly />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {form.victims.map((v, idx) => {
            const hasInjury = v.outcome && v.outcome !== 'no_injury'
            const isFatal = v.outcome === 'fatal'

            return (
              <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  3) {tf('hseEvents.accidentForm.sections.victimDetails', 'Victim Details')} — {tf('hseEvents.accidentForm.fields.victim', 'Victim')} {idx + 1}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="label">{tf('hseEvents.accidentForm.fields.fullName', 'Full name')}</label>
                    <input className="input" value={v.full_name} onChange={(e) => setVictimField(idx, 'full_name', e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">{tf('hseEvents.accidentForm.fields.matricule', 'Matricule / Internal ID (optional)')}</label>
                    <input className="input" value={v.matricule} onChange={(e) => setVictimField(idx, 'matricule', e.target.value)} />
                  </div>

                  <div>
                    <label className="label">{tf('hseEvents.accidentForm.fields.company', 'Company')}</label>
                    <select className="input" value={v.company} onChange={(e) => setVictimField(idx, 'company', e.target.value)}>
                      <option value="sgtm">{tf('hseEvents.accidentForm.fields.companySgtm', 'SGTM')}</option>
                      <option value="subcontractor">{tf('hseEvents.accidentForm.fields.companySubcontractor', 'Subcontractor')}</option>
                    </select>
                  </div>

                  {v.company === 'subcontractor' && (
                    <div>
                      <label className="label">{tf('hseEvents.accidentForm.fields.subcontractorName', 'Subcontractor name')}</label>
                      <input className="input" value={v.subcontractor_name} onChange={(e) => setVictimField(idx, 'subcontractor_name', e.target.value)} required />
                    </div>
                  )}

                  <div>
                    <label className="label">{tf('hseEvents.accidentForm.fields.jobTitle', 'Job title / Role')}</label>
                    <input className="input" value={v.job_title} onChange={(e) => setVictimField(idx, 'job_title', e.target.value)} />
                  </div>

                  <div>
                    <label className="label">{tf('hseEvents.accidentForm.fields.ageRange', 'Age range')}</label>
                    <select className="input" value={v.age_range} onChange={(e) => setVictimField(idx, 'age_range', e.target.value)}>
                      <option value="">{t?.('common.select') ?? 'Select'}</option>
                      {AGE_RANGES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">{tf('hseEvents.accidentForm.fields.experience', 'Experience in current role')}</label>
                    <select className="input" value={v.experience_range} onChange={(e) => setVictimField(idx, 'experience_range', e.target.value)}>
                      <option value="">{t?.('common.select') ?? 'Select'}</option>
                      {EXPERIENCE_RANGES.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">{tf('hseEvents.accidentForm.fields.injuryOutcome', 'Injury outcome')}</label>
                    <select className="input" value={v.outcome} onChange={(e) => setVictimField(idx, 'outcome', e.target.value)} required>
                      <option value="">{t?.('common.select') ?? 'Select'}</option>
                      {OUTCOMES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hasInjury && (
                    <>
                      <div>
                        <label className="label">{tf('hseEvents.accidentForm.fields.bodyPart', 'Body part affected')}</label>
                        <select className="input" value={v.body_part} onChange={(e) => setVictimField(idx, 'body_part', e.target.value)} required>
                          <option value="">{t?.('common.select') ?? 'Select'}</option>
                          {BODY_PARTS.map((b) => (
                            <option key={b.value} value={b.value}>
                              {b.value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">{tf('hseEvents.accidentForm.fields.injuryType', 'Injury type')}</label>
                        <select className="input" value={v.injury_type} onChange={(e) => setVictimField(idx, 'injury_type', e.target.value)} required>
                          <option value="">{t?.('common.select') ?? 'Select'}</option>
                          {INJURY_TYPES.map((it) => (
                            <option key={it.value} value={it.value}>
                              {it.value}
                            </option>
                          ))}
                        </select>
                      </div>

                      {v.injury_type === 'other' && (
                        <div className="md:col-span-2">
                          <label className="label">{tf('hseEvents.accidentForm.fields.specifyInjuryType', 'Specify injury type')}</label>
                          <input className="input" value={v.injury_type_other} onChange={(e) => setVictimField(idx, 'injury_type_other', e.target.value)} required />
                        </div>
                      )}
                    </>
                  )}

                  {isFatal && (
                    <>
                      <div>
                        <label className="label">{tf('hseEvents.accidentForm.fields.dateOfDeath', 'Date of death')}</label>
                        <select className="input" value={v.death_timing} onChange={(e) => setVictimField(idx, 'death_timing', e.target.value)} required>
                          <option value="">{t?.('common.select') ?? 'Select'}</option>
                          <option value="same_day">{tf('hseEvents.accidentForm.fields.deathTimingSameDay', 'Same day')}</option>
                          <option value="later">{tf('hseEvents.accidentForm.fields.deathTimingLater', 'Later')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">{tf('hseEvents.accidentForm.fields.placeOfDeath', 'Place of death')}</label>
                        <select className="input" value={v.death_place} onChange={(e) => setVictimField(idx, 'death_place', e.target.value)} required>
                          <option value="">{t?.('common.select') ?? 'Select'}</option>
                          <option value="on_site">{tf('hseEvents.accidentForm.fields.deathPlaceOnSite', 'On site')}</option>
                          <option value="during_evacuation">{tf('hseEvents.accidentForm.fields.deathPlaceDuringEvacuation', 'During evacuation')}</option>
                          <option value="medical_facility">{tf('hseEvents.accidentForm.fields.deathPlaceMedicalFacility', 'Medical facility')}</option>
                        </select>
                      </div>
                      {v.death_timing === 'later' && (
                        <div className="md:col-span-2">
                          <label className="label">{tf('hseEvents.accidentForm.fields.datePicker', 'Date picker')}</label>
                          <input type="date" className="input" value={v.death_date} onChange={(e) => setVictimField(idx, 'death_date', e.target.value)} required />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">4) {tf('hseEvents.accidentForm.sections.activity', 'Activity at Time of Accident')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.activity', 'Activity')}</label>
              <select className="input" value={form.activity} onChange={(e) => setForm((p) => ({ ...p, activity: e.target.value }))} required>
                <option value="">{t?.('common.select') ?? 'Select'}</option>
                {ACTIVITIES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.value}
                  </option>
                ))}
              </select>
            </div>
            {form.activity === 'other' && (
              <div>
                <label className="label">{tf('hseEvents.accidentForm.fields.other', 'Other')}</label>
                <input className="input" value={form.activity_other} onChange={(e) => setForm((p) => ({ ...p, activity_other: e.target.value }))} required />
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">5) {tf('hseEvents.accidentForm.sections.environment', 'Work Environment & Conditions')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.groundCondition', 'Ground condition')}</label>
              <select className="input" value={form.ground_condition} onChange={(e) => setForm((p) => ({ ...p, ground_condition: e.target.value }))} required>
                <option value="">{t?.('common.select') ?? 'Select'}</option>
                {GROUND_CONDITIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.lighting', 'Lighting')}</label>
              <select className="input" value={form.lighting} onChange={(e) => setForm((p) => ({ ...p, lighting: e.target.value }))} required>
                <option value="">{t?.('common.select') ?? 'Select'}</option>
                {LIGHTING_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.weather', 'Weather')}</label>
              <select className="input" value={form.weather} onChange={(e) => setForm((p) => ({ ...p, weather: e.target.value }))} required>
                <option value="">{t?.('common.select') ?? 'Select'}</option>
                {WEATHER_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.workArea', 'Work area')}</label>
              <select className="input" value={form.work_area} onChange={(e) => setForm((p) => ({ ...p, work_area: e.target.value }))} required>
                <option value="">{t?.('common.select') ?? 'Select'}</option>
                {WORK_AREA_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">6) {tf('hseEvents.accidentForm.sections.ppe', 'PPE & Protections')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{tf('hseEvents.accidentForm.fields.ppeWorn', 'PPE worn')}</div>
              <div className="grid grid-cols-1 gap-1">
                {PPE_OPTIONS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={form.ppe_worn.includes(p.value)} onChange={() => toggleInList('ppe_worn', p.value)} />
                    {p.value}
                  </label>
                ))}
              </div>
              {form.ppe_worn.includes('other') && (
                <input
                  className="input"
                  placeholder={tf('hseEvents.accidentForm.fields.otherPpe', 'Other PPE')}
                  value={form.ppe_other}
                  onChange={(e) => setForm((p) => ({ ...p, ppe_other: e.target.value }))}
                />
              )}
            </div>

            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.collectiveProtections', 'Collective protections')}</label>
              <select className="input" value={form.collective_protections} onChange={(e) => setForm((p) => ({ ...p, collective_protections: e.target.value }))}>
                {COLLECTIVE_PROTECTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">7) {tf('hseEvents.accidentForm.sections.immediateCause', 'Immediate Cause')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.primaryImmediateCause', 'Primary immediate cause')}</label>
              <select className="input" value={form.immediate_cause} onChange={(e) => setForm((p) => ({ ...p, immediate_cause: e.target.value }))} required>
                <option value="">{t?.('common.select') ?? 'Select'}</option>
                {IMMEDIATE_CAUSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
            {form.immediate_cause === 'other' && (
              <div>
                <label className="label">{tf('hseEvents.accidentForm.fields.other', 'Other')}</label>
                <input className="input" value={form.immediate_cause_other} onChange={(e) => setForm((p) => ({ ...p, immediate_cause_other: e.target.value }))} required />
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">8) {tf('hseEvents.accidentForm.sections.rootCause', 'Root Cause Analysis')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{tf('hseEvents.accidentForm.fields.rootCauseCategories', 'Root cause categories')}</div>
              <div className="grid grid-cols-1 gap-1">
                {ROOT_CAUSE_CATEGORIES.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={form.root_causes.includes(c.value)} onChange={() => toggleInList('root_causes', c.value)} />
                    {c.value}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.methodConformity', 'Method conformity (required if severity ≥ LTA)')}</label>
              <select className="input" value={form.method_conformity} onChange={(e) => setForm((p) => ({ ...p, method_conformity: e.target.value }))}>
                <option value="">{t?.('common.select') ?? 'Select'}</option>
                {METHOD_CONFORMITY.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">9) {tf('hseEvents.accidentForm.sections.immediateActions', 'Immediate Actions Taken')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {IMMEDIATE_ACTIONS.map((a) => (
              <label key={a.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.immediate_actions.includes(a.value)} onChange={() => toggleInList('immediate_actions', a.value)} />
                {a.value}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">10) {tf('hseEvents.accidentForm.sections.preventiveActions', 'Preventive & Corrective Actions')}</div>
            <button type="button" className="btn-secondary" onClick={addCorrectiveAction}>
              {tf('hseEvents.accidentForm.fields.addAction', 'Add action')}
            </button>
          </div>

          <div className="space-y-3 mt-3">
            {(form.corrective_actions || []).map((row, idx) => (
              <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <select className="input" value={row.type} onChange={(e) => updateCorrectiveAction(idx, 'type', e.target.value)}>
                    <option value="">{tf('hseEvents.accidentForm.fields.actionType', 'Action type')}</option>
                    {PREVENTIVE_ACTION_TYPES.map((tpe) => (
                      <option key={tpe.value} value={tpe.value}>
                        {tpe.value}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input md:col-span-2"
                    placeholder={tf('hseEvents.accidentForm.fields.actionDescription', 'Action description')}
                    value={row.description}
                    onChange={(e) => updateCorrectiveAction(idx, 'description', e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder={tf('hseEvents.accidentForm.fields.responsibleRole', 'Responsible role')}
                    value={row.responsible_role}
                    onChange={(e) => updateCorrectiveAction(idx, 'responsible_role', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="input" value={row.deadline} onChange={(e) => updateCorrectiveAction(idx, 'deadline', e.target.value)} />
                    <select className="input" value={row.status} onChange={(e) => updateCorrectiveAction(idx, 'status', e.target.value)}>
                      {ACTION_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end mt-2">
                  <button type="button" className="btn-secondary" onClick={() => removeCorrectiveAction(idx)}>
                    {tf('hseEvents.accidentForm.fields.remove', 'Remove')}
                  </button>
                </div>
              </div>
            ))}

            {(form.corrective_actions || []).length === 0 && (
              <div className="text-sm text-gray-500">{tf('hseEvents.accidentForm.fields.noActions', 'No actions')}</div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">11) {tf('hseEvents.accidentForm.sections.attachments', 'Attachments')}</div>

          {!initial?.id && (
            <div className="text-sm text-gray-500 mt-2">{tf('hseEvents.accidentForm.fields.filesUploadedAfterSaving', 'Files will be uploaded after saving.')}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.addFiles', 'Add files')}</label>
              <input type="file" className="input" multiple onChange={onPickFiles} />
              {pendingFiles.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {tf('hseEvents.accidentForm.fields.selectedFiles', 'Selected: {files}', { files: pendingFiles.map((f) => f.name).join(', ') })}
                </div>
              )}
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.existingAttachments', 'Existing attachments')}</label>
              <div className="space-y-2">
                {attachmentsLoading && <div className="text-sm text-gray-500">{tf('hseEvents.accidentForm.fields.loading', 'Loading...')}</div>}
                {!attachmentsLoading && (attachments || []).length === 0 && (
                  <div className="text-sm text-gray-500">{tf('hseEvents.accidentForm.fields.noAttachments', 'No attachments')}</div>
                )}
                {(attachments || []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-800">
                    <a className="text-sm text-blue-600 hover:underline" href={a.url || '#'} target="_blank" rel="noreferrer">
                      {a.label || a.original_name || a.id}
                    </a>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!initial?.id || attachmentsLoading}
                      onClick={() => deleteAttachment(initial?.id, a.id)}
                    >
                      {t?.('common.delete') ?? 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">12) {tf('hseEvents.accidentForm.sections.validationClosure', 'Validation & Closure')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={!!form.investigation_completed} onChange={(e) => setForm((p) => ({ ...p, investigation_completed: e.target.checked }))} />
              {tf('hseEvents.accidentForm.fields.investigationCompleted', 'Investigation completed')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={!!form.accident_closed} onChange={(e) => setForm((p) => ({ ...p, accident_closed: e.target.checked }))} />
              {tf('hseEvents.accidentForm.fields.accidentClosed', 'Accident closed')}
            </label>
            {form.accident_closed && (
              <>
                <div>
                  <label className="label">{tf('hseEvents.accidentForm.fields.closureDate', 'Closure date')}</label>
                  <input type="date" className="input" value={form.closure_date} onChange={(e) => setForm((p) => ({ ...p, closure_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{tf('hseEvents.accidentForm.fields.closedByRole', 'Closed by (role)')}</label>
                  <input className="input" value={form.closed_by_role} onChange={(e) => setForm((p) => ({ ...p, closed_by_role: e.target.value }))} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tf('hseEvents.accidentForm.sections.other', 'Other')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.description', 'Description')}</label>
              <textarea className="input" rows="3" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">{tf('hseEvents.accidentForm.fields.lostWorkDays', 'Lost work days (if lost time)')}</label>
              <input type="number" min="0" className="input" value={form.lost_days} onChange={(e) => setForm((p) => ({ ...p, lost_days: e.target.value }))} />
              <div className="text-xs text-gray-500 mt-1">{tf('hseEvents.accidentForm.fields.lostTimeAutoDerived', 'Lost time is auto-derived from victims outcomes.')}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={close} disabled={saving}>
            {t?.('common.cancel') ?? 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {t?.('common.save') ?? 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
