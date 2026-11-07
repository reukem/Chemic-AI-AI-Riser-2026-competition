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
            {/* Holographic Cursor Light Trail (Direct GPU Transform - Zero Re-render) */}
            <div 
                ref={cursorLightRef}
                className="fixed pointer-events-none w-48 h-48 rounded-full opacity-80 mix-blend-screen blur-xl z-50 will-change-transform"
                style={{
                    display: 'none',
                    left: 0,
                    top: 0,
                    background: 'radial-gradient(circle, rgba(34,211,238,0.5) 0%, transparent 70%)',
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

            {/* Holographic 3D Workbench Floor / Table Stage (Raised 36vh with Illuminated Horizon Rim) */}
            <div 
                className="absolute bottom-0 left-0 right-0 h-[36vh] desk-surface z-0 pointer-events-none"
                style={{ 
                    borderTop: '2px solid rgba(34, 211, 238, 0.35)',
                    boxShadow: '0 -15px 40px rgba(6, 182, 212, 0.15)',
                    background: 'linear-gradient(to top, rgba(4, 15, 30, 0.95) 0%, rgba(2, 8, 18, 0.98) 70%, rgba(1, 4, 10, 0.99) 100%)',
                    perspective: '600px',
                }}
            >
                {/* Subtle perspective AR grid lines */}
                <div 
                    className="absolute inset-0 opacity-25"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.25) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                        transform: 'perspective(500px) rotateX(50deg)',
                        transformOrigin: 'top center'
                    }}
                />
                {/* Horizon glow rim light */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-90 shadow-[0_0_15px_#22d3ee]" />
            </div>
        </div>
    );
};

export default LabCanvas;
