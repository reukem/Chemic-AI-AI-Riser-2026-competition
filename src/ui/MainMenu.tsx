import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../engine/store';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import LanguageToggle from './LanguageToggle';
import SettingsModal from './SettingsModal';
import ReagentDatabase from './ReagentDatabase';
import { ErrorBoundary } from './ErrorBoundary';
import ContactWidget from './ContactWidget';
import lucyMenuSprite from '../assets/lucy_STANDING_MENU_clean.png';
import lucyShy1Sprite from '../assets/lucy_easter_shy1.png';
import lucyShy2Sprite from '../assets/lucy_easter_shy2.png';
import lucyPunchSprite from '../assets/lucy_easter_punch.png';
import lucyPoutSprite from '../assets/lucy_easter_pout.png';
import lucyFacePFP from '../assets/lucy_FACE_PFP_clean.png';
import { audioManager } from '../engine/AudioManager';
import { GoogleAuthService, GoogleUserProfile } from '../services/GoogleAuthService';
import { MultimodalScannerModal } from './MultimodalScannerModal';
import { LabReportModal } from './LabReportModal';
import { GoogleProfileModal } from './GoogleProfileModal';
import { CurriculumLearningModal } from './CurriculumLearningModal';
import { GlassCrackOverlay } from './components/GlassCrackOverlay';
import { FlameSpectroscopyModal } from './FlameSpectroscopyModal';
import { GalvanicCellModal } from './GalvanicCellModal';
import { ReactionKineticsModal } from './ReactionKineticsModal';
import { VseprOrbitalModal } from './VseprOrbitalModal';
import ChemicLogo from './components/ChemicLogo';
import { lucyVoiceEngine } from '../engine/LucyVoiceEngine';

// Breaking Bad-Inspired 3D Chemical Formula & Volumetric Smoke Engine + Quantum Sparks
const CanvasParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<any[]>([]);
  const sparksRef = useRef<any[]>([]);
  const trailSparksRef = useRef<any[]>([]);
  const smokeRef = useRef<any[]>([]);
  const chemFlowRef = useRef<any[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0 });

  // Vivid Multi-Color Chemical Spectrum ("Chemistry is About Colors")
  const GRADIENT_PALETTE = [
    { r: 16, g: 185, b: 129 },   // Viridian / Malachite Emerald (#10b981)
    { r: 132, g: 204, b: 22 },   // Chlorine / Uranium Glass Lime (#84cc16)
    { r: 245, g: 158, b: 11 },   // Dichromate / Bromine Amber (#f59e0b)
    { r: 34, g: 211, b: 238 },   // Copper(II) Sulfate Cyan (#22d3ee)
    { r: 168, g: 85, b: 247 },   // Permanganate Royal Violet (#a855f7)
    { r: 244, g: 63, b: 94 },    // Strontium / Thiocyanate Crimson (#f43f5e)
    { r: 250, g: 204, b: 21 }    // Lead Iodide Golden Rain (#facc15)
  ];

  // Periodic Element Tiles for 3D Z-Space Flow (Breaking Bad Intro Style without logo)
  const ELEMENT_TILES = [
    { sym: 'Br', num: '35', mass: '79.904', ox: '-1 +1 +5', shells: '2-8-18-7', rgb: { r: 16, g: 185, b: 129 } },
    { sym: 'Ba', num: '56', mass: '137.33', ox: '+2', shells: '2-8-18-18-8-2', rgb: { r: 132, g: 204, b: 22 } },
    { sym: 'Cu', num: '29', mass: '63.546', ox: '+1 +2', shells: '2-8-18-1', rgb: { r: 34, g: 211, b: 238 } },
    { sym: 'Cr', num: '24', mass: '51.996', ox: '+2 +3 +6', shells: '2-8-13-1', rgb: { r: 245, g: 158, b: 11 } },
    { sym: 'Mn', num: '25', mass: '54.938', ox: '+2 +4 +7', shells: '2-8-13-2', rgb: { r: 168, g: 85, b: 247 } },
    { sym: 'Fe', num: '26', mass: '55.845', ox: '+2 +3', shells: '2-8-14-2', rgb: { r: 244, g: 63, b: 94 } },
    { sym: 'Au', num: '79', mass: '196.97', ox: '+1 +3', shells: '2-8-18-32-18-1', rgb: { r: 250, g: 204, b: 21 } },
    { sym: 'Ag', num: '47', mass: '107.87', ox: '+1', shells: '2-8-18-18-1', rgb: { r: 56, g: 189, b: 248 } },
    { sym: 'Co', num: '27', mass: '58.933', ox: '+2 +3', shells: '2-8-15-2', rgb: { r: 236, g: 72, b: 153 } },
    { sym: 'Pt', num: '78', mass: '195.08', ox: '+2 +4', shells: '2-8-18-32-17-1', rgb: { r: 45, g: 212, b: 191 } }
  ];

  // Chemical Formulas & Molecular Masses Flowing in 3D Z-Space
  const CHEMICAL_FORMULAS = [
    { text: 'C₁₀H₁₅N', sub: '149.24 g/mol • CHIRAL SYNTHESIS', rgb: { r: 52, g: 211, b: 153 } },
    { text: 'CuSO₄·5H₂O', sub: '249.68 • [Cu(H₂O)₄]²⁺ AZURE', rgb: { r: 34, g: 211, b: 238 } },
    { text: 'KMnO₄', sub: '158.034 • +7 PERMANGANATE VIOLET', rgb: { r: 192, g: 132, b: 252 } },
    { text: 'K₂Cr₂O₇', sub: '294.185 • DICHROMATE AMBER', rgb: { r: 251, g: 191, b: 36 } },
    { text: '[Fe(SCN)]²⁺', sub: 'BLOOD-RED COMPLEX • λ = 480nm', rgb: { r: 251, g: 113, b: 133 } },
    { text: 'H₂SO₄', sub: '98.079 • ΔH° = -880 kJ/mol', rgb: { r: 163, g: 230, b: 53 } },
    { text: 'Pb(NO₃)₂ + 2KI → PbI₂↓', sub: '461.01 • GOLDEN RAIN CRYSTALS', rgb: { r: 250, g: 204, b: 21 } },
    { text: 'C₆H₁₂O₆', sub: '180.156 • HEXOSE RING', rgb: { r: 52, g: 211, b: 153 } },
    { text: 'ΔG° = ΔH° - TΔS°', sub: 'GIBBS THERMODYNAMIC EQUILIBRIUM', rgb: { r: 56, g: 189, b: 248 } },
    { text: 'k = A·e^(-Ea/RT)', sub: 'ARRHENIUS KINETICS CONSTANT', rgb: { r: 245, g: 158, b: 11 } },
    { text: '1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰', sub: 'QUANTUM ELECTRON SHELLS • 2-8-18-7', rgb: { r: 16, g: 185, b: 129 } },
    { text: '[Cu(NH₃)₄]²⁺', sub: 'TETRAAMMINE DEEP ROYAL SAPPHIRE', rgb: { r: 129, g: 140, b: 248 } },
    { text: 'AgNO₃ + NaCl → AgCl↓', sub: '143.32 • Ksp = 1.77×10⁻¹⁰', rgb: { r: 45, g: 212, b: 191 } },
    { text: 'CH₃COOH ⇌ CH₃COO⁻ + H⁺', sub: 'pKa = 4.76 • BUFFER SYSTEM', rgb: { r: 244, g: 114, b: 182 } }
  ];

  const getInterpolatedColor = (phase: number) => {
    const len = GRADIENT_PALETTE.length;
    const normalized = ((phase % 1) + 1) % 1;
    const index = Math.floor(normalized * len);
    const nextIndex = (index + 1) % len;
    const factor = (normalized * len) - index;

    const c1 = GRADIENT_PALETTE[index];
    const c2 = GRADIENT_PALETTE[nextIndex];

    return {
      r: Math.round(c1.r + (c2.r - c1.r) * factor),
      g: Math.round(c1.g + (c2.g - c1.g) * factor),
      b: Math.round(c1.b + (c2.b - c1.b) * factor)
    };
  };

  const drawStarFlare = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    size: number, 
    alpha: number, 
    rgb: { r: number; g: number; b: number }, 
    rotation: number
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Hardware-accelerated GPU Radial Gradient Glow (Zero Gaussian Blur Overhead)
    const auraRadius = size * 3.8;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, auraRadius);
    grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.8})`);
    grad.addColorStop(0.45, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.25})`);
    grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4-Point Diamond Flare
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.95})`;
    const arm = size * 2.5;
    const waist = size * 0.38;
    ctx.beginPath();
    ctx.moveTo(0, -arm);
    ctx.quadraticCurveTo(0, 0, waist, 0);
    ctx.quadraticCurveTo(0, 0, 0, arm);
    ctx.quadraticCurveTo(0, 0, -waist, 0);
    ctx.quadraticCurveTo(0, 0, 0, -arm);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-arm, 0);
    ctx.quadraticCurveTo(0, 0, 0, waist);
    ctx.quadraticCurveTo(0, 0, arm, 0);
    ctx.quadraticCurveTo(0, 0, 0, -waist);
    ctx.quadraticCurveTo(0, 0, -arm, 0);
    ctx.fill();

    // Intense White Micro-Nucleus
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.8)})`;
    ctx.fill();

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;
    let lastTrailTime = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.scale(dpr, dpr);

    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.scale(dpr, dpr);
      initField();
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const curX = e.clientX;
      const curY = e.clientY;
      mouseRef.current = {
        x: (curX / w - 0.5) * 2,
        y: (curY / h - 0.5) * 2,
        lastX: curX,
        lastY: curY
      };

      // Throttled micro-spark trail behind cursor (capped at 10 max)
      const now = performance.now();
      if (now - lastTrailTime > 65 && trailSparksRef.current.length < 10) {
        lastTrailTime = now;
        const color = GRADIENT_PALETTE[Math.floor(Math.random() * GRADIENT_PALETTE.length)];
        trailSparksRef.current.push({
          x: curX + (Math.random() - 0.5) * 12,
          y: curY + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2 - 0.3,
          size: Math.random() * 1.8 + 1.0,
          life: 1.0,
          decay: 0.035,
          rgb: color,
          rotation: Math.random() * Math.PI
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const initField = () => {
      particlesRef.current = [];
      sparksRef.current = [];
      trailSparksRef.current = [];
      smokeRef.current = [];
      chemFlowRef.current = [];

      // 0A. Volumetric Chemical Smoke Plumes (Breaking Bad Atmospheric Fumes)
      const smokePalette = [
        { r: 16, g: 185, b: 129 },   // Viridian Emerald Smoke
        { r: 132, g: 204, b: 22 },   // Chlorine / Lime Fume
        { r: 245, g: 158, b: 11 },   // Dichromate / Bromine Amber Vapor
        { r: 168, g: 85, b: 247 },   // Permanganate / Iodine Violet Mist
        { r: 6, g: 182, b: 212 },    // Copper Sulfate Cyan Haze
        { r: 244, g: 63, b: 94 }     // Strontium Rose Mist
      ];
      for (let i = 0; i < 18; i++) {
        const sColor = smokePalette[i % smokePalette.length];
        smokeRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.38,
          vy: -0.15 - Math.random() * 0.28,
          radius: 150 + Math.random() * 190,
          alpha: 0.045 + Math.random() * 0.055,
          pulseSpeed: 0.008 + Math.random() * 0.012,
          pulsePhase: Math.random() * Math.PI * 2,
          rgb: sColor
        });
      }

      // 0B. 3D Z-Space Flowing Chemical Formulas, Periodic Tiles & Benzene Rings
      const total3DItems = 26;
      for (let i = 0; i < total3DItems; i++) {
        const kindRoll = i % 5;
        const kind = kindRoll === 0 ? 'tile' : kindRoll === 4 ? 'ring' : 'formula';
        const tileData = ELEMENT_TILES[i % ELEMENT_TILES.length];
        const formulaData = CHEMICAL_FORMULAS[i % CHEMICAL_FORMULAS.length];
        const rgb = kind === 'tile' ? tileData.rgb : formulaData.rgb;
        // Alternate directions: some flow into the deep background (+vz), some emerge toward viewer (-vz)
        const intoBack = i % 3 !== 0;
        chemFlowRef.current.push({
          // Spread across screen in normalized coordinates (-0.65 to +0.65 from center)
          nx: (Math.random() - 0.5) * 1.35,
          ny: (Math.random() - 0.5) * 1.25,
          z: 0.22 + (i / total3DItems) * 1.45,
          vz: intoBack ? (0.0022 + Math.random() * 0.0018) : -(0.0020 + Math.random() * 0.0016),
          kind,
          tile: tileData,
          formula: formulaData,
          rgb,
          rot: (Math.random() - 0.5) * 0.35,
          rotSpeed: (Math.random() - 0.5) * 0.002
        });
      }

      // 1. Multi-Color Constellation Dust Nodes
      const dustColors = [
        '52, 211, 153',  // Emerald
        '34, 211, 238',  // Cyan
        '251, 191, 36',  // Amber
        '192, 132, 252', // Violet
        '251, 113, 133'  // Rose
      ];
      const numNodes = Math.min(Math.floor((w * h) / 32000), 28);
      for (let i = 0; i < numNodes; i++) {
        particlesRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22 - 0.06,
          size: Math.random() * 1.6 + 0.9,
          alpha: Math.random() * 0.4 + 0.15,
          color: dustColors[i % dustColors.length]
        });
      }

      // 2. Radiant Gradient Sparks & Twinkling Star Flares
      const numSparks = Math.min(Math.floor((w * h) / 36000), 22);
      for (let i = 0; i < numSparks; i++) {
        sparksRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: -(0.2 + Math.random() * 0.45),
          swaySpeed: 0.015 + Math.random() * 0.02,
          swayPhase: Math.random() * Math.PI * 2,
          size: Math.random() * 2.1 + 1.2,
          baseAlpha: Math.random() * 0.38 + 0.38,
          twinkleSpeed: 0.03 + Math.random() * 0.04,
          twinklePhase: Math.random() * Math.PI * 2,
          colorPhase: Math.random(),
          colorSpeed: 0.003 + Math.random() * 0.004,
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.025,
          isStar: Math.random() < 0.65
        });
      }
    };

    initField();

    const draw = () => {
      // Pause drawing when tab is hidden to save CPU/GPU cycles
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      time += 1;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'screen';

      const mouse = mouseRef.current;
      const mx = (mouse.x / 2 + 0.5) * w;
      const my = (mouse.y / 2 + 0.5) * h;

      // 0A. Draw Billowing Volumetric Chemical Smoke Plumes
      const smokes = smokeRef.current;
      for (let i = 0; i < smokes.length; i++) {
        const sm = smokes[i];
        sm.x += sm.vx + Math.sin(time * 0.006 + sm.pulsePhase) * 0.25;
        sm.y += sm.vy;
        if (sm.y < -sm.radius) {
          sm.y = h + sm.radius * 0.8;
          sm.x = Math.random() * w;
        }
        if (sm.x < -sm.radius) sm.x = w + sm.radius * 0.8;
        if (sm.x > w + sm.radius) sm.x = -sm.radius * 0.8;

        const liveSmokeAlpha = sm.alpha * (0.75 + 0.25 * Math.sin(time * sm.pulseSpeed + sm.pulsePhase));
        const sGrad = ctx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, sm.radius);
        sGrad.addColorStop(0, `rgba(${sm.rgb.r}, ${sm.rgb.g}, ${sm.rgb.b}, ${liveSmokeAlpha})`);
        sGrad.addColorStop(0.5, `rgba(${sm.rgb.r}, ${sm.rgb.g}, ${sm.rgb.b}, ${liveSmokeAlpha * 0.45})`);
        sGrad.addColorStop(1, `rgba(${sm.rgb.r}, ${sm.rgb.g}, ${sm.rgb.b}, 0)`);
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.arc(sm.x, sm.y, sm.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 0B. Draw 3D Z-Space Flowing Chemical Formulas, Periodic Tiles & Benzene Rings (Breaking Bad Intro Vibe)
      const cx = w * 0.54;
      const cy = h * 0.48;
      const zMin = 0.20;
      const zMax = 1.68;
      const zSpan = zMax - zMin;
      const chemItems = chemFlowRef.current;

      for (let i = 0; i < chemItems.length; i++) {
        const item = chemItems[i];
        item.z += item.vz;
        item.rot += item.rotSpeed;

        // Seamless 3D Z-depth wrap & respawn
        if (item.z > zMax) {
          item.z = zMin + 0.02;
          item.nx = (Math.random() - 0.5) * 1.35;
          item.ny = (Math.random() - 0.5) * 1.25;
        } else if (item.z < zMin) {
          item.z = zMax - 0.02;
          item.nx = (Math.random() - 0.5) * 1.35;
          item.ny = (Math.random() - 0.5) * 1.25;
        }

        // Normalized depth progress (0 at near clip, 1 at far clip)
        const normZ = Math.max(0, Math.min(1, (item.z - zMin) / zSpan));
        // Smooth bell-curve fade so formulas emerge from mist and dissolve into the deep background
        const depthAlpha = Math.sin(normZ * Math.PI);
        const perspectiveScale = 0.72 / item.z;

        const sx = cx + (item.nx * w * 0.55 - mouse.x * 28) * perspectiveScale;
        const sy = cy + (item.ny * h * 0.55 - mouse.y * 20) * perspectiveScale;

        if (sx < -180 || sx > w + 180 || sy < -140 || sy > h + 140) continue;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(perspectiveScale, perspectiveScale);

        const { r, g, b } = item.rgb;
        const alpha = depthAlpha * 0.52;

        if (item.kind === 'tile') {
          // Periodic Table Element Tile (Breaking Bad Intro Style without show title)
          const boxSize = 66;
          const half = boxSize / 2;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.22})`;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.95})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(-half, -half, boxSize, boxSize, 6);
          ctx.fill();
          ctx.stroke();

          // Atomic Mass (Top-Left) & Oxidation States (Top-Right)
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
          ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(item.tile.mass, -half + 5, -half + 11);

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.95})`;
          ctx.font = '7px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText(item.tile.ox, half - 5, -half + 11);

          // Main Element Symbol (Center)
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.95, alpha * 1.35)})`;
          ctx.font = 'bold 28px Georgia, "Times New Roman", serif';
          ctx.textAlign = 'center';
          ctx.fillText(item.tile.sym, 0, 8);

          // Atomic Number (Bottom-Left) & Electron Shells (Bottom-Right)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 1.1})`;
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(item.tile.num, -half + 5, half - 6);

          ctx.fillStyle = `rgba(226, 232, 240, ${alpha * 0.75})`;
          ctx.font = '6.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText(item.tile.shells, half - 4, half - 6);
        } else if (item.kind === 'ring') {
          // 3D Rotating Benzene / Aromatic Hexagonal Ring
          ctx.rotate(item.rot);
          const rad = 28;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.85})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let v = 0; v < 6; v++) {
            const ang = (v * Math.PI) / 3;
            const vx = Math.cos(ang) * rad;
            const vy = Math.sin(ang) * rad;
            if (v === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
          ctx.stroke();

          // Inner aromatic delocalized pi-ring
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.58, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        } else {
          // 3D Flowing Chemical Formula & Molecular Weight
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.9, alpha * 1.25)})`;
          ctx.font = 'bold 21px Georgia, "Times New Roman", serif';
          ctx.textAlign = 'center';
          ctx.fillText(item.formula.text, 0, 0);

          ctx.fillStyle = `rgba(226, 232, 240, ${alpha * 0.8})`;
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(item.formula.sub, 0, 14);
        }

        ctx.restore();
      }

      // 1. Draw Constellation Dust & Connective Quantum Lines (Squared distance calculation)
      const nodes = particlesRef.current;
      const nodeLen = nodes.length;
      for (let i = 0; i < nodeLen; i++) {
        const p = nodes[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        const dx = mx - p.x;
        const dy = my - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 14400) { // 120px squared
          const dist = Math.sqrt(distSq);
          const force = (120 - dist) / 120;
          p.x -= (dx / dist) * force * 0.8;
          p.y -= (dy / dist) * force * 0.8;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.fill();

        for (let j = i + 1; j < nodeLen; j++) {
          const p2 = nodes[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2Sq = dx2 * dx2 + dy2 * dy2;

          if (dist2Sq < 7225) { // 85px squared
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${p.color}, ${0.1 * (1 - dist2Sq / 7225)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // 2. Draw Radiant Gradient Sparks & Star Flares
      const sparks = sparksRef.current;
      const sparkLen = sparks.length;
      for (let sIdx = 0; sIdx < sparkLen; sIdx++) {
        const s = sparks[sIdx];
        s.y += s.vy;
        s.x += Math.sin(time * s.swaySpeed + s.swayPhase) * 0.35;
        s.colorPhase += s.colorSpeed;
        s.rotation += s.rotSpeed;

        if (s.y < -20) {
          s.y = h + 20;
          s.x = Math.random() * w;
        }
        if (s.x < 0) s.x = w;
        if (s.x > w) s.x = 0;

        const liveAlpha = Math.max(0.12, Math.min(1.0, s.baseAlpha + Math.sin(time * s.twinkleSpeed + s.twinklePhase) * 0.4));
        const rgb = getInterpolatedColor(s.colorPhase);

        if (s.isStar) {
          drawStarFlare(ctx, s.x, s.y, s.size, liveAlpha, rgb, s.rotation);
        } else {
          // Soft Glowing Ember using fast concentric radial gradient
          const rad = s.size * 3.0;
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
          grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${liveAlpha})`);
          grad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${liveAlpha * 0.3})`);
          grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, liveAlpha * 1.5)})`;
          ctx.fill();
        }
      }

      // 3. Draw Interactive Cursor Trail Sparks
      const trail = trailSparksRef.current;
      for (let k = trail.length - 1; k >= 0; k--) {
        const ts = trail[k];
        ts.x += ts.vx;
        ts.y += ts.vy;
        ts.life -= ts.decay;
        ts.rotation += 0.035;

        if (ts.life > 0) {
          drawStarFlare(ctx, ts.x, ts.y, ts.size * ts.life, ts.life * 0.75, ts.rgb, ts.rotation);
        } else {
          trail.splice(k, 1);
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

type ModeType = 'idle' | 'start' | 'socratic' | 'learning' | 'reagent' | 'organic' | 'calculating' | 'topic_colors' | 'topic_secret' | 'topic_quiz' | 'pet_shy1' | 'pet_shy2' | 'pet_punch' | 'pet_pout';

const MODE_DIALOGUES: Record<string, { EN: string; VN: string }> = {
  idle: {
    EN: "System online! Welcome to the Chemic-AI Quantum Engine, Researcher! Look at all the vivid chemical formulas & reaction spectra flowing around us — ready to synthesize something colourful today? :3",
    VN: "Hệ thống trực tuyến! Chào mừng em đến với Chemic-AI Quantum Engine! Nhìn những công thức phân tử và dải sắc màu hóa học đang chuyển động quanh chúng ta kìa — sẵn sàng làm thí nghiệm rực rỡ hôm nay chưa? :3"
  },
  start: {
    EN: "The virtual workbench is fully calibrated! Glassware, bunsen burners, vivid indicators, and real-time thermodynamics are ready. Let's enter the lab! 🧪",
    VN: "Bàn thí nghiệm đã hiệu chuẩn hoàn tất! Dụng cụ thủy tinh, đèn Bunsen, chất chỉ thị màu rực rỡ và nhiệt động lực học đã sẵn sàng. Cùng vào phòng thí nghiệm nào! 🧪"
  },
  topic_colors: {
    EN: "Chemistry is all about vivid colors! 🎨 Cu²⁺ glows sapphire blue, KMnO₄ shines royal violet, K₂Cr₂O₇ blazes golden amber, and [Fe(SCN)]²⁺ turns deep crimson due to d-orbital electron transitions!",
    VN: "Hóa học là nghệ thuật của sắc màu! 🎨 Ion Cu²⁺ xanh lam ngọc, KMnO₄ tím hoàng gia, K₂Cr₂O₇ cam vàng rực lửa, còn phức [Fe(SCN)]²⁺ đỏ máu nhờ sự chuyển dịch electron trên phân lớp d đấy! :3"
  },
  topic_secret: {
    EN: "Lab Secret! ✨ Try mixing Lead(II) Nitrate Pb(NO₃)₂ with Potassium Iodide KI in the workbench to precipitate shimmering Golden Rain (PbI₂↓), or test Cu²⁺ and Sr²⁺ in the Bunsen Flame!",
    VN: "Bí mật phòng Lab! ✨ Hãy thử pha Chì(II) Nitrat Pb(NO₃)₂ với Kali Iodua KI để tạo hiện tượng 'Mưa Vàng' (PbI₂↓) lấp lánh, hoặc đốt thử muối Đồng Cu²⁺ (lục bảo) và Stronti Sr²⁺ (đỏ thẫm) nhé!"
  },
  topic_quiz: {
    EN: "Quick Pop Quiz! ⚡ When you add excess NH₃ to pale-blue CuSO₄ solution, what dramatic color shift occurs? Hint: [Cu(NH₃)₄]²⁺ forms an intense deep royal sapphire complex! 💎",
    VN: "Đố vui nhanh! ⚡ Khi nhỏ từ từ NH₃ tới dư vào dung dịch CuSO₄ xanh nhạt, màu sắc biến đổi thế nào? Gợi ý: Phức chất [Cu(NH₃)₄]²⁺ tạo thành có màu xanh lam thẫm tuyệt đẹp! 💎"
  },
  socratic: {
    EN: "Oho? Think your chemistry logic can survive my ruthless cross-examination? Come on, let's deconstruct your hypotheses! 😈",
    VN: "Ồ? Em có tự tin rằng lập luận hóa học của mình đủ sắc bén để vượt qua những câu chất vấn của tôi không? Thử xem nào! 😈"
  },
  learning: {
    EN: "Need a patient hand with homework, stoichiometry, or national exam prep? I'm right here to guide you step-by-step! 🎓",
    VN: "Cần cô hướng dẫn giải bài tập, cân bằng phản ứng hay luyện thi THPT Quốc Gia? Cô luôn ở đây để kèm cặp em từng bước! 🎓"
  },
  reagent: {
    EN: "118 IUPAC elements with real quantum electron configurations, electronegativity, and thermodynamic data. A true scientific codex! 📖",
    VN: "Tra cứu 118 nguyên tố IUPAC với cấu hình electron lượng tử, độ âm điện và dữ liệu nhiệt động học chuẩn xác! 📖"
  },
  organic: {
    EN: "Infinite Craft meets organic chemistry! Combine molecular radicals to synthesize real organic compounds, or solve synthesis puzzles! ⬡",
    VN: "Khám phá hóa học hữu cơ theo phong cách Infinite Craft! Tự do liên kết phân tử và chinh phục các câu đố cấu trúc! ⬡"
  },
  calculating: {
    EN: "Looking for exact stoichiometry, molar concentrations, gas laws or enthalpy calculations? Let's crunch the numbers with precision! 🧮",
    VN: "Cần tính số mol, nồng độ dung dịch C%, CM, thể tích khí hay biến thiên Enthalpy? Vào ngay Bảng Công Thức & Máy Tính Lượng Tử nhé! 🧮"
  },
  pet_shy1: {
    EN: "H-hey! Why are you suddenly poking me? Focus on your research, baka! >///<",
    VN: "Á... tự nhiên lại chọc cô! Nghiêm túc tập trung làm thí nghiệm đi chứ, đồ ngốc! >///<"
  },
  pet_shy2: {
    EN: "N-No! I told you to stop poking... I-I'm your lead professor! Stop touching my fox ears! ⁄(⁄ ⁄•⁄-⁄•⁄ ⁄)⁄",
    VN: "N-Này! Đã bảo là đừng chọc mà... C-cô là giáo sư đấy nhé! Cấm chạm vào tai cáo của cô nữa đó! ⁄(⁄ ⁄•⁄-⁄•⁄ ⁄)⁄"
  },
  pet_punch: {
    EN: "I TOLD YOU TO STOP! 💢 TAKE MY QUANTUM FIST! That's what you get for messing with me!",
    VN: "ĐÃ BẢO LÀ DỪNG LẠI RỒI MÀ! 💢 CÚ ĐẤM LƯỢNG TỬ ĐÂY NÀY! Cho nứt màn hình luôn chừa thói nghịch ngợm!"
  },
  pet_pout: {
    EN: "Hmph! I'm mad now! 😤 Not giving you any more hints! Go do your chemistry experiments all by yourself! ...Hmph!",
    VN: "Hông thèm, giận rồi! 😤 Không thèm chỉ bài cho em nữa đâu! Tự đi mà làm thí nghiệm một mình đi! ...Hmph!"
  }
};

const POUT_QUOTES = {
  VN: [
    "Hông thèm, giận rồi! 😤 Không thèm chỉ bài cho em nữa đâu! Tự đi mà làm thí nghiệm một mình đi! ...Hmph!",
    "Hông thèm, giận rồi! 😤 Vẫn còn dám chọc nữa à? Cô đang nghiêm túc giận đấy nhé! (눈_눈)",
    "Hông nghe, hông thấy gì hết! Mau đi vào phòng thí nghiệm làm bài tập đi! 🙈",
    "Cái màn hình nứt toác kia là bằng chứng tội lỗi của em đấy! 😤💢",
    "Đừng có nhìn cô bằng ánh mắt cún con đó... Hông có tha thứ dễ dàng thế đâu! >3<"
  ],
  EN: [
    "Hmph! I'm mad now! 😤 Not giving you any more hints! Go do your chemistry experiments all by yourself! ...Hmph!",
    "Hmph! Still daring to poke me? Can't you see I'm super mad at you? (눈_눈)",
    "I can't hear you, la la la! Go into the lab and finish your homework! 🙈",
    "That shattered screen is permanent proof of your mischief! 😤💢",
    "Don't look at me with puppy eyes... I'm not forgiving you that easily! >3<"
  ]
};

const MainMenu: React.FC = () => {
  const setAppState = useSimulationStore(state => state.setAppState);
  const language = useSimulationStore(state => state.language);
  const customApiKey = useSimulationStore(state => state.customApiKey);
  const isSocraticModeActive = useSimulationStore(state => state.isSocraticModeActive);
  const isLearningModeActive = useSimulationStore(state => state.isLearningModeActive);
  const isOrganicModeActive = useSimulationStore(state => state.isOrganicModeActive);
  const isCalculatingModeActive = useSimulationStore(state => state.isCalculatingModeActive);
  const rawLanguage = useSimulationStore(state => state.language || 'EN');
  const isVi = rawLanguage === 'VN' || rawLanguage === 'vi';
  const setActiveTab = useSimulationStore(state => state.setActiveTab);

  // Easter Egg Persistent Store & Local UI States
  const isMenuCracked = useSimulationStore(state => state.isMenuCracked);
  const setMenuCracked = useSimulationStore(state => state.setMenuCracked);
  const menuEasterEggStage = useSimulationStore(state => state.menuEasterEggStage);
  const setMenuEasterEggStage = useSimulationStore(state => state.setMenuEasterEggStage);

  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [showPunchFlash, setShowPunchFlash] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [poutQuoteIdx, setPoutQuoteIdx] = useState(0);
  const [isPoutJiggling, setIsPoutJiggling] = useState(false);
  const [steamList, setSteamList] = useState<{ id: number; x: number; y: number }[]>([]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothMouseX = useSpring(mouseX, { stiffness: 45, damping: 30 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 45, damping: 30 });

  const [currentMode, setCurrentMode] = useState<ModeType>('idle');
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReagentDbOpen, setIsReagentDbOpen] = useState(false);
  const [isBlushing, setIsBlushing] = useState(false);

  // Google Workspace, Curriculum Learning & Multimodal Modals
  const [isScannerOpen, setScannerOpen] = useState(false);
  const [isReportOpen, setReportOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const [isFlameOpen, setFlameOpen] = useState(false);
  const [isGalvanicOpen, setGalvanicOpen] = useState(false);
  const [isKineticsOpen, setKineticsOpen] = useState(false);
  const [isVseprOpen, setVseprOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile>(GoogleAuthService.getUser());

  const getDialogueText = () => {
    if (currentMode === 'pet_pout') {
      return isVi ? POUT_QUOTES.VN[poutQuoteIdx % POUT_QUOTES.VN.length] : POUT_QUOTES.EN[poutQuoteIdx % POUT_QUOTES.EN.length];
    }
    const modeData = MODE_DIALOGUES[currentMode] || MODE_DIALOGUES.idle;
    return isVi ? modeData.VN : modeData.EN;
  };

  const currentDialogue = getDialogueText();

  // Typewriter effect for Lucy's speech bubble
  useEffect(() => {
    setDisplayedText("");
    setIsTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(currentDialogue.slice(0, i));
      i++;
      if (i > currentDialogue.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 18);
    return () => clearInterval(interval);
  }, [currentDialogue]);

  // Sync activeTab state when overlays/menus open or close
  useEffect(() => {
    if (isReagentDbOpen) {
      setActiveTab('codex');
    } else if (isSettingsOpen) {
      setActiveTab('settings');
    } else if (isSocraticModeActive) {
      setActiveTab('socratic');
    } else if (isLearningModeActive) {
      setActiveTab('learning');
    } else if (isOrganicModeActive) {
      setActiveTab('organic');
    } else if (isCalculatingModeActive) {
      setActiveTab('calculating');
    } else {
      setActiveTab('menu');
    }
  }, [isReagentDbOpen, isSettingsOpen, isSocraticModeActive, isLearningModeActive, isOrganicModeActive, isCalculatingModeActive, setActiveTab]);

  const handleStart = () => {
    audioManager.playClick();
    setAppState('LOADING');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  // 4-Stage Progressive Easter Egg Handler
  const handleLucyInteraction = () => {
    if (isPunching) return; // Prevent spam during active punch strike

    if (menuEasterEggStage === 0) {
      // Stage 0 -> 1: Shy 1 (Light blush)
      audioManager.playCuteSqueak();
      setMenuEasterEggStage(1);
      setIsBlushing(true);
      setCurrentMode('pet_shy1');
      setTimeout(() => setIsBlushing(false), 2500);
    } else if (menuEasterEggStage === 1) {
      // Stage 1 -> 2: Shy 2 (Deep blush, crouching)
      audioManager.playCuteSqueak();
      setMenuEasterEggStage(2);
      setIsBlushing(true);
      setCurrentMode('pet_shy2');
      setTimeout(() => setIsBlushing(false), 2500);
    } else if (menuEasterEggStage === 2) {
      // Stage 2 -> 3: THE QUANTUM PUNCH!
      setMenuEasterEggStage(3);
      setIsPunching(true);
      setIsScreenShaking(true);
      setShowPunchFlash(true);
      setMenuCracked(true); // Permanent glass crack in menu until reload/restart!
      setCurrentMode('pet_punch');

      audioManager.playPunchImpact();
      setTimeout(() => {
        audioManager.playGlassShatter();
      }, 70);

      setTimeout(() => {
        setShowPunchFlash(false);
      }, 250);

      setTimeout(() => {
        setIsScreenShaking(false);
      }, 650);

      // Transition to Stage 4 (Pout) after punch sequence
      setTimeout(() => {
        setIsPunching(false);
        setMenuEasterEggStage(4);
        setCurrentMode('pet_pout');
        audioManager.playPoutHmph();
      }, 2400);
    } else if (menuEasterEggStage === 4) {
      // Stage 4: Pout interaction (Jiggle + steam puffs + cycling quotes)
      audioManager.playPoutHmph();
      setIsPoutJiggling(true);
      setTimeout(() => setIsPoutJiggling(false), 450);

      const steamId = Date.now();
      setSteamList(prev => [...prev, { id: steamId, x: (Math.random() - 0.5) * 35, y: Math.random() * 20 }]);
      setTimeout(() => {
        setSteamList(prev => prev.filter(s => s.id !== steamId));
      }, 1200);

      setPoutQuoteIdx(prev => (prev + 1) % POUT_QUOTES.VN.length);
      setCurrentMode('pet_pout');
    }
  };

  // Sprite Selector based on Easter Egg Stage
  const getCurrentSprite = () => {
    if (menuEasterEggStage === 1) return lucyShy1Sprite;
    if (menuEasterEggStage === 2) return lucyShy2Sprite;
    if (menuEasterEggStage === 3) return lucyPunchSprite;
    if (menuEasterEggStage === 4) return lucyPoutSprite;
    return lucyMenuSprite;
  };

  // Dynamic Hover Tooltip
  const getHoverHintText = () => {
    if (menuEasterEggStage === 0) {
      return isVi ? 'Chạm vào Giáo sư Lucy :3' : 'Poke Prof. Lucy :3';
    }
    if (menuEasterEggStage === 1) {
      return isVi ? 'Chọc tiếp xem sao :o' : 'Poke again? :o';
    }
    if (menuEasterEggStage === 2) {
      return isVi ? 'Cẩn thận! Sắp giận rồi đấy! >///<' : 'Careful! She\'s flustered! >///<';
    }
    if (menuEasterEggStage === 3) {
      return isVi ? 'BÙM! 💥' : 'POW! 💥';
    }
    return isVi ? 'Dỗ dành Giáo sư Lucy đi? 🥺' : 'Apologize to Prof. Lucy? 🥺';
  };

  // Dynamic Subtitle Text for Lucy Comms Box
  const getSubtitleText = () => {
    if (menuEasterEggStage === 1) {
      return isVi ? 'GS. LUCY // NGẠI NGÙNG' : 'PROF. LUCY // BLUSHING';
    }
    if (menuEasterEggStage === 2) {
      return isVi ? 'GS. LUCY // QUÁ TẢI CẢM XÚC' : 'PROF. LUCY // OVERHEATING';
    }
    if (menuEasterEggStage === 3) {
      return isVi ? 'GS. LUCY // CÚ ĐẤM LƯỢNG TỬ' : 'PROF. LUCY // QUANTUM STRIKE';
    }
    if (menuEasterEggStage === 4) {
      return isVi ? 'GS. LUCY // DỖI RỒI' : 'PROF. LUCY // POUTING';
    }
    return isVi ? 'CỐ VẤN AI PHÒNG LAB' : 'LEAD AI RESEARCHER';
  };

  // 3D Parallax & Depth Transforms for Lucy & Environment
  const avatarX = useTransform(smoothMouseX, [-1, 1], [-25, 25]);
  const avatarY = useTransform(smoothMouseY, [-1, 1], [-15, 15]);
  const avatarRotateY = useTransform(smoothMouseX, [-1, 1], [-8, 8]);
  const bgGridRotateX = useTransform(smoothMouseY, [-1, 1], [62, 58]);
  const bgShiftX = useTransform(smoothMouseX, [-1, 1], [-30, 30]);

  const activeTab = !isReagentDbOpen && !isSettingsOpen && !isSocraticModeActive && !isLearningModeActive && !isOrganicModeActive && !isCalculatingModeActive ? 'menu' : 'other';

  return (
    <div
      className={`absolute inset-0 z-50 bg-[#020611] text-white flex items-center justify-start overflow-hidden font-sans select-none selection:bg-cyan-500/30 ${
        isScreenShaking ? 'animate-punch-shake' : ''
      }`}
      onMouseMove={handleMouseMove}
    >
      {/* Permanent Glass Crack Fracture Overlay (Active in Menu upon punch) */}
      {isMenuCracked && <GlassCrackOverlay isVi={isVi} />}

      {/* Instant Screen Quantum Punch Flash */}
      <AnimatePresence>
        {showPunchFlash && (
          <motion.div
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 z-[95] bg-gradient-to-r from-white via-cyan-200 to-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* 3D Perspective Laboratory Floor Grid with Prismatic Chemical Spectrum */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ perspective: '800px' }}>
        <motion.div 
          className="absolute -bottom-[40%] left-[-20%] w-[140%] h-[120%] origin-bottom opacity-25 pointer-events-none"
          style={{
            rotateX: bgGridRotateX,
            backgroundImage: `
              linear-gradient(to right, rgba(16, 185, 129, 0.42) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(34, 211, 238, 0.38) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            maskImage: 'linear-gradient(to top, black 20%, transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to top, black 20%, transparent 85%)'
          }}
        />
      </div>

      {/* Breaking Bad 3D Chemical Formula & Volumetric Smoke Field */}
      <CanvasParticles />

      {/* Vivid Multi-Color Chemical Spectrum Nebulae ("Chemistry is About Colors") */}
      <motion.div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          x: bgShiftX,
          background: useTransform(
            () => `radial-gradient(circle at ${(smoothMouseX.get() / 2 + 0.5) * 100}% ${(smoothMouseY.get() / 2 + 0.5) * 100}%, rgba(16, 185, 129, 0.16) 0%, rgba(6, 182, 212, 0.10) 32%, rgba(168, 85, 247, 0.08) 58%, transparent 78%)`
          )
        }}
      />
      <div className="absolute -top-20 left-1/4 w-[650px] h-[650px] bg-emerald-500/12 rounded-full blur-[145px] pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-[680px] h-[680px] bg-cyan-500/12 rounded-full blur-[145px] pointer-events-none" />
      <div className="absolute bottom-12 left-1/3 w-[520px] h-[520px] bg-amber-500/10 rounded-full blur-[135px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[560px] h-[560px] bg-purple-600/14 rounded-full blur-[130px] pointer-events-none" />

      {/* Cyber Telemetry Accents (MiSide Room HUD) */}
      <div className="absolute top-6 left-8 z-20 pointer-events-none hidden lg:flex items-center gap-3 font-mono text-[10px] text-emerald-300/80 tracking-widest uppercase">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span>
          {isMenuCracked 
            ? 'CORE // QUANTUM ENGINE [SCREEN MATRIX: DAMAGED] [IMPACT DETECTED]'
            : 'CORE // PRISMATIC CHEMICAL ENGINE ACTIVE [SPECTRAL SYNTHESIS: ONLINE]'}
        </span>
      </div>

      {/* Smart Command & Settings Header Dock */}
      <div className="absolute top-6 right-6 z-[100] flex items-center gap-3">
        {/* Sleek Dual Segmented Language Toggle */}
        <LanguageToggle variant="segmented" />

        {/* Status Pill Indicator */}
        {!customApiKey ? (
          <button
            onClick={() => { audioManager.playClick(); setIsSettingsOpen(true); }}
            onMouseEnter={() => audioManager.playHover()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-950/80 to-red-950/80 border border-rose-500/60 hover:border-rose-400 text-rose-300 hover:text-white font-mono text-[10px] font-bold tracking-wider uppercase backdrop-blur-xl shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_25px_rgba(244,63,94,0.5)] transition-all cursor-pointer group active:scale-95"
          >
            <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#f43f5e] animate-ping" />
            <span>&lt; {isVi ? 'CẤU HÌNH API' : 'API SETUP'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#040e1c]/90 border border-cyan-800/60 text-cyan-300 font-mono text-[10px] font-bold tracking-wider uppercase backdrop-blur-xl shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
            <span>{isVi ? 'API HOẠT ĐỘNG' : 'API READY'}</span>
          </div>
        )}

        {/* The Cyber Gear Button */}
        <button 
          onClick={() => { audioManager.playClick(); setIsSettingsOpen(true); }}
          onMouseEnter={() => audioManager.playHover()}
          className="relative w-11 h-11 bg-[#050e1c]/90 hover:bg-cyan-950/70 border border-cyan-500/40 hover:border-cyan-400 rounded-2xl transition-all group shadow-[0_0_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_25px_rgba(34,211,238,0.35)] flex items-center justify-center cursor-pointer active:scale-95 backdrop-blur-xl"
          title={isVi ? 'Cài đặt hệ thống' : 'System Configuration'}
        >
          {!customApiKey && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-[#050e1c] shadow-[0_0_8px_#f43f5e]" />
            </span>
          )}
          
          <svg className="w-5 h-5 text-slate-300 group-hover:text-cyan-300 group-hover:rotate-90 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Professor Lucy Interactive Living Presence (MiSide Style Heroine) */}
      <motion.div
        className="absolute right-[-6%] lg:right-[-2%] bottom-[-35%] h-[140vh] max-h-[1500px] w-[65vw] max-w-[950px] z-10 origin-bottom pointer-events-none flex items-end justify-center"
        style={{ x: avatarX, y: avatarY, rotateY: avatarRotateY }}
      >
        {/* Floor Ambient Glow Shadow */}
        <div className="absolute bottom-2 w-96 h-16 bg-cyan-500/25 rounded-full blur-2xl pointer-events-none" />

        {/* Standing Lucy Sprite - Living & Grounded */}
        <div 
          onClick={handleLucyInteraction}
          className="relative h-full w-full flex items-end justify-center pointer-events-auto cursor-pointer group"
        >
          {/* Floating Steam Puffs for Tsundere / Pout Mode */}
          {steamList.map(steam => (
            <div 
              key={steam.id}
              className="absolute top-[28%] right-[32%] text-3xl pointer-events-none animate-steam select-none z-30"
              style={{ transform: `translate(${steam.x}px, ${steam.y}px)` }}
            >
              💨
            </div>
          ))}

          <motion.img 
            src={getCurrentSprite()} 
            alt="Prof. Lucy Main Menu Sprite" 
            animate={
              isPoutJiggling 
                ? { rotate: [-2, 2, -1, 1, 0], scale: [1, 1.03, 1] } 
                : isPunching 
                ? { scale: 1.08, x: [-6, 6, -3, 3, 0] } 
                : {}
            }
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={`h-full w-auto max-w-none object-contain object-bottom drop-shadow-[0_0_35px_rgba(6,182,212,0.25)] transition-all duration-300 select-none animate-[pulse_4.5s_ease-in-out_infinite] ${
              isBlushing ? 'scale-105 brightness-110 drop-shadow-[0_0_40px_rgba(244,63,94,0.5)]' : 'group-hover:drop-shadow-[0_0_45px_rgba(34,211,238,0.45)]'
            }`} 
          />

          {/* Cute interaction hint on hover - repositioned next to Lucy's shoulder */}
          <div className="absolute top-[38%] left-[20%] px-3.5 py-1.5 bg-[#050e1c]/90 border border-cyan-400/70 rounded-full text-xs font-mono text-cyan-300 opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-[0_0_20px_rgba(34,211,238,0.4)] backdrop-blur-md flex items-center gap-1.5 z-30">
            <span>👉</span>
            <span>{getHoverHintText()}</span>
          </div>
        </div>

        {/* Renovated Professor Lucy Holographic Chat Console (Wide, Vivid & Interactive) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMode + rawLanguage + (currentMode === 'pet_pout' ? poutQuoteIdx : '')}
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ position: 'absolute' }}
            className="scifi-hud-card absolute bottom-[31%] right-[47%] xl:right-[51%] w-[455px] xl:w-[485px] max-w-[90vw] bg-gradient-to-br from-[#06182c]/96 via-[#040f20]/96 to-[#09081c]/98 border-2 border-cyan-400/55 p-5 rounded-3xl backdrop-blur-2xl shadow-[0_15px_55px_rgba(0,0,0,0.92),0_0_35px_rgba(16,185,129,0.22)] z-50 overflow-visible pointer-events-auto"
          >
            {/* Top Prismatic Chemical Spectrum Ribbon */}
            <div className="absolute top-0 left-5 right-5 h-[3px] rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 via-purple-400 to-amber-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

            {/* Multi-color inner ambient glow */}
            <div className="absolute -top-12 -left-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Speech Bubble Pointer Tail pointing right towards Professor Lucy */}
            <div className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-5 h-5 bg-[#07162c] border-t-2 border-r-2 border-cyan-400/60 rotate-45 shadow-[4px_-4px_12px_rgba(34,211,238,0.25)]" />

            <div className="relative z-10">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-cyan-500/25">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-emerald-400 via-cyan-400 to-purple-500 shadow-[0_0_15px_rgba(52,211,153,0.45)]">
                      <img 
                        src={lucyFacePFP} 
                        alt="Prof. Lucy Avatar" 
                        className="w-10 h-10 rounded-full object-cover border border-slate-950"
                      />
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs md:text-sm text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-emerald-200 tracking-wider uppercase">
                        {isVi ? 'GIÁO SƯ LUCY' : 'PROF. LUCY'}
                      </span>
                      <span className="px-1.5 py-0.5 text-[8.5px] font-mono font-bold uppercase tracking-widest rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                        AI LIVE
                      </span>
                    </div>
                    <span className="text-[10px] text-cyan-300/90 font-mono tracking-wider block mt-0.5">
                      {getSubtitleText()}
                    </span>
                  </div>
                </div>

                {/* Voice Synthesis Button + Multi-Color Spectrum Equalizer */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      audioManager.playClick();
                      lucyVoiceEngine.speak(currentDialogue, isVi ? 'vi' : 'en');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-950/80 to-cyan-950/80 hover:from-emerald-900/90 hover:to-cyan-900/90 border border-emerald-400/50 text-emerald-200 text-[9.5px] font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] active:scale-95 cursor-pointer"
                    title={isVi ? 'Nghe giọng nói của Giáo sư Lucy' : 'Listen to Professor Lucy'}
                  >
                    <span>🔊</span>
                    <span>{isVi ? 'GIỌNG NÓI' : 'VOICE'}</span>
                  </button>

                  <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-cyan-500/30">
                    <span className="w-1 h-3 bg-emerald-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                    <span className="w-1 h-4 bg-cyan-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite_0.1s]" />
                    <span className="w-1 h-2.5 bg-purple-400 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.2s]" />
                    <span className="w-1 h-3.5 bg-amber-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.3s]" />
                    <span className="w-1 h-2 bg-rose-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite_0.15s]" />
                  </div>
                </div>
              </div>

              {/* Dynamic Speech Text Box */}
              <div className="bg-[#020813]/70 border border-cyan-500/20 rounded-2xl p-3.5 mb-3 shadow-inner">
                <p className="text-slate-100 text-[13.5px] leading-relaxed font-sans min-h-[54px]">
                  {displayedText}
                  <span className={`ml-1 inline-block w-1.5 h-3.5 bg-emerald-400 align-middle ${isTyping ? 'animate-pulse' : 'animate-bounce'}`} />
                </p>
              </div>

              {/* Interactive Quick-Topic Chips inside Main Menu Chat */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); audioManager.playClick(); setCurrentMode('topic_colors'); }}
                  className={`px-2.5 py-1 rounded-xl font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer border ${
                    currentMode === 'topic_colors'
                      ? 'bg-pink-500/25 border-pink-400 text-pink-200 shadow-[0_0_12px_rgba(236,72,153,0.35)]'
                      : 'bg-pink-950/40 hover:bg-pink-900/50 border-pink-500/35 text-pink-300'
                  }`}
                >
                  🎨 {isVi ? 'Sắc Màu Hóa Học' : 'Color Chemistry'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); audioManager.playClick(); setCurrentMode('topic_secret'); }}
                  className={`px-2.5 py-1 rounded-xl font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer border ${
                    currentMode === 'topic_secret'
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                      : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/35 text-amber-300'
                  }`}
                >
                  ✨ {isVi ? 'Bí Mật Lab' : 'Lab Secret'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); audioManager.playClick(); setCurrentMode('topic_quiz'); }}
                  className={`px-2.5 py-1 rounded-xl font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer border ${
                    currentMode === 'topic_quiz'
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                      : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/35 text-emerald-300'
                  }`}
                >
                  ⚡ {isVi ? 'Đố Vui' : 'Pop Quiz'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleLucyInteraction(); }}
                  className="px-2.5 py-1 rounded-xl font-mono text-[10px] font-bold tracking-wider bg-purple-950/40 hover:bg-purple-900/55 border border-purple-500/35 hover:border-purple-400 text-purple-200 transition-all cursor-pointer"
                >
                  🦊 {isVi ? 'Chọc Lucy' : 'Poke Lucy'}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Main Menu Left Stage UI - Anchored to the Left and Scaled Up */}
      <div className="z-30 w-full flex flex-col justify-center h-full pl-6 md:pl-10 lg:pl-14 pointer-events-none relative overflow-y-auto max-h-screen py-6 custom-scrollbar">
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full max-w-[530px] xl:max-w-[570px] pointer-events-auto flex flex-col gap-3 md:gap-3.5 my-auto"
        >
          {/* Futuristic AAA Holographic Title Plate - Refined Sci-Fi */}
          <div className="scifi-hud-card relative p-6 md:p-6.5 rounded-3xl bg-gradient-to-b from-[#051122]/95 via-[#020914]/95 to-[#01040a]/98 backdrop-blur-2xl border-2 border-cyan-500/35 shadow-[0_0_50px_rgba(0,0,0,0.92)] overflow-hidden group">
            {/* Ambient cyber grid watermark & glowing flare */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(6,182,212,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,182,212,0.04)_1px,transparent_1px)] bg-[size:22px_22px] pointer-events-none" />
            <div className="absolute -top-16 -right-16 w-52 h-52 bg-cyan-500/15 rounded-full blur-[55px] group-hover:bg-cyan-400/25 transition-colors duration-500 pointer-events-none" />

            <div className="relative z-10">
              {/* Brand Logo & Wordmark */}
              <ChemicLogo size="hero" isVi={isVi} />

              <div className="flex items-center gap-2.5 mt-3.5">
                <div className="inline-flex items-center gap-1.5 bg-cyan-950/70 border border-cyan-500/40 px-3 py-1 rounded-xl text-cyan-300 font-mono text-[11px] tracking-wider uppercase shadow-[0_0_12px_rgba(34,211,238,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>{isVi ? 'MÔ PHỎNG THỰC TẾ' : 'QUANTUM ENGINE'}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-slate-900/80 border border-cyan-800/40 px-3 py-1 rounded-xl text-slate-300 font-mono text-[11px] tracking-wider uppercase">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span>IUPAC 118 REAGENTS</span>
                </div>
              </div>

              {/* Refined Sci-Fi Action Bar with Bespoke SVG Vector Icons */}
              <div className="flex flex-wrap items-center gap-2 mt-3.5 pt-3 border-t border-cyan-900/40">
                <button
                  type="button"
                  onClick={() => { audioManager.playClick(); setScannerOpen(true); }}
                  onMouseEnter={() => audioManager.playHover()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041220]/80 hover:bg-cyan-950/90 border border-cyan-500/35 hover:border-cyan-300 text-cyan-200 text-[11px] font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(34,211,238,0.15)] active:scale-95 cursor-pointer"
                  title={isVi ? 'Quét đề bài Hóa học với Gemini 2.5 Flash' : 'Scan homework with Gemini 2.5 Flash'}
                >
                  <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>{isVi ? 'QUÉT ĐỀ (GEMINI)' : 'GEMINI VISION'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { audioManager.playClick(); setReportOpen(true); }}
                  onMouseEnter={() => audioManager.playHover()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041220]/80 hover:bg-blue-950/90 border border-blue-500/35 hover:border-blue-300 text-blue-200 text-[11px] font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] active:scale-95 cursor-pointer"
                  title={isVi ? 'Xem & Xuất báo cáo thực nghiệm Google Docs' : 'View & Export Google Docs Lab Report'}
                >
                  <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>{isVi ? 'BÁO CÁO (DOCS)' : 'LAB REPORT'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { audioManager.playClick(); setProfileOpen(true); }}
                  onMouseEnter={() => audioManager.playHover()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#030914] hover:bg-[#07152b] border border-cyan-800 text-slate-300 hover:text-white text-[11px] font-mono font-bold tracking-wider uppercase transition-all active:scale-95 cursor-pointer"
                  title={isVi ? 'Hồ sơ học sinh' : 'Student Profile'}
                >
                  <img src={googleUser.picture} alt="Avatar" className="w-4 h-4 rounded-full border border-cyan-400" />
                  <span className="truncate max-w-[85px]">{googleUser.name.split(' ')[0]}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { audioManager.playClick(); setFlameOpen(true); }}
                  onMouseEnter={() => audioManager.playHover()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041220]/80 hover:bg-amber-950/90 border border-amber-500/35 hover:border-amber-300 text-amber-200 text-[11px] font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] active:scale-95 cursor-pointer"
                  title={isVi ? 'Đốt Màu Ngọn Lửa & Quang Phổ Cation' : 'Bunsen Flame & Emission Spectroscopy'}
                >
                  <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                  </svg>
                  <span>{isVi ? 'QUANG PHỔ' : 'FLAME'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { audioManager.playClick(); setGalvanicOpen(true); }}
                  onMouseEnter={() => audioManager.playHover()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041220]/80 hover:bg-cyan-950/90 border border-cyan-500/35 hover:border-cyan-300 text-cyan-200 text-[11px] font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(34,211,238,0.15)] active:scale-95 cursor-pointer"
                  title={isVi ? 'Pin Điện Hóa Daniell & Bình Điện Phân' : 'Galvanic Daniell Cell & Electrolysis'}
                >
                  <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>{isVi ? 'PIN ĐIỆN' : 'GALVANIC'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { audioManager.playClick(); setKineticsOpen(true); }}
                  onMouseEnter={() => audioManager.playHover()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041220]/80 hover:bg-emerald-950/90 border border-emerald-500/35 hover:border-emerald-300 text-emerald-200 text-[11px] font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] active:scale-95 cursor-pointer"
                  title={isVi ? 'Đồ Thị Động Học ODE & Cân Bằng Le Chatelier' : 'Live ODE Kinetics & Le Chatelier'}
                >
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M19 9l-5 5-4-4-7 7" />
                  </svg>
                  <span>{isVi ? 'ĐỘNG HỌC' : 'KINETICS'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { audioManager.playClick(); setVseprOpen(true); }}
                  onMouseEnter={() => audioManager.playHover()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041220]/80 hover:bg-cyan-950/90 border border-cyan-400/40 hover:border-cyan-200 text-cyan-200 text-[11px] font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95 cursor-pointer"
                  title={isVi ? 'Mô Hình 3D VSEPR & Lai Hóa Orbital' : '3D VSEPR & Hybrid Orbitals'}
                >
                  <svg className="w-3.5 h-3.5 text-cyan-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(30 12 12)" />
                    <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-30 12 12)" />
                  </svg>
                  <span>{isVi ? 'VSEPR 3D' : 'VSEPR 3D'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Navigation Selector Buttons (Colorful Chemical Spectrum Command Deck) */}
          <div className="flex flex-col gap-2.5">
            {/* Primary Hero Button: START ENGINE */}
            <motion.button
              whileHover={{ scale: 1.015, x: 6 }}
              whileTap={{ scale: 0.985 }}
              onClick={handleStart}
              onMouseEnter={() => { audioManager.playHover(); setCurrentMode('start'); }}
              onMouseLeave={() => setCurrentMode('idle')}
              className="scifi-hud-card group relative px-6 py-4 md:py-4.5 bg-gradient-to-r from-[#042825]/95 via-[#041d33]/95 to-[#160b2e]/95 border-2 border-emerald-400/65 hover:border-cyan-300 rounded-3xl text-left transition-all duration-300 backdrop-blur-xl shadow-[0_0_35px_rgba(16,185,129,0.28)] hover:shadow-[0_0_50px_rgba(34,211,238,0.55)] overflow-hidden cursor-pointer"
            >
              {/* Laser sweep animation on hover */}
              <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent -translate-x-[100%] group-hover:animate-[sweep_1.4s_ease-in-out_infinite]" />
              
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <span className="block font-mono text-emerald-300 text-[10.5px] tracking-[0.28em] uppercase mb-0.5 font-bold">
                    {isVi ? 'KHỞI TẠO // BÀN THỰC NGHIỆM ĐA SẮC' : 'INITIALIZE WORKBENCH // PRIMARY PROTOCOL'}
                  </span>
                  <span className="block font-black text-2xl md:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-cyan-200 tracking-wider uppercase font-mono">
                    {isVi ? 'BẮT ĐẦU THÍ NGHIỆM' : 'START ENGINE'}
                  </span>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-emerald-400/60 group-hover:border-white group-hover:from-emerald-400 group-hover:to-cyan-400 group-hover:text-slate-950 flex items-center justify-center text-emerald-200 group-hover:translate-x-1.5 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  <svg className="w-5 h-5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            </motion.button>

            {/* Feature Modes Grid/Stack */}
            <div className="flex flex-col gap-2.5">
              {/* 01: Socratic Challenge Mode (Strontium Crimson / Rose) */}
              <motion.button 
                whileHover={{ x: 6 }}
                onClick={() => { audioManager.playClick(); useSimulationStore.getState().setSocraticMode(true); }}
                onMouseEnter={() => { audioManager.playHover(); setCurrentMode('socratic'); }}
                onMouseLeave={() => setCurrentMode('idle')}
                className="relative px-5 py-3 md:py-3.5 bg-gradient-to-r from-rose-950/50 via-[#071122]/90 to-[#040a16]/95 hover:from-rose-900/60 hover:via-[#0b172e]/95 border border-rose-500/35 hover:border-rose-400/80 border-l-4 border-l-rose-500 rounded-2xl text-left transition-all duration-200 backdrop-blur-xl flex items-center justify-between group shadow-[0_0_18px_rgba(244,63,94,0.12)] hover:shadow-[0_0_28px_rgba(244,63,94,0.35)] cursor-pointer overflow-hidden"
              >
                <div className="flex items-center gap-3.5">
                  <span className="w-8 h-8 rounded-xl bg-rose-950/80 border border-rose-400/50 text-rose-300 font-mono text-xs md:text-sm font-bold flex items-center justify-center group-hover:border-rose-300 group-hover:text-white transition-all shadow-[0_0_10px_rgba(244,63,94,0.25)]">
                    01
                  </span>
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold tracking-wider uppercase text-sm md:text-base group-hover:text-rose-100 transition-colors flex items-center gap-2">
                      {isVi ? 'THÁCH THỨC SOCRATIC' : 'SOCRATIC CHALLENGE'}
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/50 text-rose-200 font-mono font-bold uppercase tracking-wider">
                        {isVi ? 'BẺ GÃY NGỘ NHẬN' : 'LOGIC PROTOCOL'}
                      </span>
                    </span>
                    <span className="text-xs text-slate-300/80 font-mono">
                      {isVi ? 'Chất vấn sâu & Rèn luyện tư duy phản biện Hóa học' : 'Strict Chemical Logic Interrogation'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  </svg>
                  <span className="text-rose-400 group-hover:text-rose-200 group-hover:translate-x-1 transition-all text-xs font-mono font-bold">→</span>
                </div>
              </motion.button>

              {/* 02: Learning Lab Mode (Viridian / Emerald) */}
              <motion.button 
                whileHover={{ x: 6 }}
                onClick={() => { audioManager.playClick(); useSimulationStore.getState().setLearningMode(true); }}
                onMouseEnter={() => { audioManager.playHover(); setCurrentMode('learning'); }}
                onMouseLeave={() => setCurrentMode('idle')}
                className="relative px-5 py-3 md:py-3.5 bg-gradient-to-r from-emerald-950/50 via-[#061622]/90 to-[#040a16]/95 hover:from-emerald-900/60 hover:via-[#092230]/95 border border-emerald-500/35 hover:border-emerald-400/80 border-l-4 border-l-emerald-400 rounded-2xl text-left transition-all duration-200 backdrop-blur-xl flex items-center justify-between group shadow-[0_0_18px_rgba(16,185,129,0.12)] hover:shadow-[0_0_28px_rgba(16,185,129,0.35)] cursor-pointer overflow-hidden"
              >
                <div className="flex items-center gap-3.5">
                  <span className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-400/50 text-emerald-300 font-mono text-xs md:text-sm font-bold flex items-center justify-center group-hover:border-emerald-300 group-hover:text-white transition-all shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                    02
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-bold tracking-wider uppercase text-sm md:text-base group-hover:text-emerald-100 transition-colors">
                        {isVi ? 'PHÒNG CỐ VẤN HỌC TẬP' : 'LEARNING LAB & MENTOR'}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-mono font-bold uppercase tracking-wider">
                        {isVi ? 'THPT QUỐC GIA' : 'AI TUTOR'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-300/80 font-mono">
                      {isVi ? 'Hỗ trợ giải bài tập & Luyện thi THPTQG 2026-2027' : 'Homework Assistant & Curriculum Tutor'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  <span className="text-emerald-400 group-hover:text-emerald-200 group-hover:translate-x-1 transition-all text-xs font-mono font-bold">→</span>
                </div>
              </motion.button>

              {/* 03: Reagent Database (Copper Sulfate Cyan) */}
              <motion.button 
                whileHover={{ x: 6 }}
                onClick={() => { audioManager.playClick(); setIsReagentDbOpen(true); }}
                onMouseEnter={() => { audioManager.playHover(); setCurrentMode('reagent'); }}
                onMouseLeave={() => setCurrentMode('idle')}
                className="relative px-5 py-3 md:py-3.5 bg-gradient-to-r from-cyan-950/55 via-[#061628]/90 to-[#040a16]/95 hover:from-cyan-900/65 hover:via-[#092038]/95 border border-cyan-500/35 hover:border-cyan-400/80 border-l-4 border-l-cyan-400 rounded-2xl text-left transition-all duration-200 backdrop-blur-xl flex items-center justify-between group shadow-[0_0_18px_rgba(6,182,212,0.12)] hover:shadow-[0_0_28px_rgba(6,182,212,0.35)] cursor-pointer overflow-hidden"
              >
                <div className="flex items-center gap-3.5">
                  <span className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 font-mono text-xs md:text-sm font-bold flex items-center justify-center group-hover:border-cyan-300 group-hover:text-white transition-all shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                    03
                  </span>
                  <div className="flex flex-col">
                    <span className="text-slate-100 font-bold tracking-wider uppercase text-sm md:text-base group-hover:text-cyan-100 transition-colors">
                      {isVi ? 'TỪ ĐIỂN 118 NGUYÊN TỐ' : 'REAGENT DATABASE'}
                    </span>
                    <span className="text-xs text-slate-300/80 font-mono">
                      {isVi ? 'Tra cứu orbital & thông số hóa học IUPAC' : 'Quantum Electron Orbitals & Reagents'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="12" rx="10" ry="4" />
                    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
                    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                  <span className="text-cyan-400 group-hover:text-cyan-200 group-hover:translate-x-1 transition-all text-xs font-mono font-bold">→</span>
                </div>
              </motion.button>

              {/* 04: Organic Chemistry Wordle Puzzle (Permanganate Royal Violet) */}
              <motion.button 
                whileHover={{ x: 6 }}
                onClick={() => { audioManager.playClick(); useSimulationStore.getState().setOrganicMode(true); }}
                onMouseEnter={() => { audioManager.playHover(); setCurrentMode('organic'); }}
                onMouseLeave={() => setCurrentMode('idle')}
                className="relative px-5 py-3 md:py-3.5 bg-gradient-to-r from-purple-950/55 via-[#0e0c26]/90 to-[#040a16]/95 hover:from-purple-900/65 hover:via-[#161236]/95 border border-purple-500/35 hover:border-purple-400/80 border-l-4 border-l-purple-400 rounded-2xl text-left transition-all duration-200 backdrop-blur-xl flex items-center justify-between group shadow-[0_0_18px_rgba(168,85,247,0.12)] hover:shadow-[0_0_28px_rgba(168,85,247,0.35)] cursor-pointer overflow-hidden"
              >
                <div className="flex items-center gap-3.5">
                  <span className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-400/50 text-purple-300 font-mono text-xs md:text-sm font-bold flex items-center justify-center group-hover:border-purple-300 group-hover:text-white transition-all shadow-[0_0_10px_rgba(168,85,247,0.25)]">
                    04
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-bold tracking-wider uppercase text-sm md:text-base group-hover:text-purple-100 transition-colors">
                        {isVi ? 'HÓA HỌC HỮU CƠ' : 'ORGANIC CHEMISTRY'}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/50 text-purple-200 font-mono font-bold tracking-wider uppercase">
                        CRAFT / PUZZLE
                      </span>
                    </div>
                    <span className="text-xs text-slate-300/80 font-mono">
                      {isVi ? 'Xưởng phân tử vô tận & Câu đố tổng hợp' : 'Molecular Sandbox & Synthesis Puzzle'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l7.5 4.3v8.6L12 22l-7.5-4.3V6.3L12 2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="text-purple-400 group-hover:text-purple-200 group-hover:translate-x-1 transition-all text-xs font-mono font-bold">→</span>
                </div>
              </motion.button>

              {/* 05: Complete Chemistry Curriculum Academy (Malachite Teal) */}
              <motion.button 
                whileHover={{ x: 6 }}
                onClick={() => { audioManager.playClick(); setIsCurriculumOpen(true); }}
                onMouseEnter={() => { audioManager.playHover(); setCurrentMode('learning'); }}
                onMouseLeave={() => setCurrentMode('idle')}
                className="relative px-5 py-3 md:py-3.5 bg-gradient-to-r from-teal-950/55 via-[#061824]/90 to-[#040a16]/95 hover:from-teal-900/65 hover:via-[#092434]/95 border border-teal-500/35 hover:border-teal-400/80 border-l-4 border-l-teal-400 rounded-2xl text-left transition-all duration-200 backdrop-blur-xl flex items-center justify-between group shadow-[0_0_18px_rgba(20,184,166,0.12)] hover:shadow-[0_0_28px_rgba(20,184,166,0.35)] cursor-pointer overflow-hidden"
              >
                <div className="flex items-center gap-3.5">
                  <span className="w-8 h-8 rounded-xl bg-teal-950/80 border border-teal-400/50 text-teal-300 font-mono text-xs md:text-sm font-bold flex items-center justify-center group-hover:border-teal-300 group-hover:text-white transition-all shadow-[0_0_10px_rgba(20,184,166,0.25)]">
                    05
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-bold tracking-wider uppercase text-sm md:text-base group-hover:text-teal-100 transition-colors">
                        {isVi ? 'GIÁO TRÌNH HÓA HỌC 8 - 12' : 'CHEMISTRY ACADEMY (8-12)'}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-teal-500/20 border border-teal-400/50 text-teal-200 font-mono font-bold tracking-wider uppercase">
                        KẾT NỐI TRI THỨC
                      </span>
                    </div>
                    <span className="text-xs text-slate-300/80 font-mono">
                      {isVi ? 'Toàn bộ bài học, định luật, công thức & thí nghiệm' : 'Complete Curriculum, Formulas & Direct Lab Load'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span className="text-teal-400 group-hover:text-teal-200 group-hover:translate-x-1 transition-all text-xs font-mono font-bold">→</span>
                </div>
              </motion.button>

              {/* 06: Calculating Mode (Dichromate Amber / Gold) */}
              <motion.button 
                whileHover={{ x: 6 }}
                onClick={() => { audioManager.playClick(); useSimulationStore.getState().setCalculatingMode(true); }}
                onMouseEnter={() => { audioManager.playHover(); setCurrentMode('calculating'); }}
                onMouseLeave={() => setCurrentMode('idle')}
                className="relative px-5 py-3 md:py-3.5 bg-gradient-to-r from-amber-950/55 via-[#161209]/90 to-[#040a16]/95 hover:from-amber-900/65 hover:via-[#241c0d]/95 border border-amber-500/35 hover:border-amber-400/80 border-l-4 border-l-amber-400 rounded-2xl text-left transition-all duration-200 backdrop-blur-xl flex items-center justify-between group shadow-[0_0_18px_rgba(245,158,11,0.12)] hover:shadow-[0_0_28px_rgba(245,158,11,0.35)] cursor-pointer overflow-hidden"
              >
                <div className="flex items-center gap-3.5">
                  <span className="w-8 h-8 rounded-xl bg-amber-950/80 border border-amber-400/50 text-amber-300 font-mono text-xs md:text-sm font-bold flex items-center justify-center group-hover:border-amber-300 group-hover:text-white transition-all shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                    06
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-bold tracking-wider uppercase text-sm md:text-base group-hover:text-amber-100 transition-colors">
                        {isVi ? 'CHẾ ĐỘ TÍNH TOÁN // BẢNG CÔNG THỨC' : 'CALCULATING MODE // FORMULA LAB'}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-200 font-mono font-bold tracking-wider uppercase">
                        GDPT 2018
                      </span>
                    </div>
                    <span className="text-xs text-slate-300/80 font-mono">
                      {isVi ? 'Bảng công thức 8-12, máy tính thế số & bài tập lượng giác' : 'Formula Sheet, Variable Solvers & Stoichiometry Practice'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <line x1="8" y1="6" x2="16" y2="6" />
                    <line x1="16" y1="14" x2="16" y2="18" />
                    <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
                  </svg>
                  <span className="text-amber-400 group-hover:text-amber-200 group-hover:translate-x-1 transition-all text-xs font-mono font-bold">→</span>
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Overlays & Modals */}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      <MultimodalScannerModal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} />
      <LabReportModal isOpen={isReportOpen} onClose={() => setReportOpen(false)} />
      <GoogleProfileModal isOpen={isProfileOpen} onClose={() => setProfileOpen(false)} onUserUpdated={setGoogleUser} />
      <CurriculumLearningModal isOpen={isCurriculumOpen} onClose={() => setIsCurriculumOpen(false)} />
      <FlameSpectroscopyModal isOpen={isFlameOpen} onClose={() => setFlameOpen(false)} isVi={isVi} />
      <GalvanicCellModal isOpen={isGalvanicOpen} onClose={() => setGalvanicOpen(false)} isVi={isVi} />
      <ReactionKineticsModal isOpen={isKineticsOpen} onClose={() => setKineticsOpen(false)} isVi={isVi} />
      <VseprOrbitalModal isOpen={isVseprOpen} onClose={() => setVseprOpen(false)} isVi={isVi} />
      <AnimatePresence>
        {isReagentDbOpen && (
          <ErrorBoundary>
            <ReagentDatabase onBack={() => setIsReagentDbOpen(false)} />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      {/* Developer Contact Widget (Bottom Right) */}
      {activeTab === 'menu' && (
        <ContactWidget />
      )}

      <style>{`
        @keyframes sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default MainMenu;
