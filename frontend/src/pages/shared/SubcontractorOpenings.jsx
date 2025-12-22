import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { subcontractorOpeningsService, projectService, workerService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import DatePicker from '../../components/ui/DatePicker'
import {
  PlusCircle,
  Building2,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getProjectLabel, sortProjects } from '../../utils/projectList'

const STATUS_DOT = {
  green: 'bg-green-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
}

export default function SubcontractorOpenings() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')

  const [entreprises, setEntreprises] = useState([])

  const [openings, setOpenings] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const [contractorName, setContractorName] = useState('')
  const [contractorNameOther, setContractorNameOther] = useState('')
  const [workType, setWorkType] = useState('')
  const [contractorStartDate, setContractorStartDate] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const projectId = params.get('project_id')
    if (projectId) {
      setSelectedProject(projectId)
    }
  }, [location.search])

  useEffect(() => {
    const load = async () => {
      try {
        const [projectsRes, entreprisesRes] = await Promise.all([
          projectService.getAllList({ status: 'active' }),
          workerService.getEntreprises(),
        ])

        setProjects(Array.isArray(projectsRes) ? projectsRes : [])

        setEntreprises(entreprisesRes.data?.data ?? [])
      } catch (e) {
        console.error('Failed to load subcontractor openings bootstrap data', e)
      }
    }

    load()
  }, [])

  const filteredOpenings = useMemo(() => {
    if (!search.trim()) return openings
    const q = search.trim().toLowerCase()
    return openings.filter((o) => (o.contractor_name ?? '').toLowerCase().includes(q))
  }, [openings, search])

  const fetchOpenings = async () => {
    try {
      setLoading(true)
      const params = {}
      if (selectedProject) params.project_id = selectedProject
      const res = await subcontractorOpeningsService.getAll(params)
      const payload = res.data
      const data = payload.data ?? payload
      setOpenings(Array.isArray(data) ? data : (data.data ?? []))
    } catch (e) {
      console.error('Failed to load subcontractor openings', e)
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOpenings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject])

  const handleDelete = async (openingId, contractorName) => {
    const ok = window.confirm(
      t('subcontractors.confirmDeleteOpening', {
        name: contractorName,
      }),
    )
    if (!ok) return

    try {
      await subcontractorOpeningsService.delete(openingId)
      toast.success(t('subcontractors.openingDeleted'))
      fetchOpenings()
    } catch (e) {
      console.error('Failed to delete opening', e)
      toast.error(e.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to delete')
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()

    const chosen = contractorName === '__other__' ? contractorNameOther.trim() : contractorName
    if (!selectedProject || !chosen) return

    setCreating(true)
    try {
      const res = await subcontractorOpeningsService.create({
        project_id: selectedProject,
        contractor_name: chosen,
        work_type: workType.trim() ? workType.trim() : undefined,
        contractor_start_date: contractorStartDate ? contractorStartDate : undefined,
      })

      toast.success(t('subcontractors.openingCreated'))
      setShowCreate(false)
      setContractorName('')
      setContractorNameOther('')
      setWorkType('')
      setContractorStartDate('')

      const opening = res.data?.data ?? res.data
      if (opening?.id) {
        navigate(`/subcontractors/openings/${opening.id}`)
        return
      }

      fetchOpenings()
    } catch (err) {
      console.error('Failed to create opening', err)
      toast.error(err.response?.data?.message ?? t('errors.somethingWentWrong') ?? 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const cards = useMemo(() => {
    // enforce SGTM pin first (case-insensitive), then alpha
    const list = [...filteredOpenings]
    list.sort((a, b) => {
      const aIs = (a.contractor_name ?? '').trim().toLowerCase() === 'sgtm'
      const bIs = (b.contractor_name ?? '').trim().toLowerCase() === 'sgtm'
      if (aIs === bIs) return (a.contractor_name ?? '').localeCompare(b.contractor_name ?? '')
      return aIs ? -1 : 1
    })
    return list
  }, [filteredOpenings])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('nav.dashboard')} / {t('subcontractors.title')}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('subcontractors.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('subcontractors.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="min-w-[220px]"
          >
            <option value="">{t('workers.allProjects')}</option>
            {sortedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {getProjectLabel(p)}
              </option>
            ))}
          </Select>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
            disabled={!selectedProject}
            title={!selectedProject ? t('subcontractors.chooseProjectFirst') : ''}
          >
            <PlusCircle className="w-4 h-4" />
            {t('subcontractors.addOpening')}
          </button>
        </div>
      </div>

      <div className="card p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('subcontractors.searchPlaceholder')}
              className="input pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Filter className="w-4 h-4" />
            <span>
              {t('subcontractors.companiesCount', { count: cards.length })}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-hse-primary" />
        </div>
      ) : cards.length === 0 ? (
        <div className="card p-8 text-center">
          <Building2 className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('subcontractors.noCompanies')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('subcontractors.noCompaniesHelp')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((o) => {
            const dot = STATUS_DOT[o.status] ?? STATUS_DOT.red
            const uploaded = o.documents_uploaded ?? 0
            const required = o.required_documents_count ?? 0
            const expired = o.expired_documents ?? []
            const expiring = o.expiring_documents ?? []
            const hasPreview = expired.length > 0 || expiring.length > 0
            const projectName = o.project?.name ?? ''
            const statusText =
              o.status === 'green'
                ? t('subcontractors.statusSummary.green')
                : o.status === 'yellow'
                ? t('subcontractors.statusSummary.yellow')
                : t('subcontractors.statusSummary.red')

            return (
              <div
                key={o.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/subcontractors/openings/${o.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/subcontractors/openings/${o.id}`)
                }}
                className="card p-4 text-left hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {o.contractor_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('subcontractors.cardMeta', {
                        project: projectName,
                        start: o.contractor_start_date ?? '',
                        workers: o.workers_count ?? 0,
                      })}
                    </p>
                    {o.work_type && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('subcontractors.workType')}: {o.work_type}
                      </p>
                    )}
                  </div>

                  <div className="relative flex items-center gap-2">
                    <div className="relative group">
                      <span className={`w-3 h-3 rounded-full ${dot} block`} />
                      {hasPreview && (
                        <div className="pointer-events-none absolute right-0 top-5 hidden group-hover:block z-50">
                          <div className="w-[360px] max-w-[80vw] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-3">
                            <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              {t('subcontractors.popoverTitle')}
                            </div>

                            {expired.length > 0 && (
                              <div className="mb-2">
                                <div className="text-[11px] font-semibold text-red-600 dark:text-red-300 mb-1">
                                  {t('subcontractors.expired')}
                                </div>
                                <div className="space-y-1">
                                  {expired.slice(0, 6).map((d) => (
                                    <div key={d.key} className="text-[11px] text-gray-700 dark:text-gray-200">
                                      <span className="font-medium">{d.label}</span>
                                      <span className="text-gray-500 dark:text-gray-400"> · {d.expiry_date}</span>
                                    </div>
                                  ))}
                                  {expired.length > 6 && (
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                      {t('subcontractors.othersCount', { count: expired.length - 6 })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {expiring.length > 0 && (
                              <div>
                                <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 mb-1">
                                  {t('subcontractors.expiring')}
                                </div>
                                <div className="space-y-1">
                                  {expiring.slice(0, 6).map((d) => (
                                    <div key={d.key} className="text-[11px] text-gray-700 dark:text-gray-200">
                                      <span className="font-medium">{d.label}</span>
                                      <span className="text-gray-500 dark:text-gray-400"> · {d.expiry_date}</span>
                                    </div>
                                  ))}
                                  {expiring.length > 6 && (
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                      {t('subcontractors.othersCount', { count: expiring.length - 6 })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(o.id, o.contractor_name)
                      }}
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>
                      {t('subcontractors.documentsCount', { uploaded, required })}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {statusText}
                    </span>
                  </div>

                  <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hse-primary"
                      style={{ width: required > 0 ? `${Math.min(100, (uploaded / required) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title={t('subcontractors.newOpening')}
          size="lg"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label text-xs">{t('subcontractors.company')}</label>
              <Select
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
              >
                <option value="">{t('common.select')}</option>
                {entreprises.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__other__">{t('subcontractors.other')}</option>
              </Select>
            </div>

            <div>
              <label className="label text-xs">{t('subcontractors.workType')}</label>
              <input
                type="text"
                className="input"
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                placeholder={t('subcontractors.workTypePlaceholder')}
              />
            </div>

            {contractorName === '__other__' && (
              <div>
                <label className="label text-xs">{t('subcontractors.newCompany')}</label>
                <input
                  type="text"
                  className="input"
                  value={contractorNameOther}
                  onChange={(e) => setContractorNameOther(e.target.value)}
                  placeholder={t('subcontractors.companyPlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="label text-xs">{t('subcontractors.startDate')}</label>
              <DatePicker
                value={contractorStartDate}
                onChange={setContractorStartDate}
                placeholder={t('datePicker.select')}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowCreate(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={
                  creating ||
                  !selectedProject ||
                  !(contractorName === '__other__' ? contractorNameOther.trim() : contractorName)
                }
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.create')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
