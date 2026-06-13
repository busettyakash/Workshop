const SOLID_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Indigo/Purple
  '#ec4899', // Pink
  '#10b981', // Green
  '#f97316', // Orange
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#f59e0b', // Amber/Yellow
  '#6366f1', // Indigo
  '#14b8a6', // Teal
]

export function getAvatarColor(name) {
  if (!name) return SOLID_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const idx = Math.abs(hash) % SOLID_COLORS.length
  return SOLID_COLORS[idx]
}

export function getInitials(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length > 1) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }
  return name.charAt(0).toUpperCase()
}

export function getSingleLetter(name) {
  if (!name) return ''
  return name.trim().charAt(0).toUpperCase()
}

export function getPillStyle(label) {
  if (!label) return { bg: '#f3f4f6', text: '#1f2937', border: '#e5e7eb' }
  const clean = label.toString().toLowerCase().trim()

  if (clean.includes('electronic') || clean.includes('startup') || clean === 'active' || clean === 'paid' || clean === 'in stock') {
    return { bg: '#ecfdf5', text: '#065f46', border: '#d1fae5' } // Green
  }
  if (clean.includes('apparel') || clean.includes('invest') || clean === 'customer story' || clean === 'low stock') {
    return { bg: '#eff6ff', text: '#1e40af', border: '#dbeafe' } // Blue
  }
  if (clean.includes('grocery') || clean.includes('productiv') || clean === 'tutorial') {
    return { bg: '#faf5ff', text: '#6b21a8', border: '#f3e8ff' } // Purple
  }
  if (clean.includes('appliance') || clean.includes('leader')) {
    return { bg: '#fdf2f8', text: '#9d174d', border: '#fce7f3' } // Pink
  }
  if (clean.includes('saas') || clean.includes('management') || clean === 'pending' || clean === 'unpaid') {
    return { bg: '#fff7ed', text: '#9a3412', border: '#ffedd5' } // Orange
  }
  if (clean.includes('out') || clean.includes('cancel') || clean === 'inactive') {
    return { bg: '#fef2f2', text: '#991b1b', border: '#fee2e2' } // Red
  }

  // Fallback hashing
  let hash = 0
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colorSchemes = [
    { bg: '#eff6ff', text: '#1e40af', border: '#dbeafe' }, // blue
    { bg: '#faf5ff', text: '#6b21a8', border: '#f3e8ff' }, // purple
    { bg: '#fdf2f8', text: '#9d174d', border: '#fce7f3' }, // pink
    { bg: '#ecfdf5', text: '#065f46', border: '#d1fae5' }, // green
    { bg: '#fff7ed', text: '#9a3412', border: '#ffedd5' }, // orange
    { bg: '#fef2f2', text: '#991b1b', border: '#fee2e2' }, // red
    { bg: '#f0fdfa', text: '#0f766e', border: '#ccfbf1' }, // teal
    { bg: '#fffbeb', text: '#b45309', border: '#fef3c7' }, // amber/yellow
  ]
  return colorSchemes[Math.abs(hash) % colorSchemes.length]
}
