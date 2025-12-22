export default function SGTMLogo({ className = '', size = 'md', showText = true }) {
  const sizes = {
    sm: { width: 32, height: 32, text: 'text-sm' },
    md: { width: 48, height: 48, text: 'text-base' },
    lg: { width: 64, height: 64, text: 'text-lg' },
    xl: { width: 80, height: 80, text: 'text-xl' },
  }

  const { width, height, text } = sizes[size] || sizes.md

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo SVG */}
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Orange Triangle/Arrow */}
        <path 
          d="M50 10 L75 45 L25 45 Z" 
          fill="#E59A2F"
        />
        {/* Arrow stem */}
        <rect x="40" y="45" width="20" height="25" fill="#E59A2F" />
        
        {/* SGTM Text */}
        <text x="50" y="88" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif">
          SGTM
        </text>
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold text-sgtm-gray dark:text-white ${text}`}>
            SGTM
          </span>
          <span className="text-xs text-gray-500">
            HSE KPI Tracker
          </span>
        </div>
      )}
    </div>
  )
}

// Compact version for sidebar/navbar
export function SGTMLogoCompact({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-10 h-10 bg-sgtm-gray rounded-xl flex items-center justify-center">
        <svg 
          width="28" 
          height="28" 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Orange Triangle/Arrow */}
          <path 
            d="M50 5 L80 50 L20 50 Z" 
            fill="#E59A2F"
          />
          {/* Arrow stem */}
          <rect x="35" y="50" width="30" height="30" fill="#E59A2F" />
        </svg>
      </div>
      <div className="hidden lg:block">
        <p className="font-bold text-sgtm-gray text-sm">SGTM</p>
        <p className="text-xs text-gray-500">HSE KPI</p>
      </div>
    </div>
  )
}

// Icon only version
export function SGTMIcon({ className = '', size = 40 }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Orange Triangle/Arrow */}
      <path 
        d="M50 5 L85 55 L15 55 Z" 
        fill="#E59A2F"
      />
      {/* Arrow stem */}
      <rect x="35" y="55" width="30" height="35" fill="#E59A2F" />
    </svg>
  )
}
