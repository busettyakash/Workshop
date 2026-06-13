// Route path constants
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  PRODUCTS: '/products',
  PRODUCTS_ADD: '/products/add',
  PRODUCTS_EDIT: '/products/edit/:id',
  BILLING: '/billing',
  BILLING_ADD: '/billing/add',
  BILLING_EDIT: '/billing/edit/:id',
  CUSTOMERS: '/customers',
  CUSTOMERS_ADD: '/customers/add',
  CUSTOMERS_EDIT: '/customers/edit/:id',
  CATEGORIES: '/categories',
  REPORTS: '/reports',
  HISTORY: '/history',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  TASKS: '/tasks',
  NOTES: '/notes',
  EMAILS: '/emails',
  CALLS: '/calls',
  SEQUENCES: '/sequences',
  CATALOG: '/catalog',
  CONTACTS: '/contacts',
  PAID: '/paid',
  UNPAID: '/unpaid',
  IMPORT_STOCK: '/import-stock',
  IMPORT_STOCK_ADD: '/import-stock/add',
  IMPORT_STOCK_EDIT: '/import-stock/edit/:id',
}

// Navigation items for sidebar
export const MAIN_NAV = [
  { label: 'Home',          icon: 'Home',         path: ROUTES.DASHBOARD },
  { label: 'Notifications', icon: 'Bell',         path: ROUTES.NOTIFICATIONS, badge: 3 },
  { label: 'Tasks',         icon: 'ClipboardList',path: null },
  { label: 'Notes',         icon: 'FileText',     path: null },
  { label: 'Emails',        icon: 'Mail',         path: null },
  { label: 'Reports',       icon: 'BarChart3',    path: ROUTES.REPORTS },
  { label: 'Automations',   icon: 'Workflow',     path: null },
]

export const RECORDS_NAV = [
  { label: 'Products',    icon: 'Package',  path: ROUTES.PRODUCTS },
  { label: 'Billing',     icon: 'Receipt',  path: ROUTES.BILLING },
  { label: 'Customers',   icon: 'Users',    path: ROUTES.CUSTOMERS },
  { label: 'Categories',  icon: 'Tag',      path: ROUTES.CATEGORIES },
  { label: 'Bill History',icon: 'History',  path: ROUTES.HISTORY },
]

export const SETTINGS_NAV = [
  { label: 'Shop Profile', icon: 'Building2',  path: null },
  { label: 'Preferences',  icon: 'Settings',   path: ROUTES.SETTINGS },
]

// Onboarding steps
export const ONBOARDING_STEPS = [
  { step: 1, title: 'Create your workspace',    description: 'Set up your shop profile' },
  { step: 2, title: 'Add your products',        description: 'Import or add products' },
  { step: 3, title: 'Set up billing',           description: 'Configure GST & invoicing' },
  { step: 4, title: 'Invite your team',         description: 'Bring collaborators aboard' },
  { step: 5, title: 'Connect integrations',     description: 'Link payment & data sources' },
]

export const DEMO_STATS = []
export const DEMO_PRODUCTS = []
export const DEMO_CUSTOMERS = []

export const STATUS_COLORS = {
  'In Stock':    { bg: '#dcfce7', text: '#166534' },
  'Low Stock':   { bg: '#fef3c7', text: '#92400e' },
  'Out of Stock':{ bg: '#fee2e2', text: '#991b1b' },
  'Paid':        { bg: '#dcfce7', text: '#166534' },
  'Pending':     { bg: '#fef3c7', text: '#92400e' },
  'Cancelled':   { bg: '#fee2e2', text: '#991b1b' },
}
