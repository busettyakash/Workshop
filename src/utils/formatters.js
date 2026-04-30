// Formatting helpers

/**
 * Format a number as Indian Rupee currency
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a date relative to now (e.g. "2d ago", "Today")
 */
export const formatRelativeDate = (date) => {
  if (!date) return '—'
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 172800) return 'Yesterday'
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Format a date to readable string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  })
}

/**
 * Get initials from a name string
 */
export const getInitials = (name = '', length = 2) => {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, length)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

/**
 * Truncate a string to a max length
 */
export const truncate = (str, max = 30) => {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

/**
 * Generate a greeting based on time of day
 */
export const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
