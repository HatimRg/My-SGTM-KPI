import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n'
import { projectService, kpiService } from '../../services/api'
import {
  FileText,
  Calendar,
  ClipboardList,
  AlertTriangle,
  Save,
  Send,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  Users,
  Zap,
  Droplets
} from 'lucide-react'
import toast from 'react-hot-toast'

// Step components
import StepProjectInfo from '../../components/kpi/StepProjectInfo'
import StepWeeklyReporting from '../../components/kpi/StepWeeklyReporting'
import StepIncidentTracking from '../../components/kpi/StepIncidentTracking'
import DailyKpiEntry from '../../components/kpi/DailyKpiEntry'

import { getCurrentWeek, getWeekDates, formatDate } from '../../utils/weekHelper'

const DRAFT_STORAGE_KEY = 'hse-kpi-draft'

export default function KpiSubmission() {
  const { projectId, reportId } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [projects, setProjects] = useState([])
  const [poles, setPoles] = useState([])
  const [selectedPole, setSelectedPole] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [existingReportId, setExistingReportId] = useState(null)
  const [rejectionInfo, setRejectionInfo] = useState(null)

  // Form data state
  const [formData, setFormData] = useState(() => {
    // Don't load draft if editing existing report
    if (reportId) {
      return getDefaultFormData(projectId)
    }
    
    // Try to load draft from localStorage
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft)
      } catch (e) {
        console.error('Error parsing draft:', e)
      }
    }
    
    return getDefaultFormData(projectId)
  })

  function getDefaultFormData(projectId) {
    const currentWeekInfo = getCurrentWeek()
    return {
      // Step 1: Project Info
      project_id: projectId ?? '',
      report_date: '',
      report_month: new Date().getMonth() + 1,
      report_year: currentWeekInfo.year,
      week_number: '',  // User must select
      start_date: '',
      end_date: '',
      
      // Step 2: Weekly HSE Reporting - All 19 fields
      hours_worked: 0,              // 1. Effectif
      employees_trained: 0,         // 2. Induction
      unsafe_conditions_reported: 0, // 3. Relevé des écarts
      toolbox_talks: 0,             // 4. Nombre de Sensibilisation
      near_misses: 0,               // 5. Presqu'accident
      first_aid_cases: 0,           // 6. Premiers soins
      accidents: 0,                 // 7. Accident
      lost_workdays: 0,             // 8. Nombre de jours d'arrêt
      inspections_completed: 0,     // 9. Nombre d'Inspections
      tg_value: 0,                  // 10. TG (Taux de Gravité)
      tf_value: 0,                  // 11. TF (Taux de Fréquence)
      training_hours: 0,            // 12. Heures de formation
      work_permits: 0,              // 13. Permis de travail
      corrective_actions: 0,        // 14. Mesures disciplinaires
      hse_compliance_rate: 0,       // 15. Taux de conformité réglementaire HSE
      medical_compliance_rate: 0,   // 16. Taux de conformité médecine du travail
      noise_monitoring: 0,          // 17. Suivi du bruit
      water_consumption: 0,         // 18. Consommation d'énergie : Eau
      electricity_consumption: 0,   // 19. Consommation d'énergie : Électricité
      
      // Step 3: Incident & Accident Tracking (detailed breakdown)
      accidents_fatal: 0,           // Fatality / Mortel
      accidents_serious: 0,         // Lost Time Accident
      accidents_minor: 0,           // Non-Lost Time Accident
      
      // Additional fields (legacy compatibility)
      findings_open: 0,
      findings_closed: 0,
      trainings_conducted: 0,
      trainings_planned: 0,
      inspections_planned: 0,
      unsafe_acts_reported: 0,
      emergency_drills: 0,
      
      // Notes
      notes: '',
      status: 'draft'
    }
  }

  const steps = [
    { 
      id: 'project-info', 
      title: t('kpi.steps.projectInfo'), 
      icon: Building2,
      description: t('kpi.projectInfo.title')
    },
    { 
      id: 'weekly-reporting', 
      title: t('kpi.steps.weeklyReporting'), 
      icon: ClipboardList,
      description: t('kpi.weekly.title')
    },
    { 
      id: 'incident-tracking', 
      title: t('kpi.steps.incidentTracking'), 
      icon: AlertTriangle,
      description: t('kpi.incidents.title')
    },
  ]

  const updateFormData = (field, value) => {
    const toNumber = (v) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }

    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      // Auto-calculate TF and TG when relevant fields change
      // TF (Frequency Rate) = (Accidents × 1,000,000) / Hours Worked
      // TG (Severity Rate) = (Lost Workdays × 1,000) / Hours Worked
      if (['accidents', 'lost_workdays', 'hours_worked'].includes(field)) {
        const hoursWorked = toNumber(field === 'hours_worked' ? value : updated.hours_worked)
        const accidents = toNumber(field === 'accidents' ? value : updated.accidents)
        const lostWorkdays = toNumber(field === 'lost_workdays' ? value : updated.lost_workdays)

        if (hoursWorked > 0) {
          updated.tf_value = Number(((accidents * 1000000) / hoursWorked).toFixed(2))
          updated.tg_value = Number(((lostWorkdays * 1000) / hoursWorked).toFixed(4))
        } else {
          updated.tf_value = 0
          updated.tg_value = 0
        }
      }

      return updated
    })
  }

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectList = await projectService.getAllList({ status: 'active' })
        setProjects(projectList)
        
        // Auto-select if user has only 1 project
        if (projectList.length === 1 && !formData.project_id) {
          updateFormData('project_id', projectList[0].id.toString())
        }
      } catch (error) {
        console.error('Failed to load projects:', error)
        toast.error(t('errors.somethingWentWrong'))
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [t])

  useEffect(() => {
    const fetchPoles = async () => {
      try {
        const res = await projectService.getPoles()
        const values = res.data?.data?.poles ?? res.data?.poles ?? []
        setPoles(Array.isArray(values) ? values : [])
      } catch (e) {
        setPoles([])
      }
    }
    fetchPoles()
  }, [])

  useEffect(() => {
    if (!selectedPole) return
    const ok = projects.some((p) => String(p.id) === String(formData.project_id) && p?.pole === selectedPole)
    if (!ok && formData.project_id) {
      updateFormData('project_id', '')
    }
  }, [selectedPole, projects, formData.project_id, updateFormData])

  // Load existing report for edit mode
  useEffect(() => {
    const loadExistingReport = async () => {
      if (!reportId) return
      
      try {
        setLoading(true)
        const response = await kpiService.getById(reportId)
        const payload = response.data?.data
        const report = payload?.report || payload
        
        // Only prevent editing for approved or currently submitted reports
        if (report.status === 'approved' || report.status === 'submitted') {
          toast.error(t('kpi.submissionPage.cannotEditReport'))
          navigate('/dashboard')
          return
        }
        
        setIsEditMode(true)
        setExistingReportId(report.id)
        
        if (report.rejection_reason) {
          setRejectionInfo({
            reason: report.rejection_reason,
            rejected_at: report.rejected_at
          })
        }
        
        // Populate form with existing data - all 19 fields + extras
        setFormData({
          project_id: report.project_id !== null && report.project_id !== undefined ? String(report.project_id) : '',
          report_date: report.report_date ?? '',
          report_month: report.report_month,
          report_year: report.report_year,
          week_number: report.week_number !== null && report.week_number !== undefined ? String(report.week_number) : '',
          start_date: report.start_date ?? '',
          end_date: report.end_date ?? '',
          // The 19 main fields
          hours_worked: report.hours_worked ?? 0,              // 1. Effectif
          employees_trained: report.employees_trained ?? 0,    // 2. Induction
          unsafe_conditions_reported: report.unsafe_conditions_reported ?? 0, // 3. Relevé des écarts
          toolbox_talks: report.toolbox_talks ?? 0,            // 4. Sensibilisation
          near_misses: report.near_misses ?? 0,                // 5. Presqu'accident
          first_aid_cases: report.first_aid_cases ?? 0,        // 6. Premiers soins
          accidents: report.accidents ?? 0,                    // 7. Accident
          lost_workdays: report.lost_workdays ?? 0,            // 8. Jours d'arrêt
          inspections_completed: report.inspections_completed ?? 0, // 9. Inspections
          tg_value: report.tg_value ?? 0,                      // 10. TG
          tf_value: report.tf_value ?? 0,                      // 11. TF
          training_hours: report.training_hours ?? 0,          // 12. Heures formation
          work_permits: report.work_permits ?? 0,              // 13. Permis de travail
          corrective_actions: report.corrective_actions ?? 0,  // 14. Mesures disciplinaires
          hse_compliance_rate: report.hse_compliance_rate ?? report.ppe_compliance_rate ?? 0, // 15. Conformité HSE
          medical_compliance_rate: report.medical_compliance_rate ?? 0, // 16. Conformité médecine
          noise_monitoring: report.noise_monitoring ?? 0,      // 17. Suivi bruit
          water_consumption: report.water_consumption ?? 0,    // 18. Eau
          electricity_consumption: report.electricity_consumption ?? 0, // 19. Électricité
          // Incident tracking extras
          accidents_fatal: report.accidents_fatal ?? 0,
          accidents_serious: report.accidents_serious ?? 0,
          accidents_minor: report.accidents_minor ?? 0,
          // Legacy fields
          findings_open: report.findings_open ?? 0,
          findings_closed: report.findings_closed ?? 0,
          trainings_conducted: report.trainings_conducted ?? 0,
          trainings_planned: report.trainings_planned ?? 0,
          inspections_planned: report.inspections_planned ?? 0,
          unsafe_acts_reported: report.unsafe_acts_reported ?? 0,
          emergency_drills: report.emergency_drills ?? 0,
          notes: report.notes ?? '',
          status: 'draft'
        })
      } catch (error) {
        console.error('Failed to load report:', error)
        toast.error(t('kpi.submissionPage.loadReportFailed'))
        navigate('/dashboard')
      } finally {
        setLoading(false)
      }
    }
    
    loadExistingReport()
  }, [reportId, navigate])

  // Auto-save draft when form data changes (only for new reports)
  useEffect(() => {
    if (isEditMode) return // Don't auto-save to localStorage in edit mode
    
    const timeoutId = setTimeout(() => {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData))
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [formData, isEditMode])

  // Auto-populate data when project and week are selected
  const [autoPopulating, setAutoPopulating] = useState(false)
  
  const handleAutoPopulate = async () => {
    if (!formData.project_id || !formData.week_number || !formData.report_year) {
      toast.error(t('kpi.selectProjectAndWeek'))
      return
    }

    setAutoPopulating(true)
    try {
      const response = await kpiService.getAutoPopulatedData({
        project_id: formData.project_id,
        week: formData.week_number,
        year: formData.report_year,
      })
      
      const { data, sources } = response.data.data
      
      // Update form with auto-populated data
      setFormData(prev => ({
        ...prev,
        ...data,
      }))
      
      // Show summary of what was populated
      const sourceSummary = []
      if (sources.sor_reports > 0) sourceSummary.push(`${sources.sor_reports} écarts`)
      if (sources.trainings > 0) sourceSummary.push(`${sources.trainings} formations`)
      if (sources.awareness_sessions > 0) sourceSummary.push(`${sources.awareness_sessions} sensibilisations`)
      if (sources.work_permits > 0) sourceSummary.push(`${sources.work_permits} permis`)
      if (sources.inspections > 0) sourceSummary.push(`${sources.inspections} inspections`)
      
      if (sourceSummary.length > 0) {
        toast.success(`${t('kpi.autoPopulated')}: ${sourceSummary.join(', ')}`)
      } else {
        toast.info(t('kpi.noDataToPopulate'))
      }
    } catch (error) {
      console.error('Auto-populate error:', error)
      toast.error(t('errors.somethingWentWrong'))
    } finally {
      setAutoPopulating(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!formData.project_id) {
      toast.error(t('kpi.projectInfo.selectProject'))
      return
    }

    setSaving(true)
    try {
      const payload = { ...formData, status: 'draft' }

      if (existingReportId) {
        // Update existing report as draft
        await kpiService.update(existingReportId, payload)
      } else {
        // Create a new draft report in backend
        const response = await kpiService.create(payload)
        const created = response?.data?.data
        if (created?.id) {
          setExistingReportId(created.id)
          setIsEditMode(true)
        }
      }

      // Also keep a local draft for fast restore
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload))
      toast.success(t('kpi.reportSaved'))
    } catch (error) {
      const message = error?.response?.data?.message ?? t('errors.somethingWentWrong')
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.project_id) {
      toast.error(t('kpi.projectInfo.selectProject'))
      setCurrentStep(0)
      return
    }

    setSubmitting(true)
    try {
      const submitData = {
        ...formData,
        status: 'submitted'
      }
      
      if (isEditMode && existingReportId) {
        // Update existing report
        await kpiService.update(existingReportId, submitData)
        toast.success(t('kpi.reportResubmitted'))
      } else {
        // Create new report
        await kpiService.create(submitData)
        toast.success(t('kpi.reportSubmitted'))
      }
      
      // Clear draft after successful submission
      localStorage.removeItem(DRAFT_STORAGE_KEY)
      
      navigate('/dashboard')
    } catch (error) {
      const message = error.response?.data?.message ?? t('errors.somethingWentWrong')
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
    setFormData(getDefaultFormData(''))
    setCurrentStep(0)
    toast.success(t('common.success'))
  }

  const nextStep = () => {
    // Validate before leaving step 1
    if (currentStep === 0 && !formData.project_id) {
      toast.error(t('kpi.projectInfo.selectProject'))
      return
    }
    if (currentStep === 0 && !formData.week_number) {
      toast.error(t('kpi.submissionPage.selectWeekRequired'))
      return
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToStep = (index) => {
    // Don't allow skipping to later steps without project selection
    if (index > 0 && !formData.project_id) {
      toast.error(t('kpi.projectInfo.selectProject'))
      return
    }
    setCurrentStep(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-hse-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Rejection Alert */}
      {rejectionInfo && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Rapport rejeté - Modification requise</h3>
              <p className="text-red-700 mt-1">{rejectionInfo.reason}</p>
              {rejectionInfo.rejected_at && (
                <p className="text-red-600 text-sm mt-2">
                  Rejeté le {new Date(rejectionInfo.rejected_at).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEditMode ? 'Modifier le rapport KPI' : t('kpi.submission')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {isEditMode ? 'Corrigez et resoumettez votre rapport' : t('kpi.weekly.title')}
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => goToStep(index)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full ${
                  index === currentStep
                    ? 'bg-hse-primary text-white shadow-lg'
                    : index < currentStep
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index === currentStep
                    ? 'bg-white/20'
                    : index < currentStep
                    ? 'bg-green-200 dark:bg-green-800'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}>
                  {index < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs opacity-75">
                    {t('common.step') ?? 'Étape'} {index + 1}
                  </p>
                  <p className="font-medium text-sm">{step.title}</p>
                </div>
              </button>
              
              {index < steps.length - 1 && (
                <div className={`h-1 flex-1 mx-2 rounded ${
                  index < currentStep ? 'bg-green-300' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Draft indicator */}
      {formData.status === 'draft' && formData.project_id && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Save className="w-4 h-4" />
            <span className="text-sm">{t('kpi.status.draft')} - {t('kpi.reportSaved')}</span>
          </div>
          <button
            onClick={handleClearDraft}
            className="text-sm text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 underline"
          >
            {t('common.delete')}
          </button>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {currentStep === 0 && (
          <>
            <StepProjectInfo
              formData={formData}
              updateFormData={updateFormData}
              projects={projects}
              t={t}
              poles={poles}
              selectedPole={selectedPole}
              onPoleChange={(val) => setSelectedPole(val)}
            />
            
            {/* Auto-populate button */}
            {formData.project_id && formData.week_number && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-green-900 dark:text-green-300">{t('kpi.autoPopulateTitle')}</h4>
                    <p className="text-sm text-green-700 dark:text-green-400">{t('kpi.autoPopulateDesc')}</p>
                  </div>
                  <button
                    onClick={handleAutoPopulate}
                    disabled={autoPopulating}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {autoPopulating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        {t('kpi.autoPopulate')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        
        {currentStep === 1 && (
          <>
            {/* Daily KPI Entry Section */}
            {formData.project_id && formData.week_number && (
              <DailyKpiEntry
                projectId={formData.project_id}
                weekNumber={formData.week_number}
                year={formData.report_year}
                onDataConfirmed={(aggregates) => {
                  // Auto-fill KPI form fields from daily aggregates
                  // Batch update all values at once for efficiency
                  setFormData(prev => {
                    const updated = { ...prev }
                    
                    // Map daily field names to KPI report field names
                    if (aggregates.effectif !== undefined) updated.hours_worked = aggregates.effectif
                    if (aggregates.induction !== undefined) updated.employees_trained = aggregates.induction
                    if (aggregates.releve_ecarts !== undefined) updated.unsafe_conditions_reported = aggregates.releve_ecarts
                    if (aggregates.sensibilisation !== undefined) updated.toolbox_talks = aggregates.sensibilisation
                    if (aggregates.presquaccident !== undefined) updated.near_misses = aggregates.presquaccident
                    if (aggregates.premiers_soins !== undefined) updated.first_aid_cases = aggregates.premiers_soins
                    if (aggregates.accidents !== undefined) updated.accidents = aggregates.accidents
                    if (aggregates.jours_arret !== undefined) updated.lost_workdays = aggregates.jours_arret
                    if (aggregates.inspections !== undefined) updated.inspections_completed = aggregates.inspections
                    if (aggregates.heures_formation !== undefined) updated.training_hours = aggregates.heures_formation
                    if (aggregates.permis_travail !== undefined) updated.work_permits = aggregates.permis_travail
                    if (aggregates.mesures_disciplinaires !== undefined) updated.corrective_actions = aggregates.mesures_disciplinaires
                    if (aggregates.conformite_hse !== undefined) updated.hse_compliance_rate = aggregates.conformite_hse
                    if (aggregates.conformite_medicale !== undefined) updated.medical_compliance_rate = aggregates.conformite_medicale
                    if (aggregates.suivi_bruit !== undefined) updated.noise_monitoring = aggregates.suivi_bruit
                    if (aggregates.consommation_eau !== undefined) updated.water_consumption = aggregates.consommation_eau
                    if (aggregates.consommation_electricite !== undefined) updated.electricity_consumption = aggregates.consommation_electricite
                    
                    // Auto-calculate TF and TG after all values are set
                    // TF (Frequency Rate) = (Accidents × 1,000,000) / Hours Worked
                    // TG (Severity Rate) = (Lost Workdays × 1,000) / Hours Worked
                    const hoursWorkedRaw = Number(updated.hours_worked)
                    const accidentsRaw = Number(updated.accidents)
                    const lostWorkdaysRaw = Number(updated.lost_workdays)
                    const hoursWorked = Number.isFinite(hoursWorkedRaw) ? hoursWorkedRaw : 0
                    const accidents = Number.isFinite(accidentsRaw) ? accidentsRaw : 0
                    const lostWorkdays = Number.isFinite(lostWorkdaysRaw) ? lostWorkdaysRaw : 0
                    
                    if (hoursWorked > 0) {
                      updated.tf_value = Number(((accidents * 1000000) / hoursWorked).toFixed(2))
                      updated.tg_value = Number(((lostWorkdays * 1000) / hoursWorked).toFixed(4))
                    } else {
                      updated.tf_value = 0
                      updated.tg_value = 0
                    }
                    
                    return updated
                  })
                }}
              />
            )}
            
            <StepWeeklyReporting
              formData={formData}
              updateFormData={updateFormData}
              t={t}
            />
          </>
        )}
        
        {currentStep === 2 && (
          <StepIncidentTracking
            formData={formData}
            updateFormData={updateFormData}
            t={t}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className="btn-secondary flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('common.previous')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="btn-secondary flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('kpi.saveDraft')}
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={nextStep}
              className="btn-primary flex items-center gap-2"
            >
              {t('common.next')}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t('kpi.submitReport')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
