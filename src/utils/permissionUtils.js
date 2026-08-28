import { useState, useEffect } from 'react'

// Map of sidebar labels / route identifiers to module permission keys
export const NAV_MODULE_MAP = {
  'Home': 'dashboard',
  'Dashboard': 'dashboard',
  'Notes': 'notes',
  'Emails': 'emails',
  'Reports': 'reports',
  'Workflows': 'workflows',
  'Automations': 'workflows',
  'Products': 'products',
  'People': 'people',
  'Product History': 'price_history',
  'Price History': 'price_history',
  'Quotes': 'quotes',
  'Orders': 'orders',
  'Import Stock': 'import_stock',
  'Billing': 'billing',
  'Paid': 'paid',
  'Unpaid': 'unpaid',
  'Chats': 'chats',
}

// Ordered navigation items in the exact order they appear in the left menu
export const ORDERED_NAV_ITEMS = [
  { module: 'dashboard', label: 'Home', path: '/dashboard' },
  { module: 'notes', label: 'Notes', path: '/notes' },
  { module: 'emails', label: 'Emails', path: '/emails' },
  { module: 'reports', label: 'Reports', path: '/reports' },
  { module: 'workflows', label: 'Workflows', path: '/workflows' },
  { module: 'products', label: 'Products', path: '/products' },
  { module: 'people', label: 'People', path: '/people' },
  { module: 'price_history', label: 'Product History', path: '/price-history' },
  { module: 'quotes', label: 'Quotes', path: '/quotes' },
  { module: 'orders', label: 'Orders', path: '/orders' },
  { module: 'import_stock', label: 'Import Stock', path: '/import-stock' },
  { module: 'billing', label: 'Billing', path: '/billing' },
  { module: 'paid', label: 'Paid', path: '/paid' },
  { module: 'unpaid', label: 'Unpaid', path: '/unpaid' },
  { module: 'chats', label: 'Chats', path: '/dashboard?chat=true' },
]

/**
 * Check if the active role is Owner or Admin.
 */
export function isOwnerOrAdmin(role) {
  const currentRole = role || (typeof window !== 'undefined' ? sessionStorage.getItem('ws_active_role') : null) || 'Owner'
  return currentRole === 'Owner' || currentRole === 'Admin'
}

/**
 * Helper to retrieve active permissions from argument or sessionStorage.
 */
export function getActivePermissions(permissions) {
  if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
    return permissions
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('ws_active_permissions')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Check if the active user role/permissions allow reading a specific module.
 */
export function hasModulePermission(moduleName, permissions, role) {
  if (isOwnerOrAdmin(role)) return true

  const currentPermissions = getActivePermissions(permissions)
  // If no permissions configured, default to true for safety
  if (!currentPermissions || typeof currentPermissions !== 'object' || Object.keys(currentPermissions).length === 0) {
    return true
  }

  const perm = currentPermissions[moduleName]
  return perm?.read === true
}

/**
 * Check if the active user role/permissions allow editing / creating in a module.
 */
export function canEditModule(moduleName, permissions, role) {
  if (isOwnerOrAdmin(role)) return true

  const currentPermissions = getActivePermissions(permissions)
  if (!currentPermissions || typeof currentPermissions !== 'object' || Object.keys(currentPermissions).length === 0) {
    return true
  }

  const perm = currentPermissions[moduleName]
  return perm?.edit === true
}

/**
 * Check if the active user role/permissions allow creating items in a module.
 */
export function canCreateModule(moduleName, permissions, role) {
  return canEditModule(moduleName, permissions, role)
}

/**
 * Check if the active user role/permissions allow deleting in a module.
 */
export function canDeleteModule(moduleName, permissions, role) {
  if (isOwnerOrAdmin(role)) return true

  const currentPermissions = getActivePermissions(permissions)
  if (!currentPermissions || typeof currentPermissions !== 'object' || Object.keys(currentPermissions).length === 0) {
    return true
  }

  const perm = currentPermissions[moduleName]
  return perm?.delete === true
}

/**
 * Returns the first accessible route based on the user's role and permissions.
 * If the user has permission for 'dashboard', returns '/dashboard'.
 * Otherwise, scans the left menu in order and returns the first permitted route (e.g. '/products').
 */
export function getFirstAccessibleRoute(permissions, role) {
  if (isOwnerOrAdmin(role)) return '/dashboard'

  const currentPermissions = getActivePermissions(permissions)
  if (!currentPermissions || typeof currentPermissions !== 'object' || Object.keys(currentPermissions).length === 0) {
    return '/dashboard'
  }

  // If dashboard is permitted, return /dashboard
  if (currentPermissions.dashboard?.read === true) {
    return '/dashboard'
  }

  // Scan ordered sidebar items for first match
  for (const item of ORDERED_NAV_ITEMS) {
    if (currentPermissions[item.module]?.read === true) {
      return item.path
    }
  }

  // Fallback to settings if nothing in the menu is accessible
  return '/settings'
}

/**
 * React hook that subscribes to live permission changes (without page refresh).
 * Re-evaluates instantly when Admin updates permissions or when ws_permissions_updated event fires.
 */
export function usePermissions(moduleName) {
  const [role, setRole] = useState(() => {
    return typeof window !== 'undefined' ? (sessionStorage.getItem('ws_active_role') || 'Owner') : 'Owner'
  })

  const [permissions, setPermissions] = useState(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = sessionStorage.getItem('ws_active_permissions')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const handleUpdate = (e) => {
      const newRole = e.detail?.role || (typeof window !== 'undefined' ? (sessionStorage.getItem('ws_active_role') || 'Owner') : 'Owner')
      let newPerms = e.detail?.perms
      if (!newPerms && typeof window !== 'undefined') {
        try {
          const stored = sessionStorage.getItem('ws_active_permissions')
          newPerms = stored ? JSON.parse(stored) : null
        } catch {
          newPerms = null
        }
      }
      setRole(newRole)
      setPermissions(newPerms)
    }

    window.addEventListener('ws_permissions_updated', handleUpdate)
    return () => window.removeEventListener('ws_permissions_updated', handleUpdate)
  }, [])

  return {
    role,
    permissions,
    canRead: moduleName ? hasModulePermission(moduleName, permissions, role) : true,
    canCreate: moduleName ? canCreateModule(moduleName, permissions, role) : true,
    canEdit: moduleName ? canEditModule(moduleName, permissions, role) : true,
    canDelete: moduleName ? canDeleteModule(moduleName, permissions, role) : true,
  }
}

