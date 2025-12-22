import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import DatePicker from '../ui/DatePicker'
import Select from '../ui/Select'
import { useLanguage } from '../../i18n'
import { useAuthStore } from '../../store/authStore'
import { useProjectStore } from '../../store/projectStore'
import { Search, X, Image as ImageIcon } from 'lucide-react'
import { getProjectLabel, sortProjects } from '../../utils/projectList'

const TRAINING_TOPICS = [
  'Formation Montage/Démontage Echafaudage',
  'Formation utilisation Echafaudage',
  'formation coffrage/décoffrage',
  'Vérification Echafaudage',
  'Formation Elingage et Manutention',
  'Formation SST',
  'Formation EPI',
  'Outils électroportatifs',
  'Formation Conduite Défensive',
  'Formation travail en hauteur',
  'Formation Conduite Grue Mobile',
  'formation Conduite Tractopelle',
  'formation Conduite Tracteure',
  'conduite en sécurité des nacelles',
  'formation Soudeur',
  'Formation et habiltation Electriques',
  'Sensibilisation HSE personnel',
  'Formation engins de chantier',
  'Formation conduite en sécurité VL',
  'Formation flag-man',
  'formation excavation',
  'Espace confiné',
  'Risque d’incendie',
  'Ergonomie',
  'Environnement (Housekeeping, Déchets, produits chimiques)',
  'Coactivité',
  'Other',
]

const DURATION_OPTIONS = [
  '30 Min',
  '1 H',
  '1 H 30 Min',
  '2 H',
  '3 H',
  'Half a day',
  '1 day',
  '2 days',
  '3 days',
]

// Map duration label to "training hours" multiplier, using the example
// Half a day x 20 participants = 240 hours => Half a day = 12h
const DURATION_TO_HOURS = {
  '30 Min': 0.5,
  '1 H': 1,
  '1 H 30 Min': 1.5,
  '2 H': 2,
  '3 H': 3,
  'Half a day': 12,
  '1 day': 24,
  '2 days': 48,
  '3 days': 72,
}

export default function TrainingSubmissionModal({ isOpen, onClose, onSubmit }) {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const { projects, isLoading: loadingProjects, fetchProjects } = useProjectStore()

  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState('') // ISO string yyyy-mm-dd
  const [isExternal, setIsExternal] = useState(false)
  const [byInternalName, setByInternalName] = useState('')
  const [externalCompany, setExternalCompany] = useState('')
  const [themeSearch, setThemeSearch] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('')
  const [otherTheme, setOtherTheme] = useState('')
  const [duration, setDuration] = useState('')
  const [participants, setParticipants] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

  // Auto-fill internal name from user profile
  useEffect(() => {
    if (user?.name) {
      setByInternalName(user.name)
    }
  }, [user])

  // Load projects and auto-select when only one
  useEffect(() => {
    if (!isOpen) return

    const loadProjects = async () => {
      try {
        const list = await fetchProjects({ per_page: 50 })
        if (list.length === 1) {
          setProjectId(list[0].id.toString())
        }
      } catch (error) {
        console.error('Failed to load projects for training modal', error)
      }
    }

    loadProjects()
  }, [isOpen, fetchProjects])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProjectId('')
      setDate('')
      setIsExternal(false)
      setExternalCompany('')
      setThemeSearch('')
      setSelectedTheme('')
      setOtherTheme('')
      setDuration('')
      setParticipants('')
      setPhotoFile(null)
      setPhotoPreview('')
    }
  }, [isOpen])

  const filteredThemes = useMemo(() => {
    if (!themeSearch.trim()) return TRAINING_TOPICS
    const q = themeSearch.toLowerCase()
    return TRAINING_TOPICS.filter(label => label.toLowerCase().includes(q))
  }, [themeSearch])

  const participantsNumberRaw = Number(participants)
  const participantsNumber = Number.isFinite(participantsNumberRaw) ? participantsNumberRaw : 0
  const durationHours = DURATION_TO_HOURS[duration] ?? 0
  const trainingHours = durationHours * participantsNumber

  const projectListPreference = user?.project_list_preference ?? 'code'
  const sortedProjects = useMemo(() => {
    return sortProjects(projects, projectListPreference)
  }, [projects, projectListPreference])

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    setPhotoFile(file ?? null)

    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result.toString())
      }
      reader.readAsDataURL(file)
    } else {
      setPhotoPreview('')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!projectId || !date || !duration || !participantsNumber) return

    const payload = {
      project_id: projectId,
      date,
      by_internal: !isExternal,
      by_name: isExternal ? null : byInternalName,
      external_company: isExternal ? externalCompany : null,
      theme: selectedTheme === 'Other' ? otherTheme : selectedTheme,
      duration_label: duration,
      duration_hours: durationHours,
      participants: participantsNumber,
      training_hours: trainingHours,
      photo: photoFile,
    }

    if (onSubmit) {
      onSubmit(payload)
    }

    onClose()
  }

  const title = t('training.modalTitle') ?? 'Training Submission'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project */}
        <div>
          <label className="label">{t('training.project')}</label>
          <Select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={loadingProjects || projects.length === 1}
            required
          >
            <option value="">
              {loadingProjects ? t('common.loading') : t('training.selectProject')}
            </option>
            {sortedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {getProjectLabel(p)}
              </option>
            ))}
          </Select>
        </div>

        {/* Date */}
        <div>
          <label className="label">{t('training.date')}</label>
          <DatePicker value={date} onChange={setDate} required />
        </div>

        {/* By / External */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="label flex items-center justify-between">
              <span>{t('training.by')}</span>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExternal}
                  onChange={(e) => setIsExternal(e.target.checked)}
                  className="rounded border-gray-300 text-hse-primary focus:ring-hse-primary"
                />
                <span>{t('training.external')}</span>
              </label>
            </label>
            {!isExternal ? (
              <input
                type="text"
                className="input"
                value={byInternalName}
                onChange={(e) => setByInternalName(e.target.value)}
                readOnly
              />
            ) : (
              <input
                type="text"
                className="input"
                value={externalCompany}
                onChange={(e) => setExternalCompany(e.target.value)}
                placeholder={t('training.externalPlaceholder')}
                required
              />
            )}
          </div>
        </div>

        {/* Theme with search */}
        <div className="space-y-2">
          <label className="label">{t('training.theme')}</label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9"
              placeholder={t('training.searchTheme')}
              value={themeSearch}
              onChange={(e) => setThemeSearch(e.target.value)}
            />
            {themeSearch && (
              <button
                type="button"
                onClick={() => setThemeSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {filteredThemes.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedTheme(label)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-hse-primary/5 dark:hover:bg-hse-primary/10 ${
                  selectedTheme === label ? 'bg-hse-primary/10 text-hse-primary font-medium' : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {selectedTheme === 'Other' && (
            <div className="mt-2">
              <label className="label">{t('training.otherTheme')}</label>
              <input
                type="text"
                className="input"
                value={otherTheme}
                onChange={(e) => setOtherTheme(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        {/* Duration & Participants */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">{t('training.duration')}</label>
            <Select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            >
              <option value="">{t('training.selectDuration')}</option>
              {DURATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="label">{t('training.participants')}</label>
            <input
              type="number"
              min="1"
              className="input"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">{t('training.trainingHours')}</label>
            <div className="input bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
              <span>{Number.isFinite(trainingHours) ? trainingHours : 0}</span>
              <span className="text-xs text-gray-400 ml-2">{t('training.hoursUnit')}</span>
            </div>
          </div>
        </div>

        {/* Photo upload (optional) */}
        <div>
          <label className="label flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            {t('training.photo')}
          </label>
          <label className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 cursor-pointer hover:border-hse-primary hover:bg-hse-primary/5 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            {photoPreview ? (
              <div className="flex items-center gap-3">
                <img src={photoPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('training.changePhoto')}</span>
              </div>
            ) : (
              <div className="text-center">
                <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('training.uploadPhoto')}</p>
              </div>
            )}
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!projectId || !date || !duration || !participantsNumber || !selectedTheme || (selectedTheme === 'Other' && !otherTheme)}
          >
            {t('training.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
