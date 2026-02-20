import { 
  AlertTriangle, 
  Skull,
  Clock,
  Heart,
  AlertCircle,
  Package,
  Leaf,
  FileText
} from 'lucide-react'

export default function StepIncidentTracking({ formData, updateFormData, t, editableFields = null }) {
  const handleChange = (field, value) => {
    updateFormData(field, value === '' ? 0 : parseInt(value))
  }

  const isEditable = (field) => {
    if (!editableFields) return false
    return editableFields.includes(field)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('kpi.incidents.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('kpi.incidents.subtitle')}</p>
        </div>
      </div>

      {/* Fatality */}
      <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-6 border border-red-200 dark:border-red-700">
        <h3 className="font-semibold text-red-900 dark:text-red-300 mb-4 flex items-center gap-2">
          <Skull className="w-5 h-5" />
          {t('kpi.incidents.fatality')}
        </h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-700 max-w-md">
          <label className="font-medium text-red-900 dark:text-red-300 block mb-2">
            {t('kpi.incidents.fatality')}
          </label>
          <input
            type="number"
            min="0"
            value={formData.accidents_fatal ?? ''}
            onChange={(e) => handleChange('accidents_fatal', e.target.value)}
            disabled={!isEditable('accidents_fatal')}
            className="input border-red-300"
            placeholder="0"
          />
        </div>
      </div>

      {/* Lost Time Accidents */}
      <div className="bg-orange-50 dark:bg-orange-900/30 rounded-xl p-6 border border-orange-200 dark:border-orange-700">
        <h3 className="font-semibold text-orange-900 dark:text-orange-300 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('kpi.incidents.lostTimeAccident')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
            <label className="font-medium text-orange-900 dark:text-orange-300 block mb-2">
              {t('kpi.incidents.lostTimeAccident')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.accidents_serious ?? ''}
              onChange={(e) => handleChange('accidents_serious', e.target.value)}
              disabled={!isEditable('accidents_serious')}
              className="input border-orange-300"
              placeholder="0"
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
            <label className="font-medium text-orange-900 dark:text-orange-300 block mb-2">
              {t('kpi.incidents.lostWorkDays')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.lost_workdays ?? ''}
              onChange={(e) => handleChange('lost_workdays', e.target.value)}
              disabled={!isEditable('lost_workdays')}
              className="input border-orange-300"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Non-Lost Time & First Aid */}
      <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-6 border border-yellow-200 dark:border-yellow-700">
        <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5" />
          {t('kpi.incidents.nonLostTimeAccident')} & {t('kpi.incidents.firstAidCase')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
            <label className="font-medium text-yellow-900 dark:text-yellow-300 block mb-2">
              {t('kpi.incidents.nonLostTimeAccident')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.accidents_minor ?? ''}
              onChange={(e) => handleChange('accidents_minor', e.target.value)}
              disabled={!isEditable('accidents_minor')}
              className="input border-yellow-300"
              placeholder="0"
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
            <label className="font-medium text-yellow-900 dark:text-yellow-300 block mb-2">
              {t('kpi.incidents.firstAidCase')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.first_aid_cases ?? ''}
              onChange={(e) => handleChange('first_aid_cases', e.target.value)}
              disabled={!isEditable('first_aid_cases')}
              className="input border-yellow-300"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Near Miss */}
      <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-6 border border-amber-200 dark:border-amber-700">
        <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {t('kpi.incidents.nearMiss')}
        </h3>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-200 dark:border-amber-700 max-w-md">
          <label className="font-medium text-amber-900 dark:text-amber-300 block mb-2">
            {t('kpi.incidents.nearMiss')}
          </label>
          <input
            type="number"
            min="0"
            value={formData.near_misses ?? ''}
            onChange={(e) => handleChange('near_misses', e.target.value)}
            disabled={!isEditable('near_misses')}
            className="input border-amber-300"
            placeholder="0"
          />
        </div>
      </div>

      {/* Property & Environment */}
      {false && <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          {t('kpi.incidents.propertyDamage')} & {t('kpi.incidents.environmentalImpact')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <label className="font-medium text-gray-900 dark:text-gray-100 block mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('kpi.incidents.propertyDamage')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.findings_open ?? ''}
              onChange={(e) => handleChange('findings_open', e.target.value)}
              disabled={!isEditable('findings_open')}
              className="input"
              placeholder="0"
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <label className="font-medium text-gray-900 dark:text-gray-100 block mb-2 flex items-center gap-2">
              <Leaf className="w-4 h-4 text-green-600" />
              {t('kpi.incidents.environmentalImpact')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.findings_closed ?? ''}
              onChange={(e) => handleChange('findings_closed', e.target.value)}
              disabled={!isEditable('findings_closed')}
              className="input"
              placeholder="0"
            />
          </div>
        </div>
      </div>}

      {/* Notes */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          {t('kpi.notes')}
        </h3>
        <textarea
          value={formData.notes ?? ''}
          onChange={(e) => updateFormData('notes', e.target.value)}
          rows={4}
          className="input"
          placeholder={t('kpi.notes')}
        />
      </div>

      {/* Summary */}
      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-4">{t('kpi.incidents.summary')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formData.accidents_fatal ?? 0}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('kpi.incidents.fatality')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formData.accidents_serious ?? 0}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('kpi.incidents.ltaShort')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{formData.first_aid_cases ?? 0}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('kpi.incidents.firstAidCase')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formData.near_misses ?? 0}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('kpi.incidents.nearMiss')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
