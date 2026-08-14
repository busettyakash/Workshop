import React from 'react'

export function CollapseSidebarIcon({ size = 16, className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 18 18" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.4" 
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

export function ExpandSidebarIcon({ size = 16, className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 18 18" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.4" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="14" height="14" rx="3.5" />
      <line x1="6" y1="2" x2="6" y2="16" />
      {/* Sidebar menu lines */}
      <line x1="3.5" y1="6.5" x2="4.5" y2="6.5" />
      <line x1="3.5" y1="8.5" x2="4.5" y2="8.5" />
      {/* Right arrow */}
      <line x1="9" y1="9" x2="14" y2="9" />
      <path d="M12 6.5L14.5 9L12 11.5" />
    </svg>
  )
}
