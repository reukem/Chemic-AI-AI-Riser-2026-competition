import React from 'react';

interface OrganicMoleculeGraphicProps {
  id: string;
  category: string;
  displaySymbol: string;
  formula: string;
  valence: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export const OrganicMoleculeGraphic: React.FC<OrganicMoleculeGraphicProps> = ({
  id,
  category,
  displaySymbol,
  formula,
  valence,
  size = 'md',
  color = '#38bdf8'
}) => {
  const dim = size === 'sm' ? 44 : size === 'lg' ? 84 : 64;

  const renderGraphic = () => {
    switch (id) {
      // 1. Methyl (-CH3)
      case 'methyl':
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
            {/* Open valence prong to the left */}
            <line x1="8" y1="40" x2="28" y2="40" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="8" cy="40" r="3.5" fill="#38bdf8" className="animate-pulse" />
            {/* Carbon Center */}
            <circle cx="44" cy="40" r="14" fill="#0e7490" stroke="#22d3ee" strokeWidth="2.5" />
            <text x="44" y="45" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="monospace">C</text>
            {/* Hydrogen atoms */}
            <circle cx="44" cy="18" r="8" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
            <text x="44" y="22" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="bold">H</text>
            <circle cx="66" cy="40" r="8" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
            <text x="66" y="44" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="bold">H</text>
            <circle cx="44" cy="62" r="8" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
            <text x="44" y="66" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="bold">H</text>
          </svg>
        );

      // 2. Ethyl (-CH2-CH3)
      case 'ethyl':
        return (
          <svg viewBox="0 0 90 60" className="w-full h-full drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]">
            <line x1="6" y1="30" x2="24" y2="30" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
            <circle cx="6" cy="30" r="3" fill="#38bdf8" className="animate-pulse" />
            {/* C1 - CH2 */}
            <circle cx="36" cy="30" r="12" fill="#0369a1" stroke="#38bdf8" strokeWidth="2" />
            <text x="36" y="34" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">C</text>
            {/* C2 - CH3 */}
            <line x1="48" y1="30" x2="62" y2="30" stroke="#f8fafc" strokeWidth="2.5" />
            <circle cx="72" cy="30" r="12" fill="#0369a1" stroke="#38bdf8" strokeWidth="2" />
            <text x="72" y="34" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">C</text>
          </svg>
        );

      // 3. Phenyl / Benzene Radical (-C6H5)
      case 'phenyl':
      case 'phenol':
      case 'toluene':
      case 'aniline':
      case 'benzoic_acid':
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            {/* Hexagonal Benzene Ring */}
            <polygon 
              points="40,16 64,28 64,52 40,64 16,52 16,28" 
              fill="rgba(88, 28, 135, 0.45)" 
              stroke="#c084fc" 
              strokeWidth="2.5" 
            />
            {/* Delocalized π-electron inner resonance circle */}
            <circle cx="40" cy="40" r="14" fill="none" stroke="#e879f9" strokeWidth="1.8" strokeDasharray="3 3" />
            {/* Open valence bond prong */}
            <line x1="40" y1="16" x2="40" y2="4" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
            <circle cx="40" cy="4" r="3.5" fill="#38bdf8" className="animate-pulse" />
          </svg>
        );

      // 4. Hydroxyl (-OH)
      case 'hydroxy':
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]">
            <line x1="8" y1="40" x2="28" y2="40" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="8" cy="40" r="3.5" fill="#38bdf8" className="animate-pulse" />
            {/* Oxygen Sphere in vibrant Red/Pink */}
            <circle cx="46" cy="40" r="16" fill="#be123c" stroke="#f43f5e" strokeWidth="2.5" />
            <text x="46" y="45" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">O</text>
            {/* Lone pairs */}
            <circle cx="40" cy="20" r="2.5" fill="#f43f5e" /><circle cx="52" cy="20" r="2.5" fill="#f43f5e" />
            {/* Hydrogen */}
            <line x1="62" y1="40" x2="72" y2="40" stroke="#cbd5e1" strokeWidth="2.5" />
            <circle cx="72" cy="40" r="7" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
            <text x="72" y="43" textAnchor="middle" fill="#e2e8f0" fontSize="7" fontWeight="bold">H</text>
          </svg>
        );

      // 5. Carboxyl (-COOH)
      case 'carboxyl':
      case 'acetic_acid':
        return (
          <svg viewBox="0 0 90 70" className="w-full h-full drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]">
            <line x1="6" y1="42" x2="24" y2="42" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
            <circle cx="6" cy="42" r="3" fill="#38bdf8" className="animate-pulse" />
            {/* Carbon */}
            <circle cx="36" cy="42" r="12" fill="#047857" stroke="#34d399" strokeWidth="2" />
            <text x="36" y="46" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">C</text>
            {/* Double bonded Oxygen =O */}
            <line x1="33" y1="30" x2="48" y2="16" stroke="#f43f5e" strokeWidth="2.5" />
            <line x1="39" y1="34" x2="54" y2="20" stroke="#f43f5e" strokeWidth="2.5" />
            <circle cx="56" cy="14" r="10" fill="#be123c" stroke="#f43f5e" strokeWidth="1.5" />
            <text x="56" y="17" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">O</text>
            {/* Single bonded -OH */}
            <line x1="48" y1="42" x2="64" y2="42" stroke="#cbd5e1" strokeWidth="2" />
            <circle cx="72" cy="42" r="10" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="72" y="45" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">OH</text>
          </svg>
        );

      // 6. Amino (-NH2)
      case 'amino':
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_0_10px_rgba(147,51,234,0.6)]">
            <line x1="8" y1="40" x2="28" y2="40" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="8" cy="40" r="3.5" fill="#38bdf8" className="animate-pulse" />
            {/* Nitrogen Sphere in Blue/Violet */}
            <circle cx="46" cy="40" r="15" fill="#4338ca" stroke="#818cf8" strokeWidth="2.5" />
            <text x="46" y="45" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">N</text>
            {/* 2 Hydrogens */}
            <line x1="56" y1="28" x2="68" y2="20" stroke="#cbd5e1" strokeWidth="2" />
            <circle cx="70" cy="18" r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
            <text x="70" y="20" textAnchor="middle" fill="#ffffff" fontSize="6">H</text>
            <line x1="56" y1="52" x2="68" y2="60" stroke="#cbd5e1" strokeWidth="2" />
            <circle cx="70" cy="62" r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
            <text x="70" y="64" textAnchor="middle" fill="#ffffff" fontSize="6">H</text>
          </svg>
        );

      // 7. Formyl / Aldehyde (-CHO)
      case 'formyl':
      case 'formaldehyde':
      case 'acetaldehyde':
        return (
          <svg viewBox="0 0 80 70" className="w-full h-full drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
            <line x1="6" y1="42" x2="24" y2="42" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
            <circle cx="6" cy="42" r="3" fill="#38bdf8" className="animate-pulse" />
            <circle cx="36" cy="42" r="12" fill="#b45309" stroke="#fbbf24" strokeWidth="2" />
            <text x="36" y="46" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">C</text>
            <line x1="33" y1="30" x2="48" y2="16" stroke="#f43f5e" strokeWidth="2.5" />
            <line x1="39" y1="34" x2="54" y2="20" stroke="#f43f5e" strokeWidth="2.5" />
            <circle cx="56" cy="14" r="9" fill="#be123c" stroke="#f43f5e" strokeWidth="1.5" />
            <text x="56" y="17" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">O</text>
            <line x1="48" y1="42" x2="62" y2="42" stroke="#cbd5e1" strokeWidth="2" />
            <circle cx="68" cy="42" r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
            <text x="68" y="44" textAnchor="middle" fill="#ffffff" fontSize="6">H</text>
          </svg>
        );

      // 8. Chloro (-Cl) Halogen
      case 'chloro':
        return (
          <svg viewBox="0 0 70 70" className="w-full h-full drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]">
            <line x1="6" y1="35" x2="24" y2="35" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="6" cy="35" r="3.5" fill="#38bdf8" className="animate-pulse" />
            <circle cx="44" cy="35" r="18" fill="#15803d" stroke="#4ade80" strokeWidth="2.5" />
            <text x="44" y="40" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold">Cl</text>
          </svg>
        );

      // 9. Aspirin Synthesis Masterpiece
      case 'aspirin':
        return (
          <svg viewBox="0 0 90 90" className="w-full h-full drop-shadow-[0_0_15px_rgba(234,179,8,0.7)]">
            <polygon points="36,24 54,34 54,54 36,64 18,54 18,34" fill="rgba(161, 98, 7, 0.4)" stroke="#facc15" strokeWidth="2" />
            <circle cx="36" cy="44" r="10" fill="none" stroke="#fde047" strokeWidth="1.5" strokeDasharray="2 2" />
            <line x1="36" y1="24" x2="36" y2="8" stroke="#f43f5e" strokeWidth="2" />
            <text x="36" y="6" textAnchor="middle" fill="#f87171" fontSize="7" fontWeight="bold">COOH</text>
            <line x1="54" y1="34" x2="72" y2="28" stroke="#38bdf8" strokeWidth="2" />
            <text x="76" y="29" textAnchor="left" fill="#67e8f9" fontSize="6" fontWeight="bold">OCOCH₃</text>
          </svg>
        );

      // 10. Ethyl Acetate (Sweet Pear Drops)
      case 'ethyl_acetate':
        return (
          <svg viewBox="0 0 90 60" className="w-full h-full drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]">
            <text x="14" y="34" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">CH₃</text>
            <line x1="26" y1="30" x2="36" y2="30" stroke="#f8fafc" strokeWidth="2" />
            <text x="44" y="34" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold">COO</text>
            <line x1="54" y1="30" x2="64" y2="30" stroke="#f8fafc" strokeWidth="2" />
            <text x="76" y="34" textAnchor="middle" fill="#a78bfa" fontSize="10" fontWeight="bold">C₂H₅</text>
            <circle cx="44" cy="18" r="3" fill="#f43f5e" />
          </svg>
        );

      // Default Fallback
      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <span className="text-xl font-black font-mono tracking-tight text-white drop-shadow-md">
              {displaySymbol}
            </span>
            <span className="text-[9px] font-mono font-bold text-cyan-300 tracking-tighter truncate max-w-[70px]">
              {formula}
            </span>
          </div>
        );
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center" 
      style={{ width: dim, height: dim }}
    >
      {renderGraphic()}

      {/* Valence Indicator LED Dots at bottom of card */}
      {valence > 0 && (
        <div className="absolute -bottom-1 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded-full border border-cyan-800/60 shadow-sm pointer-events-none">
          {Array.from({ length: valence }).map((_, idx) => (
            <span 
              key={idx} 
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse" 
              title={`${valence} Open Valence Bonds Available`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
