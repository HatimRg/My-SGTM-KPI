import { useState, useEffect } from 'react'
import { projectService } from '../../services/api'
import { useLanguage } from '../../i18n'
import { X, Plus, MapPin, Trash2, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ZonesManager({ projectId, projectName, isOpen, onClose }) {
  const { t, language } = useLanguage()
  const [zones, setZones] = useState([])
  const [newZone, setNewZone] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && projectId) {
      fetchZones()
    }
  }, [isOpen, projectId])

  const fetchZones = async () => {
    try {
      setLoading(true)
      const response = await projectService.getZones(projectId)
      setZones(response.data.data.zones || [])
    } catch (error) {
      toast.error(language === 'fr' ? 'Échec du chargement des zones' : 'Failed to load zones')
    } finally {
      setLoading(false)
    }
  }

  const handleAddZone = async () => {
    const trimmedZone = newZone.trim()
    if (!trimmedZone) return

    if (zones.includes(trimmedZone)) {
      toast.error(language === 'fr' ? 'Cette zone existe déjà' : 'This zone already exists')
      return
    }

    try {
      setSaving(true)
      const response = await projectService.addZone(projectId, trimmedZone)
      setZones(response.data.data.zones)
      setNewZone('')
      toast.success(language === 'fr' ? 'Zone ajoutée' : 'Zone added')
    } catch (error) {
      toast.error(language === 'fr' ? 'Échec de l\'ajout' : 'Failed to add zone')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveZone = async (zone) => {
    try {
      setSaving(true)
      const response = await projectService.removeZone(projectId, zone)
      setZones(response.data.data.zones)
      toast.success(language === 'fr' ? 'Zone supprimée' : 'Zone removed')
    } catch (error) {
      toast.error(language === 'fr' ? 'Échec de la suppression' : 'Failed to remove zone')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddZone()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {language === 'fr' ? 'Gérer les Zones' : 'Manage Zones'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{projectName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Add Zone Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'fr' ? 'Ajouter une zone' : 'Add a zone'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={language === 'fr' ? 'Nom de la zone...' : 'Zone name...'}
                className="flex-1 input"
                disabled={saving}
              />
              <button
                onClick={handleAddZone}
                disabled={!newZone.trim() || saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {language === 'fr' ? 'Ajouter' : 'Add'}
              </button>
            </div>
          </div>

          {/* Zones List */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {language === 'fr' ? 'Zones existantes' : 'Existing zones'} ({zones.length})
            </label>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <MapPin className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {language === 'fr' ? 'Aucune zone définie' : 'No zones defined'}
                </p>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {zones.map((zone, index) => (
                  <div
                    key={zone}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-500" />
                      <span className="text-gray-700 dark:text-gray-300">{zone}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveZone(zone)}
                      disabled={saving}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {language === 'fr' 
                ? '* Ces zones seront disponibles dans le menu déroulant du suivi des écarts'
                : '* These zones will be available in the deviation tracking dropdown'}
            </p>
          </div>

          {/* Close Button */}
          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="btn-secondary flex items-center gap-2">
              <Check className="w-4 h-4" />
              {language === 'fr' ? 'Terminé' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
