/**
 * Week Helper for SGTM KPI System
 * Weeks run Saturday to Friday, 52 weeks per year
 * Reference: Week 48/2025 = Sat 22/11/2025 to Fri 28/11/2025
 */

/**
 * Get the start date (Saturday) of Week 1 for a given year
 * Week 1 starts on the last Saturday of the previous December
 */
export function getWeek1Start(year) {
  // Find December 31 of the previous year
  const dec31 = new Date(year - 1, 11, 31) // Month is 0-indexed
  
  // Get day of week (0=Sunday, 6=Saturday)
  const dayOfWeek = dec31.getDay()
  
  // Calculate days to go back to reach Saturday
  // If Saturday (6), use it. Otherwise go back.
  let daysBack = 0
  if (dayOfWeek !== 6) {
    // Days since last Saturday: Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
    daysBack = dayOfWeek === 0 ? 1 : dayOfWeek + 1
  }
  
  const week1Start = new Date(dec31)
  week1Start.setDate(dec31.getDate() - daysBack)
  return week1Start
}

/**
 * Get the start and end dates for a specific week of a year
 * @returns {Object} { start: Date, end: Date }
 */
export function getWeekDates(weekNumber, year) {
  if (weekNumber < 1 || weekNumber > 52) {
    throw new Error('Week number must be between 1 and 52')
  }

  const week1Start = getWeek1Start(year)
  
  // Add (weekNumber - 1) * 7 days to get to the desired week
  const weekStart = new Date(week1Start)
  weekStart.setDate(week1Start.getDate() + (weekNumber - 1) * 7)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6) // Friday

  return {
    start: weekStart,
    end: weekEnd,
  }
}

/**
 * Get the week number for a given date
 * @returns {Object} { week: number, year: number }
 */
export function getWeekFromDate(date) {
  const d = new Date(date)
  let year = d.getFullYear()
  
  // Check if the date falls in the current year's weeks
  let week1Start = getWeek1Start(year)
  const week52End = new Date(week1Start)
  week52End.setDate(week1Start.getDate() + 52 * 7 - 1)
  
  // If date is before Week 1 of this year, it belongs to previous year
  if (d < week1Start) {
    year = year - 1
    week1Start = getWeek1Start(year)
  }
  // If date is after Week 52 of this year, it belongs to next year
  else if (d > week52End) {
    year = year + 1
    week1Start = getWeek1Start(year)
  }

  // Calculate week number
  const daysDiff = Math.floor((d - week1Start) / (1000 * 60 * 60 * 24))
  let weekNumber = Math.floor(daysDiff / 7) + 1

  // Ensure week number is within bounds
  weekNumber = Math.max(1, Math.min(52, weekNumber))

  return {
    week: weekNumber,
    year: year,
  }
}

/**
 * Get the current week number and year
 */
export function getCurrentWeek() {
  return getWeekFromDate(new Date())
}

/**
 * Get all 52 weeks for a year with their date ranges
 */
export function getAllWeeksForYear(year) {
  const weeks = []
  for (let w = 1; w <= 52; w++) {
    const dates = getWeekDates(w, year)
    weeks.push({
      week: w,
      year: year,
      start_date: formatDate(dates.start),
      end_date: formatDate(dates.end),
      label: `Semaine ${w} (${formatDateShort(dates.start)} - ${formatDateShort(dates.end)})`,
    })
  }
  return weeks
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date as DD/MM
 */
export function formatDateShort(date) {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

/**
 * Format week for display
 */
export function formatWeek(weekNumber, year) {
  const dates = getWeekDates(weekNumber, year)
  const startStr = formatDateFull(dates.start)
  const endStr = formatDateFull(dates.end)
  return `Semaine ${weekNumber} (${startStr} - ${endStr})`
}

/**
 * Format date as DD/MM/YYYY
 */
export function formatDateFull(date) {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}
