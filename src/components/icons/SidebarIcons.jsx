import React from 'react'

export function CollapseSidebarIcon({ size = 16, strokeWidth = 1.4, className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 18 18" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="14" height="14" rx="3.5" />
      <line x1="6.5" y1="2" x2="6.5" y2="16" />
      <path d="M12.5 6.5L9.5 9L12.5 11.5" />
    </svg>
  )
}

export function ExpandSidebarIcon({ size = 16, strokeWidth = 1.4, className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 18 18" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="14" height="14" rx="3.5" />
      <line x1="6" y1="2" x2="6" y2="16" />
      <line x1="3.5" y1="6.5" x2="4.5" y2="6.5" />
      <line x1="3.5" y1="8.5" x2="4.5" y2="8.5" />
      <line x1="9" y1="9" x2="14" y2="9" />
      <path d="M12 6.5L14.5 9L12 11.5" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   ATTIO-STYLE SIGNATURE SIDEBAR NAVIGATION ICONS
   Design parameters: 16x16 viewBox, 1.35-1.4 strokeWidth,
   smooth rounded squircle geometry, refined line details.
───────────────────────────────────────────────────────────── */

/** Attio Home: Peaked squircle with inner bottom dash */
export function HomeIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 6.8L8 2.5l5.5 4.3v5.2a1.8 1.8 0 0 1-1.8 1.8h-7.4a1.8 1.8 0 0 1-1.8-1.8V6.8z" />
      <line x1="6.2" y1="10.8" x2="9.8" y2="10.8" />
    </svg>
  )
}

/** Attio Tasks: Squircle badge with checkmark */
export function TasksIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="3.5" />
      <path d="M5.5 8.2l1.8 1.8 3.5-3.8" />
    </svg>
  )
}

/** Attio Notes: Clean folded sheet outline (no inner text lines) */
export function NotesIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 2.5h5.5l3.5 3.5V13a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 13V4A1.5 1.5 0 0 1 4 2.5z" />
      <path d="M9.5 2.5v3.5h3.5" />
    </svg>
  )
}

/** Attio Emails: Rounded envelope with V-flap */
export function EmailsIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3.5" width="12" height="9" rx="2.5" />
      <path d="M2.5 5.5l5.5 3.5 5.5-3.5" />
    </svg>
  )
}

/** Attio Calls: Rounded video camera body and lens */
export function CallsIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4.5" width="8.2" height="7" rx="2.5" />
      <path d="M10.2 7.2l3.3-2v5.6l-3.3-2" />
    </svg>
  )
}

/** Attio Reports: Squircle container with 3 vertical bars */
export function ReportsIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="3.5" />
      <line x1="5.5" y1="9" x2="5.5" y2="10.5" />
      <line x1="8" y1="6" x2="8" y2="10.5" />
      <line x1="10.5" y1="7.5" x2="10.5" y2="10.5" />
    </svg>
  )
}

/** Attio Sequences / Send: Sleek paper airplane pointing top-right */
export function SequencesIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 7.2l11-4.7-4.7 11-2.5-4.3-3.8-2z" />
    </svg>
  )
}

/** Attio Workflows / Automations: Two connected nodes in a loop */
export function WorkflowsIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="4.5" cy="4.5" r="1.6" />
      <circle cx="11.5" cy="11.5" r="1.6" />
      <path d="M6.5 4.5h2.5a2 2 0 0 1 2 2v1.5" />
      <path d="M9.5 11.5h-2.5a2 2 0 0 1-2-2v-1.5" />
    </svg>
  )
}

/** Records / Folder Icon */
export function FolderIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 4.5a1.5 1.5 0 0 1 1.5-1.5h2.5l1.5 1.5h4a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5V4.5z" />
    </svg>
  )
}

/** Clean Billing Receipt (Receipt document outline with lines, no dollar sign) */
export function BillingIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="2.5" width="10" height="11" rx="2" />
      <line x1="5.5" y1="5.5" x2="10.5" y2="5.5" />
      <line x1="5.5" y1="8" x2="10.5" y2="8" />
      <line x1="5.5" y1="10.5" x2="8.5" y2="10.5" />
    </svg>
  )
}

/** Products / Inventory Package Box */
export function ProductsIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2.5L13.5 5.5v5L8 13.5 2.5 10.5v-5L8 2.5z" />
      <path d="M8 8v5.5M8 8L2.5 5.5M8 8l5.5-2.5" />
    </svg>
  )
}

/** People / Contacts User Profile */
export function PeopleIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
    </svg>
  )
}

/** Price History / Clock */
export function PriceHistoryIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="5.5" />
      <polyline points="8,5 8,8 10,9.5" />
    </svg>
  )
}

/** Quotes / Estimates Scroll Document */
export function QuotesIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 2.5z" />
      <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" />
    </svg>
  )
}

/** Orders / Shopping Bag */
export function OrdersIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="5" width="10" height="8.5" rx="2" />
      <path d="M5.5 5V3.8a2.5 2.5 0 0 1 5 0V5" />
    </svg>
  )
}

/** Paid / Settled Checkmark Circle */
export function PaidIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.5 8l1.8 1.8 3.2-3.6" />
    </svg>
  )
}

/** Unpaid / Pending Cross Circle */
export function UnpaidIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M6 6l4 4M10 6l-4 4" />
    </svg>
  )
}

/** Import Stock Upload Arrow */
export function ImportStockIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2.5v7.5M5.5 5.5L8 2.5l2.5 3M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
    </svg>
  )
}

/** Profit Margin / Percent Trend Up Icon */
export function ProfitMarginIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 11.5L6.5 7.5L9.5 10.5L13.5 4.5" />
      <path d="M10 4.5h3.5v3.5" />
    </svg>
  )
}

/** Settings Gear */
export function SettingsIcon({ size = 16, strokeWidth = 1.35, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1" />
    </svg>
  )
}
