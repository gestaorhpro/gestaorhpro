
import React from 'react';

interface LogoProps {
  className?: string;
  textClassName?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10", textClassName = "text-2xl", showText = true }) => {
  return (
    <div className="flex items-center gap-3 select-none">
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Abstract Bars / People */}
        <rect x="15" y="35" width="18" height="45" rx="8" fill="currentColor" className="text-slate-600 dark:text-slate-400" />
        <rect x="41" y="15" width="18" height="65" rx="8" fill="#f97316" />
        <rect x="67" y="25" width="18" height="55" rx="8" fill="currentColor" className="text-slate-600 dark:text-slate-400" />
        
        {/* Unity Curve */}
        <path 
          d="M15 88 C 35 95, 65 95, 85 88" 
          stroke="#f97316" 
          strokeWidth="5" 
          strokeLinecap="round" 
          opacity="0.8" 
        />
      </svg>
      {showText && (
        <h1 className={`${textClassName} font-bold text-primary-500 font-sans tracking-tight`}>
          GestãoRH <span className="text-slate-800 dark:text-white">Pro</span>
        </h1>
      )}
    </div>
  );
};

export default Logo;
