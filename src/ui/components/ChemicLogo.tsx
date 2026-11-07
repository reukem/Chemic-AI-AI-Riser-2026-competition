import React from 'react';

interface ChemicLogoProps {
  size?: 'hero' | 'nav' | 'icon' | 'badge';
  showSubtitle?: boolean;
  className?: string;
  isVi?: boolean;
}

/**
 * ChemicLogo - Signature Quantum Flask & Valence Vector Mark
 * Refined Sci-Fi aesthetic: Precision cybernetic geometry, orbital valences,
 * ionized chemical flask silhouette with fusion spark and liquid meniscus.
 */
export const ChemicLogo: React.FC<ChemicLogoProps> = ({
  size = 'hero',
  showSubtitle = true,
  className = '',
  isVi = false
}) => {
  // SVG Icon Mark
  const renderIcon = (iconSize: number) => (
    <div className="relative shrink-0 flex items-center justify-center select-none" style={{ width: iconSize, height: iconSize }}>
      {/* Ambient Pulsing Aura */}
      <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl animate-pulse pointer-events-none" />

      <svg
        viewBox="0 0 100 100"
        className="w-full h-full relative z-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="chemicCyanSheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#67e8f9" />
            <stop offset="70%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>

          <linearGradient id="flaskLiquid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#0891b2" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0e3b5e" stopOpacity="0.98" />
          </linearGradient>

          <linearGradient id="orbitalRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.9" />
          </linearGradient>

          <filter id="coreGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagonal Shield with Precision Notches */}
        <polygon
          points="50,4 90,27 90,73 50,96 10,73 10,27"
          stroke="url(#chemicCyanSheen)"
          strokeWidth="1.6"
          strokeDasharray="8 3 24 3"
          strokeOpacity="0.65"
          className="transition-all"
        />

        {/* Precision Tech Reticle Ticks at Vertices */}
        <line x1="50" y1="1" x2="50" y2="7" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        <line x1="93" y1="25" x2="88" y2="28" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        <line x1="93" y1="75" x2="88" y2="72" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="99" x2="50" y2="93" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        <line x1="7" y1="75" x2="12" y2="72" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        <line x1="7" y1="25" x2="12" y2="28" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />

        {/* Dual Quantum Electron Orbitals (Tilted Ellipses) */}
        <g className="origin-center" style={{ transformOrigin: '50px 52px' }}>
          {/* Orbital 1: Tilted +35deg */}
          <ellipse
            cx="50"
            cy="52"
            rx="36"
            ry="13"
            stroke="url(#orbitalRingGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 2 12 2"
            transform="rotate(35 50 52)"
            strokeOpacity="0.75"
          />
          {/* Orbital 2: Tilted -35deg */}
          <ellipse
            cx="50"
            cy="52"
            rx="36"
            ry="13"
            stroke="url(#orbitalRingGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 2 12 2"
            transform="rotate(-35 50 52)"
            strokeOpacity="0.75"
          />

          {/* Orbiting Quantum Electron Nodes */}
          <circle cx="78" cy="34" r="2.2" fill="#e0f2fe" filter="url(#coreGlow)" />
          <circle cx="22" cy="70" r="2.2" fill="#38bdf8" filter="url(#coreGlow)" />
          <circle cx="24" cy="36" r="2" fill="#a5f3fc" filter="url(#coreGlow)" />
          <circle cx="76" cy="68" r="2" fill="#22d3ee" filter="url(#coreGlow)" />
        </g>

        {/* Central Precision Erlenmeyer Flask Silhouette */}
        <g id="flask-body">
          {/* Flask Lip & Rim */}
          <rect x="44" y="20" width="12" height="3" rx="1.5" fill="#e0f2fe" stroke="#0891b2" strokeWidth="0.8" />
          
          {/* Flask Glass Outline (Neck + Conical Base) */}
          <path
            d="M46 23 L46 36 L27 68 C25 71.5 27.5 76 31.5 76 L68.5 76 C72.5 76 75 71.5 73 68 L54 36 L54 23 Z"
            stroke="url(#chemicCyanSheen)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill="rgba(8, 28, 48, 0.45)"
          />

          {/* Meniscus / Chemical Liquid Fill */}
          <path
            d="M34 56 Q50 52 66 56 L72 68.5 C73.2 71 71.5 74 68 74 L32 74 C28.5 74 26.8 71 28 68.5 Z"
            fill="url(#flaskLiquid)"
          />
          
          {/* Liquid Surface Highlight */}
          <path
            d="M34 56 Q50 52 66 56"
            stroke="#e0f2fe"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeOpacity="0.9"
          />

          {/* Quantum Energy Bubbles / Particles inside liquid */}
          <circle cx="44" cy="67" r="1.4" fill="#a5f3fc" opacity="0.8" />
          <circle cx="56" cy="64" r="1.8" fill="#e0f2fe" opacity="0.9" />
          <circle cx="48" cy="60" r="1.2" fill="#67e8f9" opacity="0.75" />

          {/* Central 4-Point AI Fusion Spark */}
          <g transform="translate(50, 50)" filter="url(#coreGlow)">
            <path
              d="M0 -6 Q0 0 6 0 Q0 0 0 6 Q0 0 -6 0 Q0 0 0 -6 Z"
              fill="#ffffff"
            />
            <circle cx="0" cy="0" r="1.5" fill="#22d3ee" />
          </g>
        </g>
      </svg>
    </div>
  );

  // Icon only
  if (size === 'icon') {
    return <div className={className}>{renderIcon(40)}</div>;
  }

  // Nav version (compact, horizontal)
  if (size === 'nav') {
    return (
      <div className={`flex items-center gap-3 select-none ${className}`}>
        {renderIcon(38)}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-lg tracking-[0.14em] text-white font-mono leading-none">
              CHEMIC
            </span>
            <span className="text-cyan-400 font-mono text-sm leading-none opacity-80">·</span>
            <span className="px-1.5 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-400/50 text-cyan-300 font-mono font-black text-[10px] tracking-widest leading-none shadow-[0_0_10px_rgba(6,182,212,0.35)]">
              AI
            </span>
          </div>
          {showSubtitle && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse" />
              <span className="text-[8.5px] text-cyan-300/80 font-mono font-bold tracking-[0.22em] uppercase leading-none">
                {isVi ? 'PHÒNG LAB LƯỢNG TỬ // V2.5' : 'QUANTUM REALITY // V2.5'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Badge version (pill style)
  if (size === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 backdrop-blur-md select-none ${className}`}>
        {renderIcon(24)}
        <span className="font-mono font-bold text-xs text-white tracking-wider">CHEMIC<span className="text-cyan-400">·AI</span></span>
      </div>
    );
  }

  // Hero version (Main Menu centerpiece)
  return (
    <div className={`flex items-center gap-4 select-none ${className}`}>
      {renderIcon(68)}
      <div className="flex flex-col">
        {/* Category kicker */}
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <span className="text-cyan-400 font-mono text-[10.5px] tracking-[0.32em] uppercase font-bold opacity-90">
            {isVi ? 'DỰ ÁN PHÒNG THÍ NGHIỆM LƯỢNG TỬ' : 'QUANTUM REALITY LAB // V2.5'}
          </span>
        </div>

        {/* Main Wordmark */}
        <div className="flex items-center gap-2">
          <span className="text-3xl md:text-4xl lg:text-[42px] font-black tracking-[0.14em] uppercase text-white font-mono leading-none drop-shadow-[0_2px_15px_rgba(0,0,0,0.8)]">
            CHEMIC
          </span>
          <span className="text-cyan-400 font-mono text-2xl font-light opacity-80 leading-none">·</span>
          <span className="relative px-2.5 py-1 rounded-xl bg-gradient-to-br from-cyan-950/90 to-[#021020]/90 border border-cyan-400/60 text-cyan-300 font-mono font-black text-xl md:text-2xl tracking-widest leading-none shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            AI
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-75" />
          </span>
        </div>

        {/* Engine spec sub-tag */}
        {showSubtitle && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-300/90 font-mono tracking-[0.2em] uppercase font-semibold">
              {isVi ? 'MÔ PHỎNG ĐỘNG HỌC & CẤU TRÚC PHÂN TỬ 3D' : 'NEURAL MOLECULAR DYNAMICS & VIRTUAL LABORATORY'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChemicLogo;
