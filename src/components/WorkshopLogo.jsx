import React from 'react'

const WorkshopLogo = ({ size = 24, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block' }}
    >
      {/* Attio-style Geometric Blocks forming a Stylized W */}
      <rect
        x="3" y="6" width="4.5" height="14" rx="2.25"
        transform="rotate(-15 3 6)"
        fill="currentColor"
      />
      <rect
        x="10.5" y="8" width="4.5" height="10" rx="2.25"
        transform="rotate(-15 10.5 8)"
        fill="currentColor"
      />
      <rect
        x="18" y="10" width="4.5" height="7" rx="2.25"
        transform="rotate(-15 18 10)"
        fill="currentColor"
      />
    </svg>
  )
}

export default WorkshopLogo
