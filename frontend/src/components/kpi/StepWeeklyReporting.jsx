import { 
  ClipboardList, 
  Users, 
  GraduationCap, 
  AlertTriangle,
  ClipboardCheck,
  Clock,
  FileText,
  Volume2,
  Droplets,
  Zap
} from 'lucide-react'

export default function StepWeeklyReporting({ formData, updateFormData, t }) {
  // Use direct handler to avoid component recreation
  const handleChange = (field, value) => {
    updateFormData(field, value === '' ? 0 : parseFloat(value))
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-hse-primary/10 rounded-xl flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-hse-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('kpi.weekly.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">REPORTING HSE</p>
        </div>
      </div>

      {/* Workforce */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-hse-primary" />
          {t('kpi.weekly.effectif')} & {t('kpi.weekly.induction')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              {t('kpi.weekly.effectif')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.hours_worked ?? ''}
              onChange={(e) => handleChange('hours_worked', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-gray-400" />
              {t('kpi.weekly.induction')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.employees_trained ?? ''}
              onChange={(e) => handleChange('employees_trained', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Safety Observations */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          {t('kpi.weekly.ecarts')} & {t('kpi.weekly.sensibilisation')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{t('kpi.weekly.ecarts')}</label>
            <input
              type="number"
              min="0"
              value={formData.unsafe_conditions_reported ?? ''}
              onChange={(e) => handleChange('unsafe_conditions_reported', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">{t('kpi.weekly.sensibilisation')}</label>
            <input
              type="number"
              min="0"
              value={formData.toolbox_talks ?? ''}
              onChange={(e) => handleChange('toolbox_talks', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Accidents */}
      <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          {t('kpi.weekly.accident')}s
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">{t('kpi.weekly.presquAccident')}</label>
            <input
              type="number"
              min="0"
              value={formData.near_misses ?? ''}
              onChange={(e) => handleChange('near_misses', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">{t('kpi.weekly.premiersSoins')}</label>
            <input
              type="number"
              min="0"
              value={formData.first_aid_cases ?? ''}
              onChange={(e) => handleChange('first_aid_cases', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">{t('kpi.weekly.accident')}</label>
            <input
              type="number"
              min="0"
              value={formData.accidents ?? ''}
              onChange={(e) => handleChange('accidents', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">{t('kpi.weekly.joursArret')}</label>
            <input
              type="number"
              min="0"
              value={formData.lost_workdays ?? ''}
              onChange={(e) => handleChange('lost_workdays', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Inspections */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-green-500" />
          {t('kpi.weekly.inspections')} & {t('kpi.weekly.heuresFormation')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-gray-400" />
              {t('kpi.weekly.inspections')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.inspections_completed ?? ''}
              onChange={(e) => handleChange('inspections_completed', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              {t('kpi.weekly.heuresFormation')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.5"
                value={formData.training_hours ?? ''}
                onChange={(e) => handleChange('training_hours', e.target.value)}
                className="input pr-10"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Work Permits & Discipline */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-hse-primary" />
          {t('kpi.weekly.permisTravail')} & {t('kpi.weekly.mesuresDisciplinaires')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              {t('kpi.weekly.permisTravail')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.work_permits ?? ''}
              onChange={(e) => handleChange('work_permits', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">{t('kpi.weekly.mesuresDisciplinaires')}</label>
            <input
              type="number"
              min="0"
              value={formData.corrective_actions ?? ''}
              onChange={(e) => handleChange('corrective_actions', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Compliance */}
      <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-green-600" />
          {t('kpi.weekly.conformiteHSE')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{t('kpi.weekly.conformiteHSE')}</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={formData.hse_compliance_rate ?? ''}
                onChange={(e) => handleChange('hse_compliance_rate', e.target.value)}
                className="input pr-10"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="label">{t('kpi.weekly.conformiteMedecine')}</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={formData.medical_compliance_rate ?? ''}
                onChange={(e) => handleChange('medical_compliance_rate', e.target.value)}
                className="input pr-10"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-400" />
              {t('kpi.weekly.suiviBruit')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.noise_monitoring ?? ''}
              onChange={(e) => handleChange('noise_monitoring', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Resource Consumption - Water & Electricity */}
      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-500" />
          {t('kpi.weekly.consommation')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-400" />
              {t('kpi.weekly.consommationEau')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.water_consumption ?? ''}
                onChange={(e) => handleChange('water_consumption', e.target.value)}
                className="input pr-12"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">m³</span>
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              {t('kpi.weekly.consommationElectricite')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.electricity_consumption ?? ''}
                onChange={(e) => handleChange('electricity_consumption', e.target.value)}
                className="input pr-14"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">kWh</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
