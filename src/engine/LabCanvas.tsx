import React, { useState, useEffect, useRef } from 'react';
import LabContainer from './LabContainer';
import { useSimulationStore, getTableBenchY } from './store';
import PeriodicTableBoard from '../ui/PeriodicTableBoard';
import VFXEngine from './VFXEngine';
import { evaluateThermodynamicState } from './ThermodynamicEngine';

const LabCanvas: React.FC = () => {
    const containers = useSimulationStore(state => state.containers);
    const spawnContainer = useSimulationStore(state => state.spawnContainer);

    const [draggingContainerId, setDraggingContainerId] = useState<number | null>(null);
    const cursorLightRef = useRef<HTMLDivElement>(null);

    // Keep resting vessels anchored to the tabletop surface on window/fullscreen resize
    useEffect(() => {
        const handleResize = () => {
            const state = useSimulationStore.getState();
            const newTableY = getTableBenchY();
            const updated = state.containers.map(c => ({
                ...c,
                x: Math.max(70, Math.min(window.innerWidth - 220, c.x)),
                y: newTableY
            }));
            useSimulationStore.setState({ containers: updated });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Evaporation simulation tick loop
    useEffect(() => {
        const interval = setInterval(() => {
            const state = useSimulationStore.getState();
            if (state.isPaused || state.activeTab !== 'lab') return;

            let hasEvaporated = false;
            const updatedContainers = state.containers.map(c => {
                if (c.volume <= 0) return c;
                const thermo = evaluateThermodynamicState(c, state.env);
                if (thermo.isBoiling && thermo.evaporationRate > 0) {
                    hasEvaporated = true;
                    const newVol = Math.max(0, c.volume - thermo.evaporationRate);
                    const ratio = c.volume > 0 ? newVol / c.volume : 0;
                    const newContents: Record<string, number> = {};
                    for (const [k, v] of Object.entries(c.contents)) {
                        const remaining = v * ratio;
                        if (remaining > 0.05) newContents[k] = remaining;
                    }
                    return {
                        ...c,
                        volume: Math.round(newVol * 10) / 10,
                        contents: newContents
                    };
                }
                return c;
            });

            if (hasEvaporated) {
                useSimulationStore.setState({ containers: updatedContainers });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        if (cursorLightRef.current) {
            cursorLightRef.current.style.display = 'block';
            cursorLightRef.current.style.transform = `translate3d(${e.clientX - 96}px, ${e.clientY - 96}px, 0)`;
        }
        e.preventDefault();
        if (e.dataTransfer.types.includes('containertype') || e.dataTransfer.types.includes('containerid')) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (cursorLightRef.current) {
            cursorLightRef.current.style.display = 'none';
        }
        const containerType = e.dataTransfer.getData('containerType');
        if (containerType === 'beaker' || containerType === 'flask') {
            e.preventDefault();
            // Strictly clamp drop to table bench floor
            const tableY = getTableBenchY();
            const dropX = Math.max(70, Math.min(window.innerWidth - 180, e.clientX - 70));
            spawnContainer(containerType, dropX, tableY);
        }
    };

    return (
        <div
            id="lab-canvas-viewport"
            className="flex-1 relative w-full h-full overflow-hidden will-change-transform"
            onDragOver={handleDragOver}
            onDragLeave={() => {
                if (cursorLightRef.current) cursorLightRef.current.style.display = 'none';
            }}
            onDrop={handleDrop}
        >
            {/* Vivid Multi-Color Chemical Spectrum Ambient Lighting ("Chemistry is About Colors") */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[6%] left-[18%] w-[520px] h-[420px] bg-emerald-500/12 rounded-full blur-[135px]" />
                <div className="absolute top-[12%] right-[16%] w-[540px] h-[440px] bg-purple-500/12 rounded-full blur-[140px]" />
                <div className="absolute bottom-[24%] left-[42%] -translate-x-1/2 w-[620px] h-[340px] bg-cyan-500/12 rounded-full blur-[130px]" />
                <div className="absolute top-[28%] left-[48%] w-[420px] h-[300px] bg-amber-500/8 rounded-full blur-[125px]" />
            </div>

            {/* Holographic Cursor Light Trail (Direct GPU Transform - Zero Re-render) */}
            <div 
                ref={cursorLightRef}
                className="fixed pointer-events-none w-48 h-48 rounded-full opacity-80 mix-blend-screen blur-xl z-50 will-change-transform"
                style={{
                    display: 'none',
                    left: 0,
                    top: 0,
                    background: 'radial-gradient(circle, rgba(52,211,153,0.5) 0%, rgba(34,211,238,0.35) 45%, transparent 70%)',
                }}
            />

            {/* Background 2D Periodic Table Board */}
            <div className="fixed inset-0 pointer-events-none z-10">
                <PeriodicTableBoard />
            </div>

            <VFXEngine />

            <div className="absolute inset-0 z-30 pointer-events-none">
                {containers.map(c => (
                    <LabContainer
                        key={c.id}
                        id={c.id}
                        isDragging={draggingContainerId === c.id}
                        onDragStart={() => setDraggingContainerId(c.id)}
                        onDragEnd={() => setDraggingContainerId(null)}
                        draggingContainerId={draggingContainerId}
                    />
                ))}
            </div>

            {/* Holographic 3D Workbench Floor / Table Stage (28vh with Prismatic Chemical Horizon Rim) */}
            <div 
                className="absolute bottom-0 left-0 right-0 h-[28vh] desk-surface z-0 pointer-events-none"
                style={{ 
                    boxShadow: '0 -18px 50px rgba(16, 185, 129, 0.16), 0 -6px 25px rgba(34, 211, 238, 0.22)',
                    background: 'linear-gradient(to top, rgba(6, 20, 38, 0.96) 0%, rgba(5, 15, 30, 0.97) 60%, rgba(4, 11, 24, 0.98) 100%)',
                    perspective: '600px',
                }}
            >
                {/* Prismatic Multi-Color Chemical Spectrum Horizon Bar */}
                <div
                    className="absolute top-0 left-0 right-0 h-[2.5px]"
                    style={{
                        background: 'linear-gradient(90deg, rgba(16,185,129,0.75) 0%, rgba(34,211,238,0.9) 35%, rgba(168,85,247,0.8) 70%, rgba(245,158,11,0.75) 100%)',
                        boxShadow: '0 0 18px rgba(34, 211, 238, 0.55)'
                    }}
                />
                {/* Vivid perspective AR grid lines */}
                <div 
                    className="absolute -inset-x-[15%] top-0 h-[240%] opacity-30"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.32) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.32) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                        transform: 'perspective(500px) rotateX(55deg)',
                        transformOrigin: 'top center'
                    }}
                />
            </div>
        </div>
    );
};

export default LabCanvas;
