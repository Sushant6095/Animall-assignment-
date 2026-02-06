'use client';

import React from 'react';

interface CowIconProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/**
 * Animated Cow Icon Component
 * SVG cow illustration for the milking session app
 */
export default function CowIcon({ size = 120, className = '', animated = false }: CowIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={{
        animation: animated ? 'bounce 2s ease-in-out infinite' : 'none',
      }}
    >
      {/* Cow Body */}
      <ellipse cx="100" cy="120" rx="60" ry="50" fill="#8B4513" />
      <ellipse cx="100" cy="120" rx="50" ry="40" fill="#A0522D" />
      
      {/* Cow Head */}
      <ellipse cx="100" cy="70" rx="45" ry="40" fill="#8B4513" />
      <ellipse cx="100" cy="70" rx="38" ry="35" fill="#A0522D" />
      
      {/* Cow Spots */}
      <ellipse cx="80" cy="100" rx="12" ry="15" fill="#FFFFFF" />
      <ellipse cx="120" cy="110" rx="10" ry="12" fill="#FFFFFF" />
      <ellipse cx="90" cy="130" rx="8" ry="10" fill="#FFFFFF" />
      <ellipse cx="115" cy="140" rx="9" ry="11" fill="#FFFFFF" />
      
      {/* Ears */}
      <ellipse cx="70" cy="60" rx="12" ry="18" fill="#8B4513" />
      <ellipse cx="130" cy="60" rx="12" ry="18" fill="#8B4513" />
      <ellipse cx="70" cy="60" rx="8" ry="12" fill="#A0522D" />
      <ellipse cx="130" cy="60" rx="8" ry="12" fill="#A0522D" />
      
      {/* Eyes */}
      <circle cx="88" cy="68" r="6" fill="#000000" />
      <circle cx="112" cy="68" r="6" fill="#000000" />
      <circle cx="90" cy="66" r="2" fill="#FFFFFF" />
      <circle cx="114" cy="66" r="2" fill="#FFFFFF" />
      
      {/* Nose */}
      <ellipse cx="100" cy="82" rx="8" ry="6" fill="#000000" />
      <ellipse cx="95" cy="82" rx="2" ry="2" fill="#FFFFFF" />
      <ellipse cx="105" cy="82" rx="2" ry="2" fill="#FFFFFF" />
      
      {/* Horns */}
      <path d="M 75 50 Q 70 40 75 35 Q 80 40 75 50" fill="#654321" />
      <path d="M 125 50 Q 130 40 125 35 Q 120 40 125 50" fill="#654321" />
      
      {/* Tail */}
      <path d="M 40 130 Q 20 120 15 100 Q 20 110 30 125" stroke="#8B4513" strokeWidth="4" fill="none" />
      <path d="M 15 100 Q 10 90 8 85" stroke="#8B4513" strokeWidth="3" fill="none" />
    </svg>
  );
}
