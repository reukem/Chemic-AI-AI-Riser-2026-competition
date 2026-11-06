import React, { useEffect, useRef } from 'react';

interface SmokePlume {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  phase: number;
  pulseSpeed: number;
}

interface PeriodicTile {
  symbol: string;
  number: number;
  name: string;
  mass: string;
  oxidation: string;
  x: number;
  y: number;
  z: number; // Depth layer 0.35 (far) to 1.0 (near)
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  fadePhase: number;
  fadeSpeed: number;
}

interface FloatingFormulaItem {
  text: string;
  subText?: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  phase: number;
  fontSize: number;
  isSerif: boolean;
}

interface SkeletalMolecule {
  type: 'benzene' | 'naphthalene' | 'purine' | 'salicylate' | 'tetrahedral';
  label: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  angle: number;
  rotSpeed: number;
  scale: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
}

interface TrailSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  decay: number;
  r: number;
  g: number;
  b: number;
  rotation: number;
}

const ELEMENT_TILES_DATA = [
  { symbol: 'Br', number: 35, name: 'Bromine', mass: '79.904', oxidation: '-1, +1, +5', r: 16, g: 185, b: 129 },   // Heisenberg Emerald
  { symbol: 'Ba', number: 56, name: 'Barium', mass: '137.33', oxidation: '+2', r: 5, g: 150, b: 105 },           // Deep Viridian Green
  { symbol: 'Cu', number: 29, name: 'Copper', mass: '63.546', oxidation: '+1, +2', r: 6, g: 182, b: 212 },       // Copper Sulfate Cyan
  { symbol: 'Au', number: 79, name: 'Gold', mass: '196.97', oxidation: '+1, +3', r: 245, g: 158, b: 11 },        // Aurum Gold
  { symbol: 'Mn', number: 25, name: 'Manganese', mass: '54.938', oxidation: '+2, +4, +7', r: 168, g: 85, b: 247 }, // Permanganate Violet
  { symbol: 'Cr', number: 24, name: 'Chromium', mass: '51.996', oxidation: '+2, +3, +6', r: 249, g: 115, b: 22 }, // Dichromate Orange
  { symbol: 'C',  number: 6,  name: 'Carbon', mass: '12.011', oxidation: '-4, +2, +4', r: 20, g: 184, b: 166 },  // Organic Teal
  { symbol: 'Na', number: 11, name: 'Sodium', mass: '22.990', oxidation: '+1', r: 234, g: 179, b: 8 },           // D-Line Yellow
  { symbol: 'Co', number: 27, name: 'Cobalt', mass: '58.933', oxidation: '+2, +3', r: 59, g: 130, b: 246 },      // Cobalt Blue
  { symbol: 'Ag', number: 47, name: 'Silver', mass: '107.87', oxidation: '+1', r: 148, g: 163, b: 184 },         // Silver Mirror
  { symbol: 'K',  number: 19, name: 'Potassium', mass: '39.098', oxidation: '+1', r: 192, g: 132, b: 252 },      // Lilac Flame
  { symbol: 'Pt', number: 78, name: 'Platinum', mass: '195.08', oxidation: '+2, +4', r: 34, g: 211, b: 238 },    // Catalyst Cyan
  { symbol: 'Fe', number: 26, name: 'Iron', mass: '55.845', oxidation: '+2, +3', r: 239, g: 68, b: 68 },         // Ferric Crimson
  { symbol: 'I',  number: 53, name: 'Iodine', mass: '126.90', oxidation: '-1, +5, +7', r: 217, g: 70, b: 239 }   // Sublimation Magenta
];

const CHEMICAL_FORMULAS_DATA = [
  { text: 'C₁₀H₁₅N', subText: 'Molar Mass: 149.23 g/mol', isSerif: true },
  { text: 'C₈H₁₀N₄O₂', subText: '1,3,7-Trimethylxanthine', isSerif: true },
  { text: 'ΔG° = ΔH° − TΔS°', subText: 'Gibbs Free Energy', isSerif: false },
  { text: 'k = A · e^(−Eₐ / RT)', subText: 'Arrhenius Kinetics', isSerif: false },
  { text: 'pH = −log₁₀[H₃O⁺]', subText: 'Sørensen Acidity Scale', isSerif: false },
  { text: '109.5° sp³  •  120° sp²', subText: 'VSEPR Hybridization', isSerif: false },
  { text: 'Fe₃O₄ + 8HCl → FeCl₂ + 2FeCl₃ + 4H₂O', subText: 'Redox Dissolution', isSerif: false },
  { text: '1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰ 4s²', subText: 'Quantum Electron Config', isSerif: false },
  { text: 'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O', subText: 'Fischer Esterification', isSerif: false },
  { text: 'Kₛₚ = [Pb²⁺][I⁻]² = 7.1 × 10⁻⁹', subText: 'Golden Rain Equilibrium', isSerif: false },
  { text: 'E = E° − (RT / nF) ln Q', subText: 'Nernst Potential', isSerif: true },
  { text: 'C₉H₈O₄', subText: '2-Acetoxybenzoic Acid', isSerif: true },
  { text: '2MnO₄⁻ + 5C₂O₄²⁻ + 16H⁺ → 2Mn²⁺ + 10CO₂↑', subText: 'Permanganate Titration', isSerif: false },
  { text: 'A = ε · b · c   (T = 10⁻ᴬ)', subText: 'Beer–Lambert Optical Law', isSerif: false },
  { text: '[Ag(NH₃)₂]⁺ + R-CHO → 2Ag↓', subText: 'Tollens Silver Mirror', isSerif: false },
  { text: 'ΔH°_comb = −890.3 kJ/mol', subText: 'Exothermic Enthalpy', isSerif: false }
];

const VIBRANT_PALETTE = [
  { r: 16, g: 185, b: 129 },  // Emerald Green
  { r: 245, g: 158, b: 11 },  // Amber Gold
  { r: 6, g: 182, b: 212 },   // Cyan
  { r: 168, g: 85, b: 247 },  // Violet
  { r: 236, g: 72, b: 153 },  // Magenta
  { r: 52, g: 211, b: 153 }   // Mint Neon
];

export const BreakingBadChemistryBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, rawX: 0, rawY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;
    let lastTrailTime = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const smokePlumes: SmokePlume[] = [];
    const periodicTiles: PeriodicTile[] = [];
    const floatingFormulas: FloatingFormulaItem[] = [];
    const skeletalMolecules: SkeletalMolecule[] = [];
    const trailSparks: TrailSpark[] = [];

    const drawHexagonRing = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      radius: number,
      doubleBonds: boolean = true
    ) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.stroke();

      if (doubleBonds) {
        const innerR = radius * 0.76;
        c.beginPath();
        for (let i = 0; i < 6; i += 2) {
          const a1 = (i * Math.PI) / 3 + 0.08;
          const a2 = ((i + 1) * Math.PI) / 3 - 0.08;
          c.moveTo(cx + Math.cos(a1) * innerR, cy + Math.sin(a1) * innerR);
          c.lineTo(cx + Math.cos(a2) * innerR, cy + Math.sin(a2) * innerR);
        }
        c.stroke();
      }
    };

    const drawSkeletalStructure = (c: CanvasRenderingContext2D, mol: SkeletalMolecule, px: number, py: number) => {
      c.save();
      c.translate(px, py);
      c.rotate(mol.angle);
      c.scale(mol.scale, mol.scale);

      const strokeColor = `rgba(${mol.r}, ${mol.g}, ${mol.b}, ${mol.alpha})`;
      const glowColor = `rgba(${mol.r}, ${mol.g}, ${mol.b}, ${mol.alpha * 0.35})`;
      c.strokeStyle = strokeColor;
      c.fillStyle = strokeColor;
      c.lineWidth = 2.0;
      c.lineCap = 'round';
      c.lineJoin = 'round';

      // Subtle outer glow pass
      c.shadowColor = glowColor;
      c.shadowBlur = 10;

      const R = 32;

      if (mol.type === 'benzene') {
        drawHexagonRing(c, 0, 0, R, true);
        // Substituent prongs
        c.beginPath();
        c.moveTo(R, 0);
        c.lineTo(R + 22, 0);
        c.moveTo(-R * 0.5, -R * 0.866);
        c.lineTo(-R * 0.85, -R * 1.45);
        c.stroke();
        c.font = 'bold 12px monospace';
        c.fillText('OH', R + 25, 4);
        c.fillText('CH₃', -R * 1.25, -R * 1.5);
      } else if (mol.type === 'naphthalene') {
        const offset = R * Math.sqrt(3) * 0.5;
        drawHexagonRing(c, -offset, 0, R, true);
        drawHexagonRing(c, offset, 0, R, true);
        c.font = 'bold 11px monospace';
        c.fillText('C₁₀H₈', -16, R + 22);
      } else if (mol.type === 'purine') {
        drawHexagonRing(c, -15, 0, R, true);
        // Fused 5-membered imidazole ring
        c.beginPath();
        const x0 = -15 + Math.cos(Math.PI / 6) * R;
        const y0 = Math.sin(Math.PI / 6) * R;
        const x1 = -15 + Math.cos(-Math.PI / 6) * R;
        const y1 = Math.sin(-Math.PI / 6) * R;
        c.moveTo(x1, y1);
        c.lineTo(x1 + 26, y1 + 8);
        c.lineTo(x1 + 36, 0);
        c.lineTo(x0 + 26, y0 - 8);
        c.lineTo(x0, y0);
        c.stroke();
        c.font = 'bold 11px monospace';
        c.fillText('N', x1 + 26, y1 + 20);
        c.fillText('O', -15, -R - 12);
      } else if (mol.type === 'salicylate') {
        drawHexagonRing(c, 0, 0, R, true);
        // Carboxyl branch
        c.beginPath();
        c.moveTo(R, 0);
        c.lineTo(R + 20, -14);
        c.lineTo(R + 40, -4);
        c.moveTo(R + 18, -14);
        c.lineTo(R + 18, -32);
        c.stroke();
        c.font = 'bold 11px monospace';
        c.fillText('O', R + 14, -36);
        c.fillText('OH', R + 43, 0);
      } else if (mol.type === 'tetrahedral') {
        // Central chiral carbon with 4 tetrahedral bonds
        c.beginPath();
        c.arc(0, 0, 5, 0, Math.PI * 2);
        c.fill();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * R * 1.15, Math.sin(a) * R * 1.15);
          c.stroke();
          c.beginPath();
          c.arc(Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.25, 3.5, 0, Math.PI * 2);
          c.fill();
        }
        c.font = '10px monospace';
        c.fillText('109.5°', 12, -4);
      }

      if (mol.label) {
        c.font = '10px monospace';
        c.fillStyle = `rgba(${mol.r}, ${mol.g}, ${mol.b}, ${mol.alpha * 0.75})`;
        c.fillText(mol.label, -R, R + 32);
      }

      c.restore();
    };

    const drawPeriodicTile = (c: CanvasRenderingContext2D, tile: PeriodicTile, px: number, py: number, pulseAlpha: number) => {
      const size = 66 * tile.z;
      const half = size / 2;
      c.save();
      c.translate(px, py);

      const finalAlpha = Math.max(0.08, Math.min(0.85, pulseAlpha));

      // Glowing chemical box backdrop (Breaking Bad style square element tile)
      const bgGrad = c.createLinearGradient(-half, -half, half, half);
      bgGrad.addColorStop(0, `rgba(${tile.r}, ${tile.g}, ${tile.b}, ${finalAlpha * 0.38})`);
      bgGrad.addColorStop(0.6, `rgba(${Math.floor(tile.r * 0.35)}, ${Math.floor(tile.g * 0.35)}, ${Math.floor(tile.b * 0.35)}, ${finalAlpha * 0.55})`);
      bgGrad.addColorStop(1, `rgba(4, 15, 25, ${finalAlpha * 0.7})`);

      c.fillStyle = bgGrad;
      c.strokeStyle = `rgba(${tile.r}, ${tile.g}, ${tile.b}, ${finalAlpha * 0.95})`;
      c.lineWidth = Math.max(1.2, 2.0 * tile.z);

      c.beginPath();
      c.roundRect(-half, -half, size, size, 6 * tile.z);
      c.fill();
      c.stroke();

      // Inner subtle frame
      const inset = 3.5 * tile.z;
      c.strokeStyle = `rgba(255, 255, 255, ${finalAlpha * 0.22})`;
      c.lineWidth = 0.75;
      c.beginPath();
      c.roundRect(-half + inset, -half + inset, size - inset * 2, size - inset * 2, 4 * tile.z);
      c.stroke();

      // Atomic Number (Top-Left)
      c.fillStyle = `rgba(255, 255, 255, ${finalAlpha * 0.9})`;
      c.font = `bold ${Math.round(9.5 * tile.z)}px monospace`;
      c.textAlign = 'left';
      c.fillText(String(tile.number), -half + 6 * tile.z, -half + 13 * tile.z);

      // Oxidation state (Top-Right)
      c.fillStyle = `rgba(${tile.r}, ${tile.g}, ${tile.b}, ${finalAlpha * 0.95})`;
      c.font = `${Math.round(7.5 * tile.z)}px monospace`;
      c.textAlign = 'right';
      c.fillText(tile.oxidation, half - 6 * tile.z, -half + 12 * tile.z);

      // Bold Element Symbol (Center)
      c.fillStyle = `rgba(255, 255, 255, ${Math.min(1, finalAlpha * 1.15)})`;
      c.font = `900 ${Math.round(25 * tile.z)}px sans-serif`;
      c.textAlign = 'center';
      c.fillText(tile.symbol, 0, 7 * tile.z);

      // Element Name & Atomic Mass (Bottom)
      c.fillStyle = `rgba(226, 232, 240, ${finalAlpha * 0.85})`;
      c.font = `bold ${Math.round(7.5 * tile.z)}px sans-serif`;
      c.fillText(tile.name.toUpperCase(), 0, half - 11 * tile.z);

      c.fillStyle = `rgba(${tile.r}, ${tile.g}, ${tile.b}, ${finalAlpha * 0.9})`;
      c.font = `${Math.round(6.8 * tile.z)}px monospace`;
      c.fillText(tile.mass, 0, half - 3.5 * tile.z);

      c.restore();
    };

    const initScene = () => {
      smokePlumes.length = 0;
      periodicTiles.length = 0;
      floatingFormulas.length = 0;
      skeletalMolecules.length = 0;

      // 1. Volumetric Colorful Chemical Smoke Nebulae (9 rich clouds across the canvas)
      const cloudColors = [
        { r: 16, g: 185, b: 129, a: 0.14 },  // Heisenberg Emerald Green
        { r: 5,  g: 150, b: 105, a: 0.12 },  // Deep Forest Emerald
        { r: 245, g: 158, b: 11, a: 0.11 },  // Bromine Amber Gold
        { r: 6,  g: 182, b: 212, a: 0.13 },  // Copper Sulfate Cyan
        { r: 168, g: 85,  b: 247, a: 0.12 }, // Permanganate Violet
        { r: 236, g: 72,  b: 153, a: 0.09 }, // Phenolphthalein Rose
        { r: 20,  g: 184, b: 166, a: 0.12 }, // Fluorescein Teal
        { r: 234, g: 179, b: 8,   a: 0.09 }  // Sodium Flame Gold
      ];

      for (let i = 0; i < cloudColors.length; i++) {
        const col = cloudColors[i];
        smokePlumes.push({
          x: (w * (i + 0.5)) / cloudColors.length + (Math.random() - 0.5) * 180,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.22 - 0.08,
          radius: Math.max(w, h) * (0.26 + Math.random() * 0.16),
          r: col.r,
          g: col.g,
          b: col.b,
          alpha: col.a,
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.008 + Math.random() * 0.008
        });
      }

      // 2. Breaking-Bad Periodic Element Tiles (11 tiles across depth planes)
      const tileCount = Math.min(11, ELEMENT_TILES_DATA.length);
      for (let i = 0; i < tileCount; i++) {
        const el = ELEMENT_TILES_DATA[i % ELEMENT_TILES_DATA.length];
        const z = 0.48 + Math.random() * 0.55;
        periodicTiles.push({
          ...el,
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          vx: (Math.random() - 0.5) * 0.18 * z,
          vy: -(0.14 + Math.random() * 0.22) * z,
          alpha: 0.28 + Math.random() * 0.38,
          fadePhase: Math.random() * Math.PI * 2,
          fadeSpeed: 0.012 + Math.random() * 0.015
        });
      }

      // 3. Drifting Chemical Formulas & Reaction Equations (14 items)
      for (let i = 0; i < 14; i++) {
        const f = CHEMICAL_FORMULAS_DATA[i % CHEMICAL_FORMULAS_DATA.length];
        const col = VIBRANT_PALETTE[i % VIBRANT_PALETTE.length];
        const z = 0.45 + Math.random() * 0.55;
        floatingFormulas.push({
          text: f.text,
          subText: f.subText,
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          vx: (Math.random() - 0.5) * 0.22 * z,
          vy: -(0.12 + Math.random() * 0.18) * z,
          r: col.r,
          g: col.g,
          b: col.b,
          alpha: 0.22 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
          fontSize: Math.round((f.isSerif ? 18 : 13) * z),
          isSerif: f.isSerif
        });
      }

      // 4. Skeletal Organic Molecules (8 rotating structures)
      const skelTypes: SkeletalMolecule['type'][] = [
        'benzene', 'naphthalene', 'purine', 'salicylate', 'tetrahedral', 'benzene', 'purine', 'salicylate'
      ];
      const skelLabels = [
        'Phenol Derivative', 'Naphthalene π-System', 'Xanthine Alkaloid', 'Acetylsalicylate',
        'sp³ Chiral Center', 'Aromatic Resonance', 'Purine Heterocycle', 'Ester Linkage'
      ];
      for (let i = 0; i < skelTypes.length; i++) {
        const col = VIBRANT_PALETTE[(i + 1) % VIBRANT_PALETTE.length];
        const z = 0.5 + Math.random() * 0.5;
        skeletalMolecules.push({
          type: skelTypes[i],
          label: skelLabels[i],
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          vx: (Math.random() - 0.5) * 0.16 * z,
          vy: -(0.1 + Math.random() * 0.16) * z,
          angle: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.004,
          scale: (0.65 + Math.random() * 0.45) * z,
          r: col.r,
          g: col.g,
          b: col.b,
          alpha: 0.22 + Math.random() * 0.28
        });
      }
    };

    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initScene();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / w - 0.5) * 2,
        y: (e.clientY / h - 0.5) * 2,
        rawX: e.clientX,
        rawY: e.clientY
      };

      const now = performance.now();
      if (now - lastTrailTime > 55 && trailSparks.length < 14) {
        lastTrailTime = now;
        const col = VIBRANT_PALETTE[Math.floor(Math.random() * VIBRANT_PALETTE.length)];
        trailSparks.push({
          x: e.clientX + (Math.random() - 0.5) * 14,
          y: e.clientY + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 1.1,
          vy: (Math.random() - 0.5) * 1.1 - 0.35,
          size: 1.8 + Math.random() * 2.2,
          life: 1.0,
          decay: 0.032,
          r: col.r,
          g: col.g,
          b: col.b,
          rotation: Math.random() * Math.PI
        });
      }
    };

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initScene();

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const render = () => {
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }

      time += 1;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // LAYER 1: Volumetric Colorful Chemical Vapor Clouds (Additive Screen Blend)
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < smokePlumes.length; i++) {
        const sp = smokePlumes[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.phase += sp.pulseSpeed;

        if (sp.x < -sp.radius) sp.x = w + sp.radius;
        if (sp.x > w + sp.radius) sp.x = -sp.radius;
        if (sp.y < -sp.radius) sp.y = h + sp.radius;
        if (sp.y > h + sp.radius) sp.y = -sp.radius;

        const liveAlpha = sp.alpha * (0.8 + Math.sin(sp.phase) * 0.25);
        const px = sp.x - mx * 18;
        const py = sp.y - my * 18;

        const grad = ctx.createRadialGradient(px, py, 0, px, py, sp.radius);
        grad.addColorStop(0, `rgba(${sp.r}, ${sp.g}, ${sp.b}, ${liveAlpha})`);
        grad.addColorStop(0.5, `rgba(${sp.r}, ${sp.g}, ${sp.b}, ${liveAlpha * 0.45})`);
        grad.addColorStop(1, `rgba(${sp.r}, ${sp.g}, ${sp.b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, sp.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      // LAYER 2: Skeletal Organic Molecular Structures
      for (let i = 0; i < skeletalMolecules.length; i++) {
        const mol = skeletalMolecules[i];
        mol.x += mol.vx;
        mol.y += mol.vy;
        mol.angle += mol.rotSpeed;

        if (mol.y < -90) {
          mol.y = h + 90;
          mol.x = Math.random() * w;
        }
        if (mol.x < -90) mol.x = w + 90;
        if (mol.x > w + 90) mol.x = -90;

        const px = mol.x - mx * 28 * mol.z;
        const py = mol.y - my * 28 * mol.z;
        drawSkeletalStructure(ctx, mol, px, py);
      }

      // LAYER 3: Drifting Breaking-Bad Chemical Formulas & Equations
      for (let i = 0; i < floatingFormulas.length; i++) {
        const fm = floatingFormulas[i];
        fm.x += fm.vx;
        fm.y += fm.vy;
        fm.phase += 0.015;

        if (fm.y < -50) {
          fm.y = h + 50;
          fm.x = Math.random() * w;
        }
        if (fm.x < -150) fm.x = w + 150;
        if (fm.x > w + 150) fm.x = -150;

        const px = fm.x - mx * 35 * fm.z;
        const py = fm.y - my * 35 * fm.z;
        const pulseA = fm.alpha * (0.75 + Math.sin(fm.phase) * 0.25);

        ctx.save();
        ctx.font = `${fm.isSerif ? 'italic bold' : 'bold'} ${fm.fontSize}px ${fm.isSerif ? 'Georgia, serif' : 'monospace'}`;
        ctx.fillStyle = `rgba(${fm.r}, ${fm.g}, ${fm.b}, ${pulseA})`;
        ctx.shadowColor = `rgba(${fm.r}, ${fm.g}, ${fm.b}, ${pulseA * 0.5})`;
        ctx.shadowBlur = 8;
        ctx.fillText(fm.text, px, py);

        if (fm.subText) {
          ctx.font = `${Math.max(8, Math.round(fm.fontSize * 0.62))}px monospace`;
          ctx.fillStyle = `rgba(203, 213, 225, ${pulseA * 0.68})`;
          ctx.shadowBlur = 0;
          ctx.fillText(fm.subText, px, py + fm.fontSize * 0.9);
        }
        ctx.restore();
      }

      // LAYER 4: Iconic Breaking-Bad Periodic Table Element Tiles
      for (let i = 0; i < periodicTiles.length; i++) {
        const tile = periodicTiles[i];
        tile.x += tile.vx;
        tile.y += tile.vy;
        tile.fadePhase += tile.fadeSpeed;

        if (tile.y < -80) {
          tile.y = h + 80;
          tile.x = Math.random() * w;
        }
        if (tile.x < -80) tile.x = w + 80;
        if (tile.x > w + 80) tile.x = -80;

        const px = tile.x - mx * 45 * tile.z;
        const py = tile.y - my * 45 * tile.z;
        const pulseAlpha = tile.alpha + Math.sin(tile.fadePhase) * 0.14;

        drawPeriodicTile(ctx, tile, px, py, pulseAlpha);
      }

      // LAYER 5: Cursor Chemical Spark Trail
      ctx.globalCompositeOperation = 'screen';
      for (let i = trailSparks.length - 1; i >= 0; i--) {
        const sp = trailSparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= sp.decay;
        sp.rotation += 0.05;

        if (sp.life > 0) {
          const rad = sp.size * 3.2 * sp.life;
          const grad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, rad);
          grad.addColorStop(0, `rgba(255, 255, 255, ${sp.life})`);
          grad.addColorStop(0.35, `rgba(${sp.r}, ${sp.g}, ${sp.b}, ${sp.life * 0.85})`);
          grad.addColorStop(1, `rgba(${sp.r}, ${sp.g}, ${sp.b}, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, rad, 0, Math.PI * 2);
          ctx.fill();
        } else {
          trailSparks.splice(i, 1);
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

export default BreakingBadChemistryBackdrop;
