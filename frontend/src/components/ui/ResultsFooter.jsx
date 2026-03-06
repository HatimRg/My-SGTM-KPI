import React from 'react'

export default function ResultsFooter({ t, shown, total, onShowMore, loading, className = '' }) {
  const safeShown = Number(shown) || 0
  const safeTotal = Number(total) || 0
  const hasMore = safeShown > 0 && safeTotal > safeShown

  if (!safeTotal) return null

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 ${className}`.trim()}>
      <div className="text-xs text-gray-600 dark:text-gray-300">
        {t?.('common.results.showing', { shown: safeShown, total: safeTotal }) ?? `Showing ${safeShown} of ${safeTotal} results`}
      </div>

      {hasMore && (
        <button
          type="button"
          className="btn-secondary"
          onClick={onShowMore}
          disabled={!!loading}
        >
          {loading
            ? (t?.('common.loading') ?? 'Loading...')
            : (t?.('common.results.showMore') ?? 'Show more')}
        </button>
      )}
    </div>
  )
}
