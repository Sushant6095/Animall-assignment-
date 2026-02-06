'use client';

import React from 'react';

/**
 * Grass decoration component for farm theme
 */
export default function GrassDecoration() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '60px',
      overflow: 'hidden',
      zIndex: 0,
    }}>
      <svg
        width="100%"
        height="60"
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* Grass blades */}
        <path
          d="M0,60 L0,50 Q10,45 20,50 T40,50 L40,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M50,60 L50,48 Q55,43 60,48 T70,48 L70,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M100,60 L100,52 Q105,47 110,52 T120,52 L120,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M150,60 L150,49 Q155,44 160,49 T170,49 L170,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M200,60 L200,51 Q205,46 210,51 T220,51 L220,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M250,60 L250,48 Q255,43 260,48 T270,48 L270,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M300,60 L300,50 Q305,45 310,50 T320,50 L320,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M350,60 L350,49 Q355,44 360,49 T370,49 L370,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M400,60 L400,52 Q405,47 410,52 T420,52 L420,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M450,60 L450,48 Q455,43 460,48 T470,48 L470,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M500,60 L500,51 Q505,46 510,51 T520,51 L520,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M550,60 L550,49 Q555,44 560,49 T570,49 L570,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M600,60 L600,50 Q605,45 610,50 T620,50 L620,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M650,60 L650,48 Q655,43 660,48 T670,48 L670,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M700,60 L700,52 Q705,47 710,52 T720,52 L720,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M750,60 L750,49 Q755,44 760,49 T770,49 L770,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M800,60 L800,51 Q805,46 810,51 T820,51 L820,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M850,60 L850,48 Q855,43 860,48 T870,48 L870,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M900,60 L900,50 Q905,45 910,50 T920,50 L920,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M950,60 L950,49 Q955,44 960,49 T970,49 L970,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M1000,60 L1000,52 Q1005,47 1010,52 T1020,52 L1020,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M1050,60 L1050,48 Q1055,43 1060,48 T1070,48 L1070,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        <path
          d="M1100,60 L1100,51 Q1105,46 1110,51 T1120,51 L1120,60 Z"
          fill="#7CB342"
          opacity="0.8"
        />
        <path
          d="M1150,60 L1150,49 Q1155,44 1160,49 T1170,49 L1170,60 Z"
          fill="#8BC34A"
          opacity="0.7"
        />
        {/* Base grass layer */}
        <rect x="0" y="55" width="1200" height="5" fill="#66BB6A" opacity="0.9" />
      </svg>
    </div>
  );
}
