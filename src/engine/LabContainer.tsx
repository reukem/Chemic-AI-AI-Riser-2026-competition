import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSimulationStore, getTableBenchY } from './store';
import { CHEMICAL_REGISTRY, REACTION_RULES } from '../data/ChemicalRegistry';
import { evaluateThermodynamicState } from './ThermodynamicEngine';
import { getOpticalProfile } from './opticalProperties';
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
    const isSelected = selectedContainerId === id;

    // Real-time synchronization with Environment Matrix
    const currentTemp = env.temp ?? (env as any).temperature ?? 25;
    const currentPressure = env.pressure ?? 1.0;

    // Detect pending thermal reaction requirement (when reagents are mixed below minTemperature)
    const pendingThermalRule = useMemo(() => {
        if (!container || !container.contents || container.volume <= 0) return null;

        // Special check for COPPER_POLYOL_COMPLEX awaiting 60°C thermal Fehling reduction
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

        // Auto-trigger COPPER_POLYOL_COMPLEX thermal decomposition at >= 60°C
        if ((container.contents['COPPER_POLYOL_COMPLEX'] || 0) > 0.001 && currentTemp >= 60) {
            setEnvTemp(currentTemp);
            return;
        }

        const keys = Object.keys(container.contents).filter(k => (container.contents[k] || 0) > 0.001);
        if (keys.length < 2) return;

        // Check if any rule's minTemperature has been attained
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

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<any[]>([]);
    const animationRef = useRef<number>();
    const containerRef = useRef<HTMLDivElement>(null);
    const pourIntervalRef = useRef<any>(null);

    const [isSnapping, setIsSnapping] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [liveDragPos, setLiveDragPos] = useState<{ x: number; y: number } | null>(null);

    // Refs for direct DOM manipulation of liquid slosh elements (120 FPS, zero React re-render overhead)
    const liquidBodyRef = useRef<HTMLDivElement>(null);
    const frontWaveRef = useRef<SVGPathElement>(null);
    const backWaveRef = useRef<SVGPathElement>(null);
    const meniscusPathRef = useRef<SVGPathElement>(null);

    const pointerOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragXRef = useRef(container?.x || 500);
    // 20-Node Coupled 1D Shallow-Water Spring Array Ref
    const springWaveRef = useRef({
        N: 20,
        y: new Float32Array(20),
        vy: new Float32Array(20),
        lastX: container?.x || 500,
        lastVx: 0,
        lastTime: performance.now(),
        sloshVelocity: 0
    });

    // Compute live thermodynamic state for this container
    const thermoState = container ? evaluateThermodynamicState(container, env) : null;

    // Drag and Drop Logic for chemical reagents
    const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('containerid')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'none'; // We don't "drop" containers into containers, we pour on hover
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

    const updateContainerPosition = useSimulationStore(state => state.updateContainerPosition);

    // Custom Pointer Drag Initiation with exact cursor offset locking
    const handlePointerDown = (e: React.PointerEvent) => {
        const state = useSimulationStore.getState();
        if (state.isPaused || state.pendingReaction) return;

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

    // Pouring logic with Frozen state protection
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
            }, 100);
        }
    };

    const handlePourMouseUp = () => {
        if (pourIntervalRef.current) {
            clearInterval(pourIntervalRef.current);
            pourIntervalRef.current = null;
        }
    };

    // 20-Node Coupled 1D Shallow-Water Spring Array Solver (Runs at 120 FPS directly on GPU/DOM - Zero React re-render)
    useEffect(() => {
        let animId: number;

        const updateSlosh = (now: number) => {
            const phys = springWaveRef.current;
            const dt = Math.min(0.033, Math.max(0.008, (now - phys.lastTime) / 1000));
            phys.lastTime = now;

            const liveX = dragXRef.current;
            const dx = liveX - phys.lastX;
            const instVx = dx / dt;
            const ax = (instVx - phys.lastVx) / dt;
            phys.lastX = liveX;
            phys.lastVx = instVx;
            phys.sloshVelocity = instVx;

            const N = phys.N;
            // 1. Apply horizontal beaker acceleration (vx - prevVx) as an antisymmetric slosh force:
            const clampedAccel = Math.max(-18, Math.min(18, ax * 0.45));
            for (let i = 0; i < N; i++) {
                const normX = (i / (N - 1)) - 0.5; // -0.5 to +0.5
                const sloshForce = -clampedAccel * normX * 2.0;

                // 2. Apply Hooke's Law spring tension between neighboring nodes:
                const yLeft = i > 0 ? phys.y[i - 1] : phys.y[i];
                const yRight = i < N - 1 ? phys.y[i + 1] : phys.y[i];
                const spread = 0.28 * ((yLeft - phys.y[i]) + (yRight - phys.y[i]));

                // vy[i] = (vy[i] + (-0.085 * y[i]) + spread + force[i]) * 0.94;
                phys.vy[i] = (phys.vy[i] + (-0.085 * phys.y[i]) + spread + sloshForce) * 0.94;
            }

            // Integrate node vertical positions
            for (let i = 0; i < N; i++) {
                phys.y[i] += phys.vy[i] * (dt * 60);
                phys.y[i] = Math.max(-20, Math.min(20, phys.y[i]));
            }

            // 3. Build smooth SVG cubic-bezier path from the 20 nodes + capillary meniscus climb (+4px at i=0 and i=N-1)
            const wavePoints: Array<{ x: number; y: number }> = [];
            for (let i = 0; i < N; i++) {
                const x = (i / (N - 1)) * 200;
                // Capillary meniscus climb (+4px upwards, so -4 in SVG coordinate Y)
                const capillary = (i === 0 || i === N - 1) ? -4.0 : (i === 1 || i === N - 2) ? -1.5 : 0;
                const y = Math.max(2, Math.min(34, 18 + phys.y[i] + capillary));
                wavePoints.push({ x, y });
            }

            let frontWavePath = `M ${wavePoints[0].x.toFixed(1)},${wavePoints[0].y.toFixed(1)}`;
            for (let i = 0; i < N - 1; i++) {
                const p0 = wavePoints[i];
                const p1 = wavePoints[i + 1];
                const mx = (p0.x + p1.x) / 2;
                const my = (p0.y + p1.y) / 2;
                frontWavePath += ` Q ${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
            }
            frontWavePath += ` T ${wavePoints[N - 1].x.toFixed(1)},${wavePoints[N - 1].y.toFixed(1)}`;

            const frontPolygon = `${frontWavePath} L 200,36 L 0,36 Z`;
            const meniscusStroke = frontWavePath;

            // Secondary wave with depth perspective
            let backWavePath = `M 0,${Math.max(2, Math.min(34, 18 - phys.y[0] * 0.65 - 2)).toFixed(1)}`;
            for (let i = 1; i < N; i++) {
                const px = (i / (N - 1)) * 200;
                const py = Math.max(2, Math.min(34, 18 - phys.y[i] * 0.65));
                backWavePath += ` L ${px.toFixed(1)},${py.toFixed(1)}`;
            }
            const backPolygon = `${backWavePath} L 200,36 L 0,36 Z`;

            if (liquidBodyRef.current) {
                // Keep liquid body naturally aligned; waves form the moving surface
                liquidBodyRef.current.style.transform = 'none';
            }
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
    }, []);

    // Strict Tabletop Dragging & Clamping Logic
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!isDragging) return;
            const currentTableY = getTableBenchY();
            const rawX = e.clientX - pointerOffsetRef.current.x;
            const rawY = e.clientY - pointerOffsetRef.current.y;
            
            // Constrain horizontally within screen bounds
            const clampedX = Math.max(50, Math.min(window.innerWidth - 250, rawX));
            // Constrain vertically: allow free lift upwards during pick-up/pour, but do not sink through table
            const clampedY = Math.max(80, Math.min(currentTableY, rawY));
            
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
            
            setTimeout(() => {
                setIsSnapping(false);
                setLiveDragPos(null);
                updateContainerPosition(id, finalX, finalY);
                useSimulationStore.getState().setDraggingContainerId(null);
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

    // Active Reaction Particle Effects
    useEffect(() => {
        if (activeEffectContainerId === id && activeEffect) {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const r = container?.color.r || 255;
            const g = container?.color.g || 255;
            const b = container?.color.b || 255;

            let numParticles = 15;
            if (activeEffect === 'explosion') {
                numParticles = 45;
            } else if (activeEffect === 'fizz') {
                numParticles = 40;
            } else if (activeEffect === 'bubbles') {
                numParticles = 25;
            }

            for (let i = 0; i < numParticles; i++) {
                const isExp = activeEffect === 'explosion';
                let color = isExp 
                    ? `rgba(255, ${200 + Math.random() * 55}, ${100 + Math.random() * 155}, ${0.75 + Math.random() * 0.25})`
                    : `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, ${0.5 + Math.random() * 0.5})`;
                let vx = (Math.random() - 0.5) * (isExp ? 3.5 : 2);
                let vy = -(isExp ? (3.5 + Math.random() * 4.5) : (1 + Math.random() * 3));
                let radius = isExp ? (1.8 + Math.random() * 3.5) : (1 + Math.random() * 3);
                let decay = isExp ? (0.018 + Math.random() * 0.02) : (0.01 + Math.random() * 0.02);

                particlesRef.current.push({
                    x: Math.random() * canvas.width, 
                    y: canvas.height - ((container?.volume || 0) / (container?.maxVol || 100)) * canvas.height, 
                    vy,
                    vx,
                    radius,
                    color,
                    life: 1.0,
                    decay,
                    isExplosion: isExp
                });
            }
        }
    }, [activeEffect, activeEffectContainerId, id, container?.color, container?.volume, container?.maxVol]);

    // Particle Animation & Thermodynamic Boiling Simulation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            if (canvas.parentElement) {
                const rect = canvas.parentElement.getBoundingClientRect();
                const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                if (canvas.width !== Math.floor((rect.width - 6) * dpr) || canvas.height !== Math.floor((rect.height - 6) * dpr)) {
                    canvas.width = Math.floor((rect.width - 6) * dpr);
                    canvas.height = Math.floor((rect.height - 6) * dpr);
                    ctx.scale(dpr, dpr);
                }
            }
        };
        resize();
        window.addEventListener('resize', resize);

        let isDirty = true;
        const animate = () => {
            if (useSimulationStore.getState().activeTab !== 'lab') {
                animationRef.current = requestAnimationFrame(animate);
                return;
            }
            const isPaused = useSimulationStore.getState().isPaused;
            const isEffervescing = !isPaused && (activeEffectContainerId === id) && (activeEffect === 'fizz' || activeEffect === 'bubbles' || activeEffect === 'smoke');
            const needsBoiling = !isPaused && thermoState && (thermoState.isBoiling || thermoState.isSimmering) && container && container.volume > 0;
            const hasParticles = particlesRef.current.length > 0;

            // Idle Canvas Skipping: Zero CPU/GPU usage when container is resting
            if (!needsBoiling && !isEffervescing && !hasParticles) {
                if (isDirty) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    isDirty = false;
                }
                animationRef.current = requestAnimationFrame(animate);
                return;
            }

            isDirty = true;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const canvasLogicalW = canvas.width / (window.devicePixelRatio || 1);
            const canvasLogicalH = canvas.height / (window.devicePixelRatio || 1);
            const liquidHeightPx = (container.volume / container.maxVol) * canvasLogicalH;
            const liquidTopY = canvasLogicalH - liquidHeightPx;

            // Continuous Effervescent Reaction Frothing & Micro-bubble Eruption
            if (isEffervescing && container && container.volume > 0) {
                const spawnCount = activeEffect === 'fizz' ? 5 : 3;
                for (let k = 0; k < spawnCount; k++) {
                    const depthY = liquidTopY + Math.random() * (canvasLogicalH - liquidTopY - 4);
                    const spawnX = 14 + Math.random() * (canvasLogicalW - 28);
                    particlesRef.current.push({
                        x: spawnX,
                        y: depthY,
                        vx: (Math.random() - 0.5) * 1.5,
                        vy: -(2.5 + Math.random() * 4.0),
                        radius: 0.8 + Math.random() * 2.2,
                        color: 'rgba(255, 255, 255, 0.85)',
                        life: 1.0,
                        decay: 0.02,
                        isBoilingBubble: true,
                        surfaceY: liquidTopY
                    });
                }

                // Fine Vapor Mist / Gas Plumes rising out of beaker mouth
                if (Math.random() < 0.45) {
                    particlesRef.current.push({
                        x: canvasLogicalW * 0.5 + (Math.random() - 0.5) * 24,
                        y: liquidTopY - 4,
                        vx: (Math.random() - 0.5) * 1.2,
                        vy: -(1.5 + Math.random() * 2.5),
                        radius: 3 + Math.random() * 5.5,
                        color: 'rgba(240, 248, 255, 0.4)',
                        life: 1.0,
                        decay: 0.025,
                        isSteam: true
                    });
                }
            }

            // Thermodynamic Nucleation: Generate internal boiling bubbles
            if (needsBoiling) {
                const spawnProbability = thermoState.isBoiling ? 0.65 : 0.2;
                if (Math.random() < spawnProbability) {
                    const spawnX = 14 + Math.random() * (canvasLogicalW - 28);
                    particlesRef.current.push({
                        x: spawnX,
                        y: canvasLogicalH - 6,
                        vx: (Math.random() - 0.5) * (thermoState.isBoiling ? 1.5 : 0.6),
                        vy: -(thermoState.isBoiling ? (3.0 + Math.random() * 3.5) : (1.4 + Math.random() * 1.5)),
                        radius: thermoState.isBoiling ? (1.5 + Math.random() * 3.2) : (1 + Math.random() * 1.8),
                        color: 'rgba(255, 255, 255, 0.85)',
                        life: 1.0,
                        decay: 0.015,
                        isBoilingBubble: true,
                        surfaceY: liquidTopY
                    });
                }
            }

            // Golden Rain Crystalline Precipitation Flutter (PbI2)
            if (container?.contents && (container.contents['PbI2_PRECIPITATE'] || 0) > 0.001) {
                if (Math.random() < 0.6) {
                    particlesRef.current.push({
                        x: 14 + Math.random() * (canvasLogicalW - 28),
                        y: liquidTopY + 2 + Math.random() * 8,
                        vx: (Math.random() - 0.5) * 0.6,
                        vy: 0.5 + Math.random() * 0.9,
                        radius: 1.2 + Math.random() * 2.2,
                        color: Math.random() < 0.35 ? '#fef08a' : '#facc15',
                        life: 1.0,
                        decay: 0.007,
                        isGoldenRain: true,
                        phase: Math.random() * Math.PI * 2,
                        shimmer: Math.random() * 10
                    });
                }
            }

            // Alkali Metal Meniscus Skittering (Na, K, Li)
            const alkaliKey = container?.contents ? Object.keys(container.contents).find(k => (k === 'SODIUM' || k === 'POTASSIUM' || k === 'LITHIUM') && container.contents[k] > 0.001) : null;
            if (alkaliKey && container && container.volume > 0) {
                const alkaliColor = alkaliKey === 'SODIUM' ? '#f59e0b' : (alkaliKey === 'POTASSIUM' ? '#c084fc' : '#f43f5e');
                if (Math.random() < 0.7) {
                    particlesRef.current.push({
                        x: canvasLogicalW * 0.5 + Math.sin(Date.now() * 0.006) * (canvasLogicalW * 0.32),
                        y: liquidTopY - 1,
                        vx: (Math.random() - 0.5) * 2.2,
                        vy: -(1.2 + Math.random() * 2.4),
                        radius: 0.9 + Math.random() * 1.8,
                        color: alkaliColor,
                        life: 0.7,
                        decay: 0.035,
                        isExplosion: true
                    });
                }
            }

            const particles = particlesRef.current;
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                
                if (!isPaused) {
                    // Physical particle swirling during liquid sloshing
                    const currentSloshVx = springWaveRef.current.sloshVelocity;
                    const sloshSwirl = currentSloshVx * 0.035 * (1 - Math.max(0, Math.min(1, (p.y - liquidTopY) / Math.max(1, canvasLogicalH - liquidTopY))));
                    p.x += p.vx + sloshSwirl;
                    p.y += p.vy;
                    p.life -= p.decay;

                    if (p.isGoldenRain) {
                        p.x += Math.sin(p.phase + p.y * 0.15) * 0.6;
                        p.shimmer += 0.25;
                    } else if (p.isBoilingBubble) {
                        p.x += Math.sin(p.y * 0.2) * 0.5;
                        // Pop at surface and eject aerosol froth droplets!
                        if (p.y <= p.surfaceY) {
                            p.life = 0;
                            if (Math.random() < 0.4) {
                                particles.push({
                                    x: p.x,
                                    y: p.surfaceY - 1,
                                    vx: (Math.random() - 0.5) * 1.8,
                                    vy: -(1.2 + Math.random() * 2.2),
                                    radius: 0.6 + Math.random() * 1.0,
                                    color: 'rgba(255, 255, 255, 0.75)',
                                    life: 0.6,
                                    decay: 0.05,
                                    isDroplet: true
                                });
                            }
                        }
                    } else if (p.isSteam) {
                        p.x += Math.sin(p.y * 0.1) * 0.8;
                        p.radius += 0.12; // Expanding vapor
                    } else if (!p.isExplosion) {
                        p.x += Math.sin(p.y * 0.1) * 0.5;
                    }
                }

                if (p.life > 0 && p.radius > 0.5) {
                    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
                    if (p.isGoldenRain) {
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.phase);
                        ctx.beginPath();
                        const hr = p.radius;
                        for (let a = 0; a < 6; a++) {
                            const angle = (a * Math.PI) / 3;
                            const hx = Math.cos(angle) * hr;
                            const hy = Math.sin(angle) * hr * 0.6;
                            if (a === 0) ctx.moveTo(hx, hy);
                            else ctx.lineTo(hx, hy);
                        }
                        ctx.closePath();
                        const isShimmer = Math.sin(p.shimmer) > 0.4;
                        ctx.fillStyle = isShimmer ? '#ffffff' : p.color;
                        ctx.shadowBlur = isShimmer ? 8 : 2;
                        ctx.shadowColor = '#facc15';
                        ctx.fill();
                        ctx.lineWidth = 0.5;
                        ctx.strokeStyle = '#fde047';
                        ctx.stroke();
                        ctx.restore();
                    } else if (p.isBoilingBubble) {
                        // Gas bubbles expand slightly as hydrostatic pressure drops near the surface
                        if (!isPaused) p.radius = Math.min(p.radius * 1.004, 5.5);
                        const br = p.radius;
                        // Transparent core with thin refracting rim (bubbles are not opaque white dots)
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, br, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                        ctx.fill();
                        ctx.lineWidth = Math.max(0.6, br * 0.28);
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                        ctx.stroke();
                        // Specular highlight (upper-left light source)
                        if (br > 1.2) {
                            ctx.beginPath();
                            ctx.arc(p.x - br * 0.35, p.y - br * 0.35, br * 0.32, 0, Math.PI * 2);
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                            ctx.fill();
                        }
                    } else if (p.isSteam) {
                        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
                        grad.addColorStop(0, 'rgba(240, 248, 255, 0.45)');
                        grad.addColorStop(1, 'rgba(240, 248, 255, 0)');
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                        ctx.fillStyle = grad;
                        ctx.fill();
                    } else if (p.isExplosion) {
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = p.color;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                        ctx.fillStyle = p.color;
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    } else {
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                        ctx.fillStyle = p.color;
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1.0;
                } else if (!isPaused) {
                    particles.splice(i, 1);
                }
            }
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [thermoState, container?.volume, container?.maxVol]);

    if (!container) return null;

    const heightPct = (container.volume / container.maxVol) * 90;
    const r = container.color.r;
    const g = container.color.g;
    const b = container.color.b;
    const rgbaColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
    const rgbColor = `rgb(${r}, ${g}, ${b})`;

    // Expanded Precipitate morphology & sediment bed physics
    const PRECIPITATE_DEFINITIONS: Record<string, { color: string; label: string; bgGrad: string }> = {
        'CuOH2_PRECIPITATE': { 
            color: 'rgb(56, 189, 248)', 
            label: 'Cu(OH)₂ ↓ (Gelatinous)', 
            bgGrad: 'linear-gradient(180deg, rgba(56, 189, 248, 0.9) 0%, rgba(2, 132, 199, 0.98) 100%)' 
        },
        'Cu2O_PRECIPITATE': { 
            color: 'rgb(185, 28, 28)', 
            label: 'Cu₂O ↓ (Brick Red)', 
            bgGrad: 'linear-gradient(180deg, rgba(220, 38, 38, 0.95) 0%, rgba(153, 27, 27, 0.98) 100%)' 
        },
        'PbI2_PRECIPITATE': { 
            color: 'rgb(234, 179, 8)', 
            label: 'PbI₂ ↓ (Golden Rain)', 
            bgGrad: 'linear-gradient(180deg, rgba(254, 240, 138, 0.95) 0%, rgba(234, 179, 8, 0.98) 50%, rgba(161, 98, 7, 1) 100%)' 
        },
        'SILVER': {
            color: 'rgb(241, 245, 249)',
            label: 'Ag (Silver Mirror) 🪞',
            bgGrad: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(203, 213, 225, 0.95) 25%, rgba(148, 163, 184, 0.98) 50%, rgba(255, 255, 255, 0.98) 75%, rgba(100, 116, 139, 0.98) 100%)'
        },
        'CARBON': {
            color: 'rgb(24, 24, 27)',
            label: 'Carbon (Sugar Monster) █',
            bgGrad: 'linear-gradient(180deg, #27272a 0%, #18181b 50%, #09090b 100%)'
        },
        'MANGANESE_DIOXIDE': {
            color: 'rgb(68, 43, 33)',
            label: 'MnO₂ ↓ (Brown Sludge)',
            bgGrad: 'linear-gradient(180deg, rgba(87, 59, 44, 0.95) 0%, rgba(56, 38, 28, 0.98) 100%)'
        },
        'MgO_SOLID': {
            color: 'rgb(248, 250, 252)',
            label: 'MgO (White Ash) ↓',
            bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(226, 232, 240, 0.98) 100%)'
        },
        'BaSO4_PRECIPITATE': { 
            color: 'rgba(248, 250, 252, 0.95)', 
            label: 'BaSO₄ ↓ (Dense White)', 
            bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(226, 232, 240, 0.98) 100%)' 
        },
        'CaCO3_PRECIPITATE': { 
            color: 'rgba(241, 245, 249, 0.95)', 
            label: 'CaCO₃ ↓ (Milky)', 
            bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(203, 213, 225, 0.98) 100%)' 
        },
        'BaCO3_PRECIPITATE': { 
            color: 'rgba(241, 245, 249, 0.95)', 
            label: 'BaCO₃ ↓', 
            bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(203, 213, 225, 0.98) 100%)' 
        },
        'AgCl_PRECIPITATE': { 
            color: 'rgba(255, 255, 255, 0.98)', 
            label: 'AgCl ↓ (Curdy White)', 
            bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(203, 213, 225, 0.98) 100%)' 
        },
        'AgI_PRECIPITATE': { 
            color: 'rgb(234, 179, 8)', 
            label: 'AgI ↓ (Bright Yellow)', 
            bgGrad: 'linear-gradient(180deg, rgba(250, 204, 21, 0.92) 0%, rgba(202, 138, 4, 0.98) 100%)' 
        },
        'AlOH3_PRECIPITATE': { 
            color: 'rgba(241, 245, 249, 0.95)', 
            label: 'Al(OH)₃ ↓ (Gelatinous)', 
            bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(226, 232, 240, 0.98) 100%)' 
        },
        'FeOH2_PRECIPITATE': { 
            color: 'rgb(34, 197, 94)', 
            label: 'Fe(OH)₂ ↓ (Dirty Green)', 
            bgGrad: 'linear-gradient(180deg, rgba(74, 222, 128, 0.9) 0%, rgba(22, 101, 52, 0.98) 100%)' 
        },
        'FeOH3_PRECIPITATE': { 
            color: 'rgb(180, 83, 9)', 
            label: 'Fe(OH)₃ ↓ (Reddish-Brown)', 
            bgGrad: 'linear-gradient(180deg, rgba(217, 119, 6, 0.9) 0%, rgba(146, 64, 14, 0.98) 100%)' 
        },
        'TRIBROMOPHENOL_PRECIPITATE': { 
            color: 'rgba(248, 250, 252, 0.95)', 
            label: '2,4,6-tribromophenol ↓', 
            bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(226, 232, 240, 0.98) 100%)' 
        }
    };

    let activePrecipitate: { color: string; label: string; bgGrad: string; volume: number } | null = null;
    if (container.contents) {
        for (const [chemId, vol] of Object.entries(container.contents)) {
            if (vol && vol > 0.05) {
                if (PRECIPITATE_DEFINITIONS[chemId]) {
                    activePrecipitate = { ...PRECIPITATE_DEFINITIONS[chemId], volume: vol };
                    break;
                } else if (chemId.endsWith('_PRECIPITATE')) {
                    const cleanName = chemId.replace('_PRECIPITATE', '') + ' ↓';
                    activePrecipitate = {
                        color: 'rgba(255, 255, 255, 0.9)',
                        label: cleanName,
                        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(203, 213, 225, 0.98) 100%)',
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
                    dominantOrganicKey = chemId;
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
    const organicColor = organicOpt?.baseColor || '#fde047';

    // Continuous pH Indicator Rainbow & Thermal Helix Dynamic Color Solver
    const hasUniversalIndicator = (container.contents?.['UNIVERSAL_INDICATOR'] || 0) > 0.001;
    const hasPhenolphthalein = (container.contents?.['PHENOLPHTHALEIN'] || 0) > 0.001;
    const hasStarchIodine = (container.contents?.['STARCH_IODINE_COMPLEX'] || 0) > 0.001;
    const isStarchDeheated = hasStarchIodine && currentTemp >= 75;

    let dynamicLiquidBg: string | null = null;
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
        dynamicLiquidBg = `linear-gradient(180deg, rgba(${Math.min(255, indRgb.r + 35)}, ${Math.min(255, indRgb.g + 35)}, ${Math.min(255, indRgb.b + 35)}, 0.85) 0%, rgba(${indRgb.r}, ${indRgb.g}, ${indRgb.b}, 0.92) 55%, rgba(${Math.max(0, indRgb.r - 35)}, ${Math.max(0, indRgb.g - 35)}, ${Math.max(0, indRgb.b - 35)}, 0.98) 100%)`;
    } else if (hasPhenolphthalein && !activePrecipitate) {
        if (container.ph >= 8.2) {
            effectiveR = 244;
            effectiveG = 63;
            effectiveB = 94;
            dynamicLiquidBg = `linear-gradient(180deg, rgba(251, 113, 133, 0.85) 0%, rgba(244, 63, 94, 0.92) 55%, rgba(190, 18, 60, 0.98) 100%)`;
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

    // Volumetric Beer-Lambert Depth Gradient
    // When clear liquids are present, render crystal clear borosilicate transmission (not chalky skim milk!)
    const isClearLiquid = !dynamicLiquidBg && (dominantOpt.transmission >= 0.88 || ((r > 215 && g > 215 && b > 215) && !activePrecipitate));
    const liquidBackground = dynamicLiquidBg || (isClearLiquid
        ? `linear-gradient(180deg, rgba(224, 242, 254, 0.12) 0%, rgba(186, 230, 253, 0.22) 55%, rgba(125, 211, 252, 0.35) 100%)`
        : `linear-gradient(180deg, rgba(${Math.min(255, effectiveR + 45)}, ${Math.min(255, effectiveG + 45)}, ${Math.min(255, effectiveB + 45)}, 0.82) 0%, rgba(${effectiveR}, ${effectiveG}, ${effectiveB}, 0.9) 55%, rgba(${Math.max(0, effectiveR - 45)}, ${Math.max(0, effectiveG - 45)}, ${Math.max(0, effectiveB - 45)}, 0.98) 100%)`);

    const backWaveColor = `rgb(${Math.max(0, effectiveR - 30)}, ${Math.max(0, effectiveG - 30)}, ${Math.max(0, effectiveB - 30)})`;
    const frontWaveColor = `rgb(${Math.min(255, effectiveR + 25)}, ${Math.min(255, effectiveG + 25)}, ${Math.min(255, effectiveB + 25)})`;

    const label = id === 0 ? 'Alpha' : id === 1 ? 'Beta' : id === 2 ? 'Gamma' : 'Delta';
    const isFlask = container.type === 'flask';

    const tableBenchY = getTableBenchY();
    const currentX = (isDragging || isSnapping) && liveDragPos ? liveDragPos.x : (container?.x ?? 500);
    const currentY = (isDragging || isSnapping) && liveDragPos ? liveDragPos.y : (container?.y ?? tableBenchY);

    const isExploding = activeEffect === 'explosion' && activeEffectContainerId === id;

    // Dissolved Ions and Stoichiometric Molarity for Live Telemetry
    const dissolvedIons: string[] = [];
    let totalMolesEstimate = 0;
    if (container.contents) {
        for (const [cId, vol] of Object.entries(container.contents)) {
            if (vol && vol > 0.05 && !cId.endsWith('_PRECIPITATE')) {
                const reg = CHEMICAL_REGISTRY[cId];
                if (reg?.molarMass) {
                    totalMolesEstimate += (vol * 1.0) / reg.molarMass;
                }
                if (cId === 'NaOH') { dissolvedIons.push('Na⁺', 'OH⁻'); }
                else if (cId === 'HCl') { dissolvedIons.push('H⁺', 'Cl⁻'); }
                else if (cId === 'CuSO4') { dissolvedIons.push('Cu²⁺', 'SO₄²⁻'); }
                else if (cId === 'NaCl') { dissolvedIons.push('Na⁺', 'Cl⁻'); }
                else if (cId === 'PbNO32') { dissolvedIons.push('Pb²⁺', 'NO₃⁻'); }
                else if (cId === 'KI') { dissolvedIons.push('K⁺', 'I⁻'); }
                else if (cId === 'AgNO3') { dissolvedIons.push('Ag⁺', 'NO₃⁻'); }
                else if (cId === 'FeCl3') { dissolvedIons.push('Fe³⁺', 'Cl⁻'); }
                else if (cId === 'H2SO4') { dissolvedIons.push('H⁺', 'SO₄²⁻'); }
                else if (cId === 'HNO3') { dissolvedIons.push('H⁺', 'NO₃⁻'); }
                else if (cId === 'KMnO4') { dissolvedIons.push('K⁺', 'MnO₄⁻'); }
                else if (cId === 'BaOH2') { dissolvedIons.push('Ba²⁺', 'OH⁻'); }
            }
        }
    }
    const uniqueIons = Array.from(new Set(dissolvedIons));
    const molarityEstimate = container.volume > 0 ? (totalMolesEstimate / (container.volume / 1000)).toFixed(2) : '0.00';

    const heatFactor = Math.min(1, Math.max(0, (currentTemp - 25) / 155));
    const isCold = currentTemp <= 5;
    const isHot = currentTemp >= 35;

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
                        title={isVi ? "Rửa sạch bình này" : "Rinse and empty this vessel"}
                        className="text-[10px] hover:scale-110 text-cyan-400 hover:text-amber-300 transition-transform px-1 flex items-center gap-0.5 cursor-pointer"
                    >
                        <span>🧹</span>
                        <span className="text-[8px] font-mono">{isVi ? 'Rửa' : 'Rinse'}</span>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowBreakdown(prev => !prev);
                        }}
                        title={isVi ? "Xem thành phần chi tiết" : "View contents breakdown"}
                        className="text-[10px] hover:scale-110 text-cyan-400 hover:text-cyan-200 transition-transform px-1 flex items-center gap-0.5 cursor-pointer"
                    >
                        <span>🧪</span>
                        <span className="text-[8px] font-mono">{isVi ? 'Soi' : 'Info'}</span>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removeContainer(id);
                        }}
                        title={isVi ? "Cất bình này" : "Remove this vessel"}
                        className="text-[10px] hover:scale-110 text-rose-400 hover:text-rose-300 transition-transform px-1 flex items-center gap-0.5 cursor-pointer"
                    >
                        <span>🗑️</span>
                    </button>
                </div>
            )}

            {/* Contents Breakdown Popover */}
            {showBreakdown && container.volume > 0 && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -top-36 left-full ml-3 w-52 bg-[#040e1c]/95 border border-cyan-800/80 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl z-50 font-mono text-[10px] text-slate-200 pointer-events-auto"
                >
                    <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1 mb-1.5 font-bold text-cyan-300">
                        <span>{isVi ? 'Thành Phần Dung Dịch' : 'Solution Contents'}</span>
                        <span className="text-[9px] text-slate-400">{container.volume} mL</span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-36 overflow-y-auto custom-scrollbar pr-0.5">
                        {Object.entries(container.contents)
                            .filter(([chemId, vol]) => !chemId.startsWith('reacted_') && vol > 0.05)
                            .map(([chemId, vol]) => {
                            const chem = CHEMICAL_REGISTRY[chemId];
                            const chemName = chem ? ((chem.name as any)[language] || chem.name.EN) : chemId;
                            const pct = ((vol / container.volume) * 100).toFixed(0);
                            return (
                                <div key={chemId} className="flex items-center justify-between text-[9px]">
                                    <span className="truncate pr-1 text-slate-300">{chemName}</span>
                                    <span className="shrink-0 text-cyan-400 font-bold">{vol}mL ({pct}%)</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-cyan-950 flex justify-between text-[9px] text-amber-300 font-bold">
                        <span>pH: {container.ph.toFixed(2)}</span>
                        <span>{thermoState?.isFrozen ? '❄ Đông' : thermoState?.isBoiling ? '♨ Sôi' : 'Lỏng'}</span>
                    </div>
                </div>
            )}
            {/* Reaction Thermal Overheat Aura */}
            {isExploding && (
                <div className="absolute -inset-2 bg-gradient-to-t from-amber-500/30 via-yellow-400/20 to-transparent rounded-3xl animate-ping pointer-events-none blur-md" />
            )}
            {/* Laboratory Thermal Workbench & Magnetic Hotplate Stage */}
            <div 
                className="absolute -bottom-14 w-[220px] pointer-events-none z-10 flex flex-col items-center"
                style={{
                    left: '50%',
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
                            ? `0 0 ${16 + heatFactor * 35}px rgba(249, 115, 22, ${0.45 + heatFactor * 0.5}), inset 0 1px 2px rgba(255,255,255,0.4)` 
                            : isCold 
                                ? `0 0 25px rgba(56, 189, 248, 0.75), inset 0 0 12px rgba(186, 230, 253, 0.4)`
                                : '0 8px 20px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.2)'
                    }}
                >
                    {/* Incandescent Thermal Coil Glow (when temp >= 35°C) */}
                    {isHot && (
                        <div 
                            className="w-44 h-3.5 rounded-full blur-[2px] transition-opacity duration-300 pointer-events-none"
                            style={{
                                background: `radial-gradient(ellipse at center, rgba(255, 245, 230, ${0.7 + heatFactor * 0.3}) 0%, rgba(249, 115, 22, ${0.7 + heatFactor * 0.3}) 45%, rgba(220, 38, 38, ${0.6 + heatFactor * 0.4}) 80%, transparent 100%)`,
                                opacity: 0.5 + heatFactor * 0.5
                            }}
                        />
                    )}

                    {/* Cryogenic Frost Mist Glow (when temp <= 5°C) */}
                    {isCold && (
                        <div className="w-44 h-3.5 rounded-full blur-sm bg-cyan-400/50 animate-pulse" />
                    )}
                </div>

                {/* Hotplate Chassis & Digital Thermal Dashboard */}
                <div className="w-[204px] h-8 bg-gradient-to-b from-[#111722] to-[#080b12] border-x border-b border-cyan-900/60 rounded-b-xl shadow-xl px-2.5 flex items-center justify-between text-[8px] font-mono">
                    {/* Digital Temperature & Pressure Display */}
                    <div className="flex items-center gap-1.5 bg-black/90 px-2 py-0.5 rounded border border-cyan-950 shadow-inner">
                        <span className={`w-1.5 h-1.5 rounded-full ${currentTemp > 60 ? 'bg-rose-500 animate-ping' : isCold ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                        <span className={`font-bold tracking-tight ${currentTemp > 60 ? 'text-rose-400' : isCold ? 'text-cyan-300' : 'text-emerald-300'}`}>
                            {currentTemp}°C | {currentPressure.toFixed(1)} atm
                        </span>
                    </div>

                    {/* Magnetic Stirrer RPM */}
                    <div className="flex items-center gap-1 text-slate-400">
                        <span className="text-[9px] animate-spin" style={{ animationDuration: '3s' }}>⎈</span>
                        <span className="font-bold">1200 RPM</span>
                    </div>

                    {/* Brand Badge */}
                    <div className="text-[7px] text-cyan-400/80 font-bold tracking-widest uppercase">
                        THERMO-STIR PRO
                    </div>
                </div>
            </div>

            {/* Tabletop Cast Shadow & Refractive Optical Caustic Underneath Vessel */}
            <div 
                className="absolute -bottom-2.5 w-32 h-4 bg-black/60 rounded-full blur-[3px] pointer-events-none transition-all duration-200"
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
                        background: `radial-gradient(ellipse at center, rgba(${r}, ${g}, ${b}, 0.6) 0%, rgba(${r}, ${g}, ${b}, 0.15) 60%, transparent 85%)`,
                        transform: `translateX(-50%) scale(${isDragging ? 0.7 : 1})`,
                        opacity: isDragging ? 0.2 : 0.85
                    }}
                />
            )}



            {/* Billowing Steam & Vapor Emitter Plume */}
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
                            background: `radial-gradient(circle, ${thermoState.steamColor} 0%, transparent 65%)`,
                            animation: 'steamRise 2.4s infinite ease-out 0.4s'
                        }} 
                    />
                </div>
            )}

            {/* Starch-Iodine Thermal Helix Uncoiling Badge */}
            {hasStarchIodine && env.temperature >= 75 && container.volume > 0 && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-sky-200 bg-indigo-950/90 border border-sky-400/70 px-2.5 py-0.5 rounded-full shadow-[0_0_12px_rgba(56,189,248,0.5)] whitespace-nowrap z-50 flex items-center gap-1 animate-pulse">
                    <span>🌡️</span>
                    <span>{isVi ? 'Mất màu xanh tím khi đun nóng (Helix Uncoiling)' : 'Thermal Helix Uncoiling (Colorless)'}</span>
                </div>
            )}

            {/* Thermal Activation Required Badge */}
            {pendingThermalRule && container.volume > 0 && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-amber-300 bg-amber-950/90 border border-amber-500/80 px-2.5 py-0.5 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.6)] whitespace-nowrap z-50 flex items-center gap-1.5 animate-pulse">
                    <span>🔥</span>
                    <span>
                        {isVi 
                            ? `Cần nhiệt kích hoạt: Đun nóng ≥ ${pendingThermalRule.minTemperature}°C` 
                            : `Thermal Activation Required: Heat to ≥ ${pendingThermalRule.minTemperature}°C`}
                    </span>
                </div>
            )}

            {/* Thermodynamic Boiling Badge */}
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
                <div>Vol: {container.volume} mL</div>
                <div>pH: {container.ph.toFixed(2)}</div>
            </div>

            {!isFlask ? (
                <>
                    <div className="container-glass beaker-glass"></div>

                    {/* 3D Elliptical Borosilicate Glass Rim */}
                    <div className="absolute -top-3.5 left-0 w-full h-7 pointer-events-none z-30">
                        <div 
                            className="w-full h-full rounded-[50%] border-2 border-white/60 bg-white/5 backdrop-blur-[0.5px]"
                            style={{
                                boxShadow: '0 0 10px rgba(255,255,255,0.4), inset 0 0 8px rgba(255,255,255,0.25)',
                                background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, rgba(56,189,248,0.04) 70%, transparent 100%)'
                            }}
                        >
                            <div className="absolute top-0.5 left-6 w-16 h-1 bg-white/80 rounded-full blur-[0.5px]" />
                        </div>
                    </div>

                    {/* 3D Elliptical Borosilicate Glass Base */}
                    <div className="absolute -bottom-2 left-0 w-full h-5 pointer-events-none z-10">
                        <div 
                            className="w-full h-full rounded-[50%] border-b border-white/40 bg-white/5"
                            style={{
                                boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,255,255,0.3)'
                            }}
                        />
                    </div>

                    {/* Specular Cylindrical Glass Vertical Highlights */}
                    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-b-[20px]">
                        <div className="absolute top-0 left-3 w-4 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-3deg]" />
                        <div className="absolute top-0 right-4 w-3 h-full bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
                    </div>

                    <div className="grad-container">
                        <div className="grad-mark" style={{ bottom: '88%' }}>
                            <span className="grad-num">200</span>
                            <div className="grad-tick"></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '74%' }}>
                            <span className="grad-num">150</span>
                            <div className="grad-tick"></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '58%' }}>
                            <span className="grad-num">100</span>
                            <div className="grad-tick"></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '46%' }}>
                            <span className="grad-num">80</span>
                            <div className="grad-tick"></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '34%' }}>
                            <span className="grad-num">60</span>
                            <div className="grad-tick"></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '22%' }}>
                            <span className="grad-num">40</span>
                            <div className="grad-tick"></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '12%' }}>
                            <span className="grad-num">20</span>
                            <div className="grad-tick"></div>
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
                            <rect width="4" height="2" fill="rgba(255,255,255,0.05)" />
                        </pattern>
                        </defs>
                        <path d="M 56 0 L 104 0 L 104 66 L 156 196 Q 160 206 150 214 Q 140 220 130 220 L 30 220 Q 20 220 10 214 Q 0 206 4 196 L 56 66 Z"
                            fill="url(#flask-grad)"
                            stroke="rgba(255,255,255,0.5)"
                            strokeWidth="2"
                            strokeLinejoin="round" />
                        <path d="M 56 0 L 104 0 L 104 66 L 156 196 Q 160 206 150 214 Q 140 220 130 220 L 30 220 Q 20 220 10 214 Q 0 206 4 196 L 56 66 Z"
                            fill="url(#scanlines)"
                            pointerEvents="none" />
                        <path d="M 62 2 L 62 66 L 16 181 Q 12 191 22 199"
                            fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="4"
                            filter="blur(1px)" />
                        <rect x="52" y="0" width="56" height="6" rx="3" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
                    </svg>
                    <div className="grad-container">
                        <div className="grad-mark" style={{ bottom: '86%' }}>
                            <span className="grad-num">100</span>
                            <div className="grad-tick" style={{ width: '18px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '68%' }}>
                            <span className="grad-num">80</span>
                            <div className="grad-tick" style={{ width: '22px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '50%' }}>
                            <span className="grad-num">60</span>
                            <div className="grad-tick" style={{ width: '28px' }}></div>
                        </div>
                        <div className="grad-mark" style={{ bottom: '34%' }}>
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

            {/* Frosted Ice Crystal Glass Overlay when Frozen */}
            {thermoState && thermoState.isFrozen && container.volume > 0 && (
                <div className="absolute inset-0 z-30 pointer-events-none rounded-2xl overflow-hidden border-2 border-cyan-300/50 bg-cyan-100/20 backdrop-blur-[2px] shadow-[inset_0_0_25px_rgba(186,230,253,0.5)] animate-[frostGlow_3s_ease-in-out_infinite]">
                    <div className="absolute top-2 right-2 text-cyan-200 text-xs animate-pulse">❄️</div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-cyan-200 text-[9px] font-mono tracking-widest font-bold bg-cyan-950/85 px-2 py-0.5 rounded-full border border-cyan-400/50 shadow-md whitespace-nowrap">
                        ❄ {isVi ? 'ĐÔNG ĐẶC' : 'FROZEN SOLID'}
                    </div>
                </div>
            )}

            <div className={`liquid-clip-wrapper ${isFlask ? 'flask-clip' : 'beaker-clip'}`}>
                <div
                    ref={liquidBodyRef}
                    className="container-liquid"
                    style={{ 
                        height: `${heightPct}%`, 
                        background: hasImmiscibleLayers 
                            ? `linear-gradient(180deg, ${organicColor} 0%, ${organicColor} ${organicLayerPct}%, rgba(255,255,255,0.85) ${organicLayerPct}%, rgba(255,255,255,0.85) ${organicLayerPct + 1.5}%, ${liquidBackground} ${organicLayerPct + 1.5}%, ${liquidBackground} 100%)` 
                            : liquidBackground,
                        transformOrigin: '50% 100%',
                        transition: isDragging ? 'none' : 'transform 0.08s ease-out'
                    }}
                >
                    {container.volume > 0 && !thermoState?.isFrozen && (
                        <>
                            {/* Layer 1: Dynamic Sloshing Ambient Back Wave (Coupled 20-Node Physics) */}
                            <svg className="absolute -top-4 left-0 w-full h-9 pointer-events-none z-10 overflow-visible" viewBox="0 0 200 36" preserveAspectRatio="none">
                                <path ref={backWaveRef} d="M 0,18 L 200,18 L 200,36 L 0,36 Z" fill={backWaveColor} opacity="0.65"></path>
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
                                    stroke="rgba(255,255,255,0.95)" 
                                    strokeWidth="2.2" 
                                    strokeLinecap="round"
                                    style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.85))' }}
                                />
                            </svg>
                            <div className="liquid-meniscus-sheen" />
                        </>
                    )}

                    {/* Settled Insoluble Precipitate Sediment Layer at vessel floor */}
                    {activePrecipitate && sedimentHeightPct > 0 && (
                        <div 
                            className="sediment-layer flex items-center justify-center overflow-hidden"
                            style={{ 
                                height: `${sedimentHeightPct}%`,
                                background: activePrecipitate.bgGrad
                            }}
                            title={`${activePrecipitate.label} (${activePrecipitate.volume} mL)`}
                        >
                            <span className="text-[8px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] opacity-90 select-none pointer-events-none truncate px-1">
                                {activePrecipitate.label}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <canvas ref={canvasRef} className={`reaction-canvas ${isFlask ? 'flask-canvas' : ''}`}></canvas>
        </div>
    );
};

export default LabContainer;