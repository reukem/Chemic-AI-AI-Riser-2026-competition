import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSimulationStore, getTableBenchY } from './store';
import { CHEMICAL_REGISTRY, REACTION_RULES } from '../data/ChemicalRegistry';
import { evaluateThermodynamicState } from './ThermodynamicEngine';
import { getOpticalProfile } from './opticalProperties';
import { FluidSpringSolver } from './physics/FluidSpringSolver';
import { ContainerParticleSystem } from './physics/ContainerParticleSystem';
import { getPrecipitateProfile } from './chemistry/PrecipitateRegistry';
import { analyzeContainerSolution } from './chemistry/IonicDissociation';
import { calculateSolutionOptics } from './chemistry/BeerLambertOptics';
import { t } from '../i18n/uiTranslations';

const hexToRgb = (hex: string) => {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
};

interface LabContainerProps {
    id: number;
    isDragging?: boolean;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    draggingContainerId?: number | null;
}

const LabContainer: React.FC<LabContainerProps> = ({ id, isDragging, onDragStart, onDragEnd, draggingContainerId }) => {
    const container = useSimulationStore(state => state.containers.find(b => b.id === id));
    const addReagentToContainer = useSimulationStore(state => state.addReagentToContainer);
    const pourContainer = useSimulationStore(state => state.pourContainer);
    const activeEffect = useSimulationStore(state => state.activeEffect);
    const activeEffectContainerId = useSimulationStore(state => state.activeEffectContainerId);
    const env = useSimulationStore(state => state.env);
    const language = useSimulationStore(state => state.language);
    const isVi = String(language).toLowerCase().includes('v');
    const selectedContainerId = useSimulationStore(state => state.selectedContainerId);
    const setSelectedContainerId = useSimulationStore(state => state.setSelectedContainerId);
    const clearContainer = useSimulationStore(state => state.clearContainer);
    const removeContainer = useSimulationStore(state => state.removeContainer);
    const setEnvTemp = useSimulationStore(state => state.setEnvTemp);
    const updateContainerPosition = useSimulationStore(state => state.updateContainerPosition);
    const isSelected = selectedContainerId === id;

    // Real-time synchronization with Environment Matrix
    const currentTemp = env.temp ?? (env as any).temperature ?? 25;
    const currentPressure = env.pressure ?? 1.0;

    // Detect pending thermal reaction requirement
    const pendingThermalRule = useMemo(() => {
        if (!container || !container.contents || container.volume <= 0) return null;

        if ((container.contents['COPPER_POLYOL_COMPLEX'] || 0) > 0.001 && currentTemp < 60) {
            return {
                minTemperature: 60,
                name: 'Fehling Reduction (Cu₂O ↓)',
                equation: 'GLUCOSE + Cu(OH)₂ -(t° ≥ 60°C)-> Cu₂O ↓'
            };
        }

        const keys = Object.keys(container.contents).filter(k => (container.contents[k] || 0) > 0.001);
        if (keys.length < 2) return null;

        for (const rule of REACTION_RULES) {
            if (rule.minTemperature && currentTemp < rule.minTemperature) {
                const r0 = rule.reactants[0];
                const r1 = rule.reactants[1];
                if ((container.contents[r0] || 0) > 0.001 && (container.contents[r1] || 0) > 0.001) {
                    return rule;
                }
            }
        }
        return null;
    }, [container?.contents, container?.volume, currentTemp]);

    // Re-evaluate pending thermal reactions when the temperature slider moves
    useEffect(() => {
        if (!container || container.volume <= 0 || !container.contents) return;

        if ((container.contents['COPPER_POLYOL_COMPLEX'] || 0) > 0.001 && currentTemp >= 60) {
            setEnvTemp(currentTemp);
            return;
        }

        const keys = Object.keys(container.contents).filter(k => (container.contents[k] || 0) > 0.001);
        if (keys.length < 2) return;

        for (const rule of REACTION_RULES) {
            if (rule.minTemperature && currentTemp >= rule.minTemperature) {
                const r0 = rule.reactants[0];
                const r1 = rule.reactants[1];
                if ((container.contents[r0] || 0) > 0.001 && (container.contents[r1] || 0) > 0.001) {
                    setEnvTemp(currentTemp);
                    break;
                }
            }
        }
    }, [currentTemp, container?.contents, container?.volume, setEnvTemp]);

    // DOM & System Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pourIntervalRef = useRef<any>(null);

    const [isSnapping, setIsSnapping] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [liveDragPos, setLiveDragPos] = useState<{ x: number; y: number } | null>(null);

    // Direct DOM manipulation refs for 120 FPS liquid slosh waves (zero React re-render)
    const liquidBodyRef = useRef<HTMLDivElement>(null);
    const frontWaveRef = useRef<SVGPathElement>(null);
    const backWaveRef = useRef<SVGPathElement>(null);
    const meniscusPathRef = useRef<SVGPathElement>(null);

    const pointerOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragXRef = useRef(container?.x || 500);

    // Modular Fluid Dynamics Solver & Particle Engine
    const springSolverRef = useRef(new FluidSpringSolver(20, container?.x || 500));
    const particleSystemRef = useRef(new ContainerParticleSystem());

    // Compute live thermodynamic state for this container
    const thermoState = container ? evaluateThermodynamicState(container, env) : null;

    // Drag and Drop Logic for chemical reagents
    const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('containerid')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'none';
            return;
        }

        const reagentType = Array.from(e.dataTransfer.types).find(t => t.startsWith('reagent-'));
        if (reagentType) {
            const chemId = reagentType.replace('reagent-', '');
            const chemical = CHEMICAL_REGISTRY[chemId];
            if (chemical?.type === 'solid' && container?.type === 'flask') {
                e.dataTransfer.dropEffect = 'none';
                return;
            }
        }

        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('drag-over');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const reagentId = e.dataTransfer.getData('text/plain');
        if (reagentId) {
            const chemical = CHEMICAL_REGISTRY[reagentId];
            if (chemical?.type === 'solid' && container?.type === 'flask') {
                return;
            }
            addReagentToContainer(id, reagentId);
        }
    };

    // Pointer Drag & Table-Clamping
    const handlePointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('.no-drag')) {
            return;
        }

        e.preventDefault();
        const tableY = getTableBenchY();
        const startX = container?.x ?? 500;
        const startY = container?.y ?? tableY;
        
        pointerOffsetRef.current = {
            x: e.clientX - startX,
            y: e.clientY - startY
        };
        setLiveDragPos({ x: startX, y: startY });
        dragXRef.current = startX;
        setIsSnapping(false);
        useSimulationStore.getState().setDraggingContainerId(id);
        if (onDragStart) onDragStart();
    };

    const handlePourMouseDown = (e: React.MouseEvent) => {
        const state = useSimulationStore.getState();
        if (state.isPaused || state.pendingReaction) return;

        if (draggingContainerId !== null && draggingContainerId !== id) {
            const sourceContainer = state.containers.find(c => c.id === draggingContainerId);
            if (sourceContainer) {
                const sourceThermo = evaluateThermodynamicState(sourceContainer, state.env);
                if (sourceThermo.isFrozen) {
                    console.warn("Substance is frozen solid! Cannot pour.");
                    return;
                }
            }

            if (pourIntervalRef.current) clearInterval(pourIntervalRef.current);
            pourIntervalRef.current = setInterval(() => {
                pourContainer(draggingContainerId, id, 500 - Math.min(e.clientY, 500));
            }, 50);
        }
    };

    const handlePourMouseUp = () => {
        if (pourIntervalRef.current) {
            clearInterval(pourIntervalRef.current);
            pourIntervalRef.current = null;
        }
    };

    // 20-Node Coupled 1D Shallow-Water Spring Array Solver (Runs at 120 FPS directly on GPU/DOM)
    useEffect(() => {
        let animId: number;

        const updateSlosh = (now: number) => {
            const solver = springSolverRef.current;
            solver.step(now, dragXRef.current, thermoState?.isBoiling, 1.0);

            const { frontPolygon, backPolygon, meniscusStroke } = solver.generatePaths();

            if (frontWaveRef.current) {
                frontWaveRef.current.setAttribute('d', frontPolygon);
            }
            if (backWaveRef.current) {
                backWaveRef.current.setAttribute('d', backPolygon);
            }
            if (meniscusPathRef.current) {
                meniscusPathRef.current.setAttribute('d', meniscusStroke);
            }

            animId = requestAnimationFrame(updateSlosh);
        };

        animId = requestAnimationFrame(updateSlosh);
        return () => cancelAnimationFrame(animId);
    }, [thermoState?.isBoiling]);

    // Pointer Movement Window Listeners
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!isDragging) return;
            const newX = e.clientX - pointerOffsetRef.current.x;
            const newY = e.clientY - pointerOffsetRef.current.y;
            
            const currentTableY = getTableBenchY();
            const clampedX = Math.max(70, Math.min(window.innerWidth - 180, newX));
            const clampedY = Math.max(80, Math.min(currentTableY, newY));
            
            setLiveDragPos({ x: clampedX, y: clampedY });
            dragXRef.current = clampedX;
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (!isDragging) return;
            
            const currentTableY = getTableBenchY();
            const finalX = dragXRef.current;
            const finalY = currentTableY; // Firmly seated on table surface!
            
            setIsSnapping(true);
            setLiveDragPos({ x: finalX, y: finalY });
            updateContainerPosition(id, finalX, finalY);
            useSimulationStore.getState().setDraggingContainerId(null);
            
            setTimeout(() => {
                setIsSnapping(false);
                setLiveDragPos(null);
                if (onDragEnd) onDragEnd();
            }, 200);
        };

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        } else if (container?.x !== undefined) {
            dragXRef.current = container.x;
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, id, onDragEnd, updateContainerPosition, container?.x]);

    // Active Effect Particle Burst Trigger
    useEffect(() => {
        if (activeEffect && activeEffectContainerId === id && container) {
            const r = container.color.r || 255;
            const g = container.color.g || 255;
            const b = container.color.b || 255;
            particleSystemRef.current.spawnBurst(activeEffect, r, g, b, container.volume, container.maxVol);
        }
    }, [activeEffect, activeEffectContainerId, id, container?.color, container?.volume, container?.maxVol]);

    // Mount Particle System to Canvas & Drive Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const particleSystem = particleSystemRef.current;
        particleSystem.mount(canvas);

        const handleResize = () => particleSystem.resize();
        window.addEventListener('resize', handleResize);

        let animId: number;
        const animate = () => {
            if (useSimulationStore.getState().activeTab !== 'lab') {
                animId = requestAnimationFrame(animate);
                return;
            }

            const state = useSimulationStore.getState();
            const isPaused = state.isPaused;
            const isEffervescing = !isPaused && (activeEffectContainerId === id) && 
                (activeEffect === 'fizz' || activeEffect === 'bubbles' || activeEffect === 'smoke');

            if (container) {
                particleSystem.tick(
                    isPaused,
                    isEffervescing,
                    thermoState,
                    container.contents,
                    container.volume,
                    container.maxVol
                );
            }

            animId = requestAnimationFrame(animate);
        };

        animId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animId);
            particleSystem.unmount();
        };
    }, [thermoState, container?.volume, container?.maxVol, activeEffect, activeEffectContainerId, id]);

    if (!container) return null;

    const heightPct = (container.volume / container.maxVol) * 90;
    const r = container.color.r;
    const g = container.color.g;
    const b = container.color.b;
    const rgbaColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
    const rgbColor = `rgb(${r}, ${g}, ${b})`;

    // Detect active precipitate from Precipitate Registry
    let activePrecipitate: { color: string; label: string; bgGrad: string; volume: number } | null = null;
    if (container.contents) {
        for (const [chemId, vol] of Object.entries(container.contents)) {
            if (vol && vol > 0.05) {
                const profile = getPrecipitateProfile(chemId);
                if (chemId.endsWith('_PRECIPITATE') || chemId === 'SILVER' || chemId === 'CARBON' || chemId === 'MANGANESE_DIOXIDE' || chemId === 'MgO_SOLID') {
                    activePrecipitate = {
                        color: profile.color,
                        label: profile.label,
                        bgGrad: profile.bgGrad,
                        volume: vol
                    };
                    break;
                }
            }
        }
    }

    const sedimentHeightPct = activePrecipitate && container.volume > 0
        ? Math.min(35, Math.max(10, (activePrecipitate.volume / container.maxVol) * 85 * 1.6))
        : 0;

    // Optical Profile & Immiscible Layer Phase Separation
    let dominantSubstanceId = 'DISTILLED_WATER';
    let maxSubVol = 0;
    let organicVol = 0;
    let aqueousVol = 0;
    let dominantOrganicKey = '';

    if (container.contents) {
        for (const [chemId, vol] of Object.entries(container.contents)) {
            if (vol > 0.001) {
                const opt = getOpticalProfile(chemId);
                if (opt.isImmiscibleAq) {
                    organicVol += vol;
                    if (!dominantOrganicKey || vol > (container.contents[dominantOrganicKey] || 0)) {
                        dominantOrganicKey = chemId;
                    }
                } else if (!chemId.endsWith('_PRECIPITATE')) {
                    aqueousVol += vol;
                }
                if (vol > maxSubVol && !chemId.endsWith('_PRECIPITATE')) {
                    maxSubVol = vol;
                    dominantSubstanceId = chemId;
                }
            }
        }
    }

    const dominantOpt = getOpticalProfile(dominantSubstanceId, `rgb(${r},${g},${b})`);
    const hasImmiscibleLayers = organicVol > 0.05 && aqueousVol > 0.05;
    const organicLayerPct = hasImmiscibleLayers ? Math.min(80, Math.max(20, (organicVol / (organicVol + aqueousVol)) * 100)) : 0;
    const organicOpt = dominantOrganicKey ? getOpticalProfile(dominantOrganicKey) : null;

    // Universal indicator color blending
    const hasUniversalIndicator = container.contents && (container.contents['UNIVERSAL_INDICATOR'] || 0) > 0.001;
    const isStarchDeheated = (container.contents?.['STARCH_IODINE_COMPLEX'] || 0) > 0.001 && currentTemp >= 80;

    let dynamicLiquidBg: string | undefined = undefined;
    let effectiveR = r;
    let effectiveG = g;
    let effectiveB = b;

    if (hasUniversalIndicator) {
        const ph = container.ph;
        let indHex = '#22c55e'; // Green pH 7
        if (ph < 3.0) indHex = '#ef4444'; // Crimson Red
        else if (ph < 5.0) indHex = '#f97316'; // Vibrant Orange
        else if (ph < 6.5) indHex = '#eab308'; // Amber Yellow
        else if (ph <= 7.5) indHex = '#22c55e'; // Neutral Emerald Green
        else if (ph <= 9.5) indHex = '#06b6d4'; // Teal Cyan
        else if (ph <= 11.5) indHex = '#3b82f6'; // Royal Blue
        else indHex = '#7c3aed'; // Deep Alkaline Violet

        const indRgb = hexToRgb(indHex);
        effectiveR = indRgb.r;
        effectiveG = indRgb.g;
        effectiveB = indRgb.b;

        dynamicLiquidBg = `linear-gradient(180deg, rgba(${effectiveR}, ${effectiveG}, ${effectiveB}, 0.88) 0%, rgba(${Math.max(0, effectiveR - 30)}, ${Math.max(0, effectiveG - 30)}, ${Math.max(0, effectiveB - 30)}, 0.95) 100%)`;
    } else if (dominantOpt.isWaterClear) {
        if (dominantOpt.hue === 'slight_blue') {
            effectiveR = 224;
            effectiveG = 242;
            effectiveB = 254;
            dynamicLiquidBg = `linear-gradient(180deg, rgba(224, 242, 254, 0.18) 0%, rgba(186, 230, 253, 0.28) 55%, rgba(147, 197, 253, 0.42) 100%)`;
        } else if (dominantOpt.hue === 'faint_yellow') {
            effectiveR = 254;
            effectiveG = 249;
            effectiveB = 195;
            dynamicLiquidBg = `linear-gradient(180deg, rgba(254, 249, 195, 0.22) 0%, rgba(254, 240, 138, 0.35) 60%, rgba(253, 224, 71, 0.48) 100%)`;
        } else {
            effectiveR = 224;
            effectiveG = 242;
            effectiveB = 254;
            dynamicLiquidBg = `linear-gradient(180deg, rgba(224, 242, 254, 0.12) 0%, rgba(186, 230, 253, 0.22) 55%, rgba(125, 211, 252, 0.35) 100%)`;
        }
    } else if (isStarchDeheated) {
        effectiveR = 224;
        effectiveG = 242;
        effectiveB = 254;
        dynamicLiquidBg = `linear-gradient(180deg, rgba(224, 242, 254, 0.18) 0%, rgba(186, 230, 253, 0.25) 55%, rgba(147, 197, 253, 0.32) 100%)`;
    }

    // Authentic Beer-Lambert Optics & Solution Dissociation Telemetry
    const solutionOptics = calculateSolutionOptics(container.contents, container.volume);
    const solutionAnalysis = analyzeContainerSolution(container.contents, container.volume);

    const fluidAlpha = solutionOptics.alpha;
    const finalLiquidBg = dynamicLiquidBg || (
        dominantOpt.isWaterClear 
            ? `linear-gradient(180deg, rgba(224, 242, 254, 0.15) 0%, rgba(186, 230, 253, 0.3) 100%)`
            : `linear-gradient(180deg, rgba(${effectiveR}, ${effectiveG}, ${effectiveB}, ${Math.max(0.3, fluidAlpha * 0.85)}) 0%, rgba(${Math.max(0, effectiveR - 25)}, ${Math.max(0, effectiveG - 25)}, ${Math.max(0, effectiveB - 25)}, ${fluidAlpha}) 100%)`
    );

    const tableBenchY = getTableBenchY();
    const currentX = (isDragging || isSnapping) && liveDragPos ? liveDragPos.x : (container?.x ?? 500);
    const currentY = (isDragging || isSnapping) && liveDragPos ? liveDragPos.y : (container?.y ?? tableBenchY);

    const isExploding = activeEffect === 'explosion' && activeEffectContainerId === id;

    const heatFactor = Math.min(1, Math.max(0, (currentTemp - 25) / 155));
    const isCold = currentTemp <= 5;
    const isHot = currentTemp >= 35;

    const isFlask = container.type === 'flask';
    const label = `#${container.id}`;

    const frontWaveColor = dominantOpt.isWaterClear
        ? 'rgba(224, 242, 254, 0.45)'
        : `rgba(${Math.min(255, effectiveR + 30)}, ${Math.min(255, effectiveG + 30)}, ${Math.min(255, effectiveB + 30)}, 0.85)`;
    const backWaveColor = dominantOpt.isWaterClear
        ? 'rgba(186, 230, 253, 0.35)'
        : `rgba(${Math.max(0, effectiveR - 20)}, ${Math.max(0, effectiveG - 20)}, ${Math.max(0, effectiveB - 20)}, 0.7)`;

    return (
        <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerCancel={() => {
               if (isDragging && onDragEnd) onDragEnd();
            }}
            onMouseDown={handlePourMouseDown}
            onMouseUp={handlePourMouseUp}
            onMouseLeave={handlePourMouseUp}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedContainerId(id);
            }}
            className={`pointer-events-auto container-wrapper ${isFlask ? 'flask-wrapper' : 'beaker-wrapper'} ${isDragging ? 'opacity-90 scale-105' : ''} ${!isDragging && !isSnapping ? 'hover:-translate-y-2' : ''} ${isExploding ? 'animate-pulse drop-shadow-[0_0_30px_rgba(245,158,11,0.85)]' : ''} ${isSelected ? 'ring-2 ring-cyan-400/90 shadow-[0_0_30px_rgba(6,182,212,0.5)]' : ''}`}
            style={{
                position: 'absolute',
                left: `${currentX}px`,
                top: `${currentY}px`,
                zIndex: isDragging ? 50 : 30,
                transition: isDragging ? 'none' : 'top 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'left, top, transform',
                touchAction: 'none'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Interactive Active Vessel Toolbar */}
            {isSelected && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#050f1e]/90 border border-cyan-500/60 rounded-full px-2.5 py-1 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.4)] z-50 whitespace-nowrap cursor-default animate-fade-in"
                >
                    <span className="text-[9px] font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                        {isVi ? 'Đang Chọn' : 'Active'}
                    </span>
                    <span className="text-cyan-800 text-[10px]">|</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            clearContainer(id);
                        }}
                        className="text-[10px] text-slate-300 hover:text-amber-400 transition-colors px-1 font-mono flex items-center gap-0.5"
                        title={isVi ? 'Đổ bỏ hóa chất trong bình' : 'Dump contents'}
                    >
                        <span>⌫</span>
                        <span>{isVi ? 'Đổ sạch' : 'Dump'}</span>
                    </button>
                    <span className="text-cyan-800 text-[10px]">|</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removeContainer(id);
                        }}
                        className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors px-1 font-mono flex items-center gap-0.5"
                        title={isVi ? 'Xóa bỏ dụng cụ này' : 'Remove glassware'}
                    >
                        <span>🗑️</span>
                        <span>{isVi ? 'Xóa' : 'Delete'}</span>
                    </button>
                    {container.volume > 0 && (
                        <>
                            <span className="text-cyan-800 text-[10px]">|</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowBreakdown(!showBreakdown);
                                }}
                                className={`text-[10px] px-1 font-mono flex items-center gap-0.5 transition-colors ${showBreakdown ? 'text-cyan-300 font-bold' : 'text-slate-400 hover:text-cyan-300'}`}
                                title={isVi ? 'Xem chi tiết thành phần & ion' : 'Inspect contents & telemetry'}
                            >
                                <span>🔬</span>
                                <span>{isVi ? 'Phân tích' : 'Inspect'}</span>
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Contents Breakdown Popover */}
            {showBreakdown && container.volume > 0 && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -top-44 left-full ml-3 w-60 bg-[#040e1c]/95 border border-cyan-800/80 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl z-50 font-mono text-[10px] text-slate-200 pointer-events-auto"
                >
                    <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1 mb-1.5 font-bold text-cyan-300">
                        <span>{isVi ? 'Thành Phần & Điện Ly' : 'Solution & Electrolytes'}</span>
                        <span className="text-[9px] text-slate-400">{container.volume} mL</span>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {Object.entries(container.contents || {}).map(([chemId, vol]) => {
                            if (!vol || vol <= 0.01) return null;
                            const reg = CHEMICAL_REGISTRY[chemId];
                            const name = reg ? (isVi ? reg.name.VN : reg.name.EN) : chemId;
                            const pct = Math.round((vol / container.volume) * 100);
                            return (
                                <div key={chemId} className="flex justify-between items-center text-[9px]">
                                    <span className="truncate max-w-[120px] text-slate-300">{name}</span>
                                    <span className="text-cyan-400 font-bold">{vol.toFixed(1)}mL ({pct}%)</span>
                                </div>
                            );
                        })}
                    </div>
                    {/* Advanced GDPT 2018 Electrolyte Telemetry */}
                    <div className="mt-2 pt-1.5 border-t border-cyan-900/60 text-[9px] text-slate-400 space-y-0.5">
                        <div className="flex justify-between">
                            <span>{isVi ? 'Chất điện ly:' : 'Classification:'}</span>
                            <span className="text-cyan-300 font-semibold">{solutionAnalysis.electrolyteClass}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>{isVi ? 'Độ dẫn điện:' : 'Conductivity:'}</span>
                            <span className="text-emerald-400 font-bold">{solutionAnalysis.conductivityMicroSiemens} μS/cm</span>
                        </div>
                        <div className="flex justify-between">
                            <span>{isVi ? 'Lực ion (I):' : 'Ionic Strength (I):'}</span>
                            <span className="text-indigo-300">{solutionAnalysis.ionicStrength} mol/L</span>
                        </div>
                        {solutionAnalysis.ions.length > 0 && (
                            <div className="flex justify-between truncate">
                                <span>{isVi ? 'Ion tự do:' : 'Free Ions:'}</span>
                                <span className="text-amber-300 font-bold truncate max-w-[120px]">
                                    {solutionAnalysis.ions.join(', ')}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span>{isVi ? 'Độ hấp thụ (A):' : 'Absorbance (A):'}</span>
                            <span className="text-cyan-300">{solutionOptics.absorbance} (T={Math.round(solutionOptics.transmittance * 100)}%)</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Thermal / Hotplate Heating Stage */}
            <div 
                className="absolute -bottom-8 left-1/2 w-36 pointer-events-none select-none z-10 flex flex-col items-center"
                style={{
                    transform: `translateX(-50%) scale(${isDragging ? 0.95 : 1})`,
                    opacity: isDragging ? 0.4 : 1,
                    transition: 'all 0.25s ease-out'
                }}
            >
                {/* Ceramic Top Plate with Incandescent Heat Coil / Cryo Frost Glow */}
                <div 
                    className="w-full h-7 rounded-2xl border border-slate-600 bg-gradient-to-b from-[#252c38] via-[#161a24] to-[#0c0f16] shadow-2xl relative flex items-center justify-center transition-all duration-300 overflow-hidden"
                    style={{
                        boxShadow: isHot 
                            ? `0 0 25px rgba(239, 68, 68, ${heatFactor * 0.9}), 0 4px 12px rgba(0,0,0,0.8)` 
                            : isCold 
                                ? '0 0 20px rgba(56, 189, 248, 0.7), 0 4px 12px rgba(0,0,0,0.8)' 
                                : '0 4px 15px rgba(0,0,0,0.6)'
                    }}
                >
                    {/* Glowing Nichrome Heating Spiral Coil under Quartz Surface */}
                    {isHot && (
                        <div 
                            className="absolute inset-x-2 h-2 rounded-full blur-[2px] transition-all duration-300 pointer-events-none"
                            style={{
                                background: `radial-gradient(ellipse at center, rgba(254, 240, 138, 1) 0%, rgba(249, 115, 22, 0.9) 50%, rgba(220, 38, 38, 0.8) 100%)`,
                                opacity: Math.max(0.3, heatFactor),
                                filter: `drop-shadow(0 0 6px rgba(239, 68, 68, ${heatFactor}))`
                            }}
                        />
                    )}

                    {/* Cryogenic Frost Ring */}
                    {isCold && (
                        <div className="absolute inset-0 bg-cyan-400/20 blur-sm rounded-xl pointer-events-none" />
                    )}

                    {/* Integrated Micro-OLED Temperature Display */}
                    <div className="z-10 flex items-center gap-1 font-mono text-[9px] font-black tracking-wider bg-black/70 px-2 py-0.5 rounded-md border border-slate-700">
                        <span style={{ 
                            color: isHot ? '#f87171' : isCold ? '#38bdf8' : '#34d399' 
                        }}>
                            {currentTemp}°C
                        </span>
                        <span className="text-[7px] text-slate-400">
                            {currentPressure.toFixed(1)}atm
                        </span>
                    </div>

                    {/* Magnetic Stirrer RPM */}
                    <div className="flex items-center gap-1 text-slate-400">
                        <span className="text-[9px] animate-spin" style={{ animationDuration: '3s' }}>⎈</span>
                        <span className="font-bold">1200 RPM</span>
                    </div>

                    {/* Brand Badge */}
                    <div className="hidden sm:block text-[8px] font-black tracking-widest text-slate-500 uppercase">
                        CHEMIC-STIR V2
                    </div>
                </div>
            </div>

            {/* Shadow beneath vessel */}
            <div 
                className="absolute -bottom-3 w-32 h-4 bg-black/60 rounded-full blur-[5px] pointer-events-none transition-all duration-200"
                style={{
                    left: '50%',
                    transform: `translateX(-50%) scale(${isDragging ? 0.85 : 1})`,
                    opacity: isDragging ? 0.35 : 0.75
                }}
            />
            {container.volume > 0 && (
                <div 
                    className="absolute -bottom-3 w-28 h-3.5 rounded-full blur-[6px] pointer-events-none transition-all duration-300 mix-blend-screen"
                    style={{
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: rgbaColor,
                        opacity: isDragging ? 0.2 : 0.65
                    }}
                />
            )}

            {/* Heat Shimmer Mirage Effect when Temperature >= 50°C */}
            {currentTemp >= 50 && container.volume > 0 && (
                <div 
                    className="absolute -inset-4 pointer-events-none z-40 rounded-3xl overflow-hidden opacity-40 mix-blend-screen"
                    style={{
                        filter: `blur(${Math.min(3, (currentTemp - 40) / 40)}px)`,
                        animation: 'heatMirage 1.2s infinite alternate ease-in-out'
                    }}
                />
            )}

            {/* Thermodynamic Steam / Vapor Plume Eruption when Boiling */}
            {thermoState && (thermoState.isBoiling || thermoState.isSimmering) && container.volume > 0 && (
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-28 h-24 pointer-events-none overflow-visible flex items-end justify-center z-40">
                    <div 
                        className="w-14 h-16 rounded-full blur-lg mix-blend-screen"
                        style={{ 
                            background: `radial-gradient(ellipse at bottom, ${thermoState.steamColor} 0%, transparent 70%)`,
                            animation: 'steamRise 1.8s infinite ease-out'
                        }} 
                    />
                    <div 
                        className="w-20 h-20 rounded-full blur-xl mix-blend-screen absolute -top-4"
                        style={{ 
                            background: `radial-gradient(ellipse at center, ${thermoState.steamColor} 0%, transparent 75%)`,
                            animation: 'steamRise 2.2s infinite ease-out 0.6s'
                        }} 
                    />
                </div>
            )}

            {/* Pending Thermal Activation Alert Badge */}
            {pendingThermalRule && container.volume > 0 && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-[9px] font-mono font-black text-amber-300 bg-amber-950/90 border border-amber-500/70 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_12px_rgba(245,158,11,0.6)] whitespace-nowrap z-50 flex items-center gap-1 animate-pulse">
                    <span>🔥</span>
                    <span>{isVi ? `Cần Tăng Nhiệt Độ (≥${pendingThermalRule.minTemperature}°C)` : `Heating Required (≥${pendingThermalRule.minTemperature}°C)`}</span>
                </div>
            )}

            {/* Boiling Status Indicator */}
            {thermoState && thermoState.isBoiling && container.volume > 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono font-black text-rose-300 bg-rose-950/90 border border-rose-500/70 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_12px_rgba(244,63,94,0.5)] whitespace-nowrap z-50 flex items-center gap-1 animate-bounce">
                    <span>♨️</span>
                    <span>{isVi ? 'ĐANG SÔI' : 'BOILING'} ({thermoState.effectiveBoilingPoint}°C)</span>
                </div>
            )}

            <div className="container-info font-mono text-center">
                <div className="font-bold text-cyan-300">
                    {isFlask ? (isVi ? 'Bình Tam Giác' : 'Flask') : (isVi ? 'Cốc Thủy Tinh' : 'Beaker')} {label}
                </div>
                <div className="text-[11px] text-slate-300 flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="font-bold text-cyan-400">{container.volume} mL</span>
                    <span className="text-cyan-800">|</span>
                    <span className="text-emerald-400 font-bold">pH {container.ph.toFixed(1)}</span>
                </div>
            </div>

            {/* Glass Container Outlines & Graduations */}
            {!isFlask ? (
                <>
                    <div className="beaker-glass">
                        <div className="beaker-lip" />
                    </div>

                    {/* Specular Cylindrical Glass Vertical Highlights */}
                    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-b-[20px]">
                        <div className="absolute top-0 left-3 w-4 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-3deg]" />
                        <div className="absolute top-0 right-4 w-3 h-full bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
                    </div>

                    <div className="grad-container">
                        <div className="grad-mark" style={{ bottom: '88%' }}>
                            <span className="grad-num">100</span>
                            <div className="grad-tick" style={{ width: '22px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '70%' }}>
                            <span className="grad-num">80</span>
                            <div className="grad-tick" style={{ width: '16px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '52%' }}>
                            <span className="grad-num">60</span>
                            <div className="grad-tick" style={{ width: '16px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '34%' }}>
                            <span className="grad-num">40</span>
                            <div className="grad-tick" style={{ width: '16px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '16%' }}>
                            <span className="grad-num">20</span>
                            <div className="grad-tick" style={{ width: '16px' }}></div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <svg className="flask-glass" viewBox="0 0 160 220" style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))' }}>
                        <defs>
                        <linearGradient id="flask-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                            <stop offset="15%" stopColor="rgba(255,255,255,0.02)" />
                            <stop offset="85%" stopColor="rgba(255,255,255,0.02)" />
                            <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
                        </linearGradient>
                        <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
                            <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        </pattern>
                        </defs>
                        <path d="M 60,0 L 100,0 L 100,60 L 155,190 C 160,205 145,215 130,215 L 30,215 C 15,215 0,205 5,190 L 60,60 Z" fill="url(#flask-grad)" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" />
                        <path d="M 60,0 L 100,0 L 100,60 L 155,190 C 160,205 145,215 130,215 L 30,215 C 15,215 0,205 5,190 L 60,60 Z" fill="url(#scanlines)" />
                        <ellipse cx="80" cy="0" rx="20" ry="4" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
                    </svg>

                    <div className="grad-container" style={{ left: '44px', bottom: '15px' }}>
                        <div className="grad-mark" style={{ bottom: '50%' }}>
                            <span className="grad-num">80</span>
                            <div className="grad-tick" style={{ width: '22px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '38%' }}>
                            <span className="grad-num">60</span>
                            <div className="grad-tick" style={{ width: '28px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '28%' }}>
                            <span className="grad-num">40</span>
                            <div className="grad-tick" style={{ width: '34px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '18%' }}>
                            <span className="grad-num">20</span>
                            <div className="grad-tick" style={{ width: '40px' }}></div>
                        </div>
                    </div>
                </>
            )}

            {/* Liquid Rendering & Meniscus Wave Layers */}
            <div className={`liquid-clip-wrapper ${isFlask ? 'flask-clip' : 'beaker-clip'}`}>
                <div
                    ref={liquidBodyRef}
                    className="container-liquid"
                    style={{ 
                        height: `${heightPct}%`, 
                        background: hasImmiscibleLayers 
                            ? `linear-gradient(180deg, ${organicOpt?.baseColor || 'rgba(250, 204, 21, 0.65)'} 0%, ${organicOpt?.baseColor || 'rgba(250, 204, 21, 0.65)'} ${organicLayerPct}%, rgba(255, 255, 255, 0.4) ${organicLayerPct}%, rgba(255, 255, 255, 0.4) ${organicLayerPct + 1}%, ${finalLiquidBg} ${organicLayerPct + 1}%, ${finalLiquidBg} 100%)`
                            : finalLiquidBg,
                        transition: 'height 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)'
                    }}
                >
                    {heightPct > 0 && (
                        <>
                            {/* Layer 1: Dynamic Sloshing Background Wave */}
                            <svg className="absolute -top-4 left-0 w-full h-9 pointer-events-none z-10 overflow-visible" viewBox="0 0 200 36" preserveAspectRatio="none">
                                <path ref={backWaveRef} d="M 0,18 L 200,18 L 200,36 L 0,36 Z" fill={backWaveColor} opacity="0.75"></path>
                            </svg>
                            {/* Layer 2: Dynamic Sloshing Foreground Illuminated Crest Wave */}
                            <svg className="absolute -top-4 left-0 w-full h-9 pointer-events-none z-20 overflow-visible" viewBox="0 0 200 36" preserveAspectRatio="none">
                                <path ref={frontWaveRef} d="M 0,18 L 200,18 L 200,36 L 0,36 Z" fill={frontWaveColor} opacity="0.92"></path>
                            </svg>
                            {/* Layer 3: Physical Capillary Concave Meniscus Specular Curvature */}
                            <svg className="absolute -top-4 left-0 w-full h-9 pointer-events-none z-30 overflow-visible" viewBox="0 0 200 36" preserveAspectRatio="none">
                                <path 
                                    ref={meniscusPathRef}
                                    d="M 0,14 Q 100,18 200,14" 
                                    fill="none" 
                                    stroke="rgba(255, 255, 255, 0.85)" 
                                    strokeWidth="1.8"
                                    opacity="0.95"
                                />
                            </svg>
                        </>
                    )}

                    {/* Precipitate Sediment Bed at Base of Vessel */}
                    {activePrecipitate && container.volume > 0 && (
                        <div
                            className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 overflow-hidden flex items-end justify-center pb-1"
                            style={{
                                height: `${sedimentHeightPct}%`,
                                background: activePrecipitate.bgGrad,
                                borderTop: `1.5px solid ${activePrecipitate.color}`,
                                boxShadow: `0 -4px 12px ${activePrecipitate.color}50`
                            }}
                        >
                            <span className="text-[8px] font-mono font-bold text-white/90 drop-shadow-md tracking-tighter truncate px-1">
                                {activePrecipitate.label}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* High-DPI Canvas for Boiling Bubbles & Precipitate Micro-Crystals */}
            <canvas 
                ref={canvasRef} 
                className="particle-canvas z-30 pointer-events-none" 
            />
        </div>
    );
};

export default LabContainer;