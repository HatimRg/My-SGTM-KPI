import { memo } from 'react'
import { useTranslation } from '../../i18n'
import MonthPicker from './MonthPicker'

/**
 * MonthRangePicker component for selecting start and end months
 * Used in MonthlyReportTheme for month range filtering
 * @param {Object} props
 * @param {string} props.monthStart - Start month value (YYYY-MM format)
 * @param {string} props.monthEnd - End month value (YYYY-MM format)
 * @param {Function} props.onChangeStart - Callback when start month changes
 * @param {Function} props.onChangeEnd - Callback when end month changes
 * @param {string} [props.labelStart] - Label for start month picker
 * @param {string} [props.labelEnd] - Label for end month picker
 */
const MonthRangePicker = memo(function MonthRangePicker({ 
  monthStart, 
  monthEnd, 
  onChangeStart, 
  onChangeEnd,
  labelStart,
  labelEnd 
}) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {labelStart || t('dashboard.monthlyReport.monthStart')}
        </div>
        <MonthPicker 
          value={monthStart} 
          onChange={onChangeStart} 
          className="w-full" 
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {labelEnd || t('dashboard.monthlyReport.monthEnd')}
        </div>
        <MonthPicker 
          value={monthEnd} 
          onChange={onChangeEnd} 
          className="w-full" 
        />
      </div>
    </div>
  )
})

export default MonthRangePicker
