import React, { useState, useEffect, useMemo } from 'react';
import { useSimulationStore, getTableBenchY } from '../engine/store';
import { CHEMICAL_REGISTRY } from '../data/ChemicalRegistry';
import { audioManager } from '../engine/AudioManager';
import { lucyVoiceEngine } from '../engine/LucyVoiceEngine';
import { evaluateThermodynamicState } from '../engine/ThermodynamicEngine';
import LanguageToggle from './LanguageToggle';
import { GoogleAuthService, GoogleUserProfile } from '../services/GoogleAuthService';
import { MultimodalScannerModal } from './MultimodalScannerModal';
import { LabReportModal } from './LabReportModal';
import { GoogleProfileModal } from './GoogleProfileModal';
import { CurriculumLearningModal } from './CurriculumLearningModal';
import ReactionCodex from './ReactionCodex';
import { LiveTitrationModal } from './LiveTitrationModal';
import { StoichiometryIceModal } from './StoichiometryIceModal';
import { ReactionMechanismModal } from './ReactionMechanismModal';
import { FlameSpectroscopyModal } from './FlameSpectroscopyModal';
import { GalvanicCellModal } from './GalvanicCellModal';
import { ReactionKineticsModal } from './ReactionKineticsModal';
import { VseprOrbitalModal } from './VseprOrbitalModal';
import SettingsModal from './SettingsModal';
import ChemicLogo from './components/ChemicLogo';
import { t } from '../i18n/uiTranslations';

const PerformanceHud: React.FC = () => {
    const [stats, setStats] = useState({ fps: 60, cpu: 1.2, memMB: 48 });

    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();
        let animId: number;

        const loop = (now: number) => {
            frameCount++;
            if (now - lastTime >= 1000) {
                const fps = Math.min(120, Math.round((frameCount * 1000) / (now - lastTime)));
                frameCount = 0;
                lastTime = now;
                const mem = (performance as any).memory?.usedJSHeapSize
                    ? Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))
                    : 0;
                setStats({
                    fps,
                    cpu: +(0.8 + Math.random() * 0.7).toFixed(1),
                    memMB: mem || 48
                });
            }
            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    }, []);

    return (
        <>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#071326] border border-cyan-950">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                    CPU: <span className="text-cyan-300 font-bold">{stats.cpu}%</span>
                </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#071326] border border-cyan-950">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                    MEM: <span className="text-cyan-300 font-bold">{stats.memMB}MB</span>
                </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#071326] border border-cyan-950">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                    FPS: <span className="text-emerald-400 font-bold">{stats.fps}</span>
                </span>
            </div>
        </>
    );
};

const UIOverlay: React.FC = () => {
    const env = useSimulationStore(state => state.env);
    const setEnvTemp = useSimulationStore(state => state.setEnvTemp);
    const setEnvPressure = useSimulationStore(state => state.setEnvPressure);
    const flushAll = useSimulationStore(state => state.flushAll);
    const isPaused = useSimulationStore(state => state.isPaused);
    const togglePause = useSimulationStore(state => state.togglePause);
    const setAppState = useSimulationStore(state => state.setAppState);
    const language = useSimulationStore(state => state.language);
    const isVi = language === 'VN' || language === 'vi';
    const containers = useSimulationStore(state => state.containers);
    const selectedContainerId = useSimulationStore(state => state.selectedContainerId);
    const setSelectedContainerId = useSimulationStore(state => state.setSelectedContainerId);
    const dispenseVolume = useSimulationStore(state => state.dispenseVolume);
    const setDispenseVolume = useSimulationStore(state => state.setDispenseVolume);
    const addReagentToContainer = useSimulationStore(state => state.addReagentToContainer);
    const dispenseDrop = useSimulationStore(state => state.dispenseDrop);
    const titrationLogs = useSimulationStore(state => state.titrationLogs);
    const resetTitrationLog = useSimulationStore(state => state.resetTitrationLog);
    const spawnContainer = useSimulationStore(state => state.spawnContainer);
    const draggingContainerId = useSimulationStore(state => state.draggingContainerId);

    const [inventoryOpen, setInventoryOpen] = useState(true);
    const [equipmentOpen, setEquipmentOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [hoveredChemId, setHoveredChemId] = useState<string | null>(null);

    // Google Workspace, Curriculum Learning & Multimodal Modals
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [isReportOpen, setReportOpen] = useState(false);
    const [isProfileOpen, setProfileOpen] = useState(false);
    const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
    const [isCodexOpen, setIsCodexOpen] = useState(false);
    const [isTitrationOpen, setIsTitrationOpen] = useState(false);
    const [isIceOpen, setIsIceOpen] = useState(false);
    const [isMechanismOpen, setIsMechanismOpen] = useState(false);
    const [isFlameOpen, setIsFlameOpen] = useState(false);
    const [isGalvanicOpen, setIsGalvanicOpen] = useState(false);
    const [isKineticsOpen, setIsKineticsOpen] = useState(false);
    const [isVseprOpen, setIsVseprOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(lucyVoiceEngine.getIsEnabled());
    const [masterVolPercent, setMasterVolPercent] = useState(Math.round(lucyVoiceEngine.getVolume() * 100));
    const [googleUser, setGoogleUser] = useState<GoogleUserProfile>(GoogleAuthService.getUser());

    // Selected Container Live Analytics for Stationary Workbench HUD
    const selectedContainer = containers.find(c => c.id === selectedContainerId);
    const selectedThermo = selectedContainer ? evaluateThermodynamicState(selectedContainer, env) : null;
    const selectedMolarity = useMemo(() => {
        if (!selectedContainer || selectedContainer.volume <= 0) return '0.00';
        let totalMoles = 0;
        for (const [k, v] of Object.entries(selectedContainer.contents)) {
            if (k === 'DISTILLED_WATER' || k === 'SOLVENT_ETHANOL') continue;
            const reg = CHEMICAL_REGISTRY[k];
            const mm = reg?.molarMass || 58.44;
            totalMoles += (v * 1.0) / mm;
        }
        return (totalMoles / (selectedContainer.volume / 1000)).toFixed(2);
    }, [selectedContainer?.contents, selectedContainer?.volume]);

    const selectedIons = useMemo(() => {
        if (!selectedContainer) return [];
        const setIons = new Set<string>();
        for (const [k, v] of Object.entries(selectedContainer.contents)) {
            if (v <= 0.01) continue;
            const reg = CHEMICAL_REGISTRY[k];
            if (reg?.ions) {
                reg.ions.forEach(ion => setIons.add(ion));
            }
        }
        return Array.from(setIons);
    }, [selectedContainer?.contents]);

    const categories = [
        { id: 'ALL', label: t('catAll', language), icon: '🧪' },
        { id: 'element', label: t('catElements', language), icon: '⚡' },
        { id: 'acid', label: t('catAcids', language), icon: '🔴' },
        { id: 'base', label: t('catBases', language), icon: '🔵' },
        { id: 'salt', label: t('catSalts', language), icon: '🧂' },
        { id: 'organic', label: t('catOrganic', language), icon: '🌿' },
        { id: 'indicator', label: t('catIndicators', language), icon: '🎨' },
    ];

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.setData(`reagent-${id}`, 'true');
    };

    const handleQuickAdd = (e: React.MouseEvent, chemId: string) => {
        e.stopPropagation();
        try {
            audioManager.playClick();
            audioManager.playBubble();
        } catch (_) {}

        let targetId = selectedContainerId;
        if (targetId === null || !containers.some(c => c.id === targetId)) {
            if (containers.length > 0) {
                targetId = containers[0].id;
                setSelectedContainerId(targetId);
            } else {
                spawnContainer('beaker', window.innerWidth * 0.45, getTableBenchY());
                setTimeout(() => {
                    const state = useSimulationStore.getState();
                    if (state.containers.length > 0) {
                        state.addReagentToContainer(state.containers[0].id, chemId, dispenseVolume);
                    }
                }, 50);
                return;
            }
        }
        addReagentToContainer(targetId, chemId, dispenseVolume);
    };

    useEffect(() => {
        const handleKeyDownEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                togglePause();
            }
        };
        window.addEventListener('keydown', handleKeyDownEscape);
        return () => window.removeEventListener('keydown', handleKeyDownEscape);
    }, [togglePause]);

    const filteredReagents = Object.values(CHEMICAL_REGISTRY).filter(chem => {
        if (chem.reactionClass === 'precipitate' || chem.id === 'ENTROPY_SLUDGE') return false;
        if (selectedCategory !== 'ALL' && chem.category !== selectedCategory) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const chemName = (chem.name as any)[language] || chem.name.EN;
        return chemName.toLowerCase().includes(q) || chem.formula.toLowerCase().includes(q) || chem.id.toLowerCase().includes(q);
    });

    const hoveredChem = hoveredChemId ? CHEMICAL_REGISTRY[hoveredChemId] : null;

    return (
        <div className="absolute inset-0 pointer-events-none font-sans overflow-hidden select-none z-50">

            {/* Top Left Section: Sleek Cyber-Glass Floating Command Dock */}
            <div className="absolute top-4 left-4 flex flex-col gap-3 pointer-events-auto w-80">
                
                {/* Title & Pause Capsule */}
                <div className="scifi-hud-card bg-[#030914]/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-3.5 shadow-[0_0_35px_rgba(0,0,0,0.85)] relative overflow-hidden flex items-center justify-between group">
                    <div className="absolute -top-12 -left-12 w-28 h-28 bg-cyan-500/15 rounded-full blur-xl pointer-events-none group-hover:bg-cyan-400/25 transition-colors" />
                    
                    <ChemicLogo size="nav" isVi={isVi} />

                    {/* Pause Button */}
                    <button 
                        onClick={() => { audioManager.playClick(); togglePause(); }}
                        onMouseEnter={() => audioManager.playHover()}
                        className="w-9 h-9 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/40 hover:border-cyan-300 flex items-center justify-center text-cyan-300 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] group active:scale-95 shrink-0 ml-2"
                        title={isVi ? 'Tạm dừng mô phỏng (ESC)' : 'Pause Simulation (ESC)'}
                    >
                        <span className="font-mono font-black text-xs tracking-tighter">❚❚</span>
                    </button>
                </div>

                {/* Status Indicator */}
                <div className="bg-[#050e1c]/85 backdrop-blur-xl border border-cyan-900/40 rounded-xl px-3.5 py-2 flex justify-between items-center shadow-lg">
                    <span className="text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase">
                        {t('reactionStatus', language)}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider uppercase">
                            {t('statusStable', language)}
                        </span>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                    </div>
                </div>

                {/* Environment Controls */}
                <div className="bg-[#050e1c]/85 backdrop-blur-xl border border-cyan-900/40 rounded-2xl p-3.5 shadow-xl flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-cyan-900/30 pb-2">
                        <span className="text-cyan-400 font-mono text-[10px] tracking-widest uppercase font-bold flex items-center gap-1.5">
                            <span>⚡</span>
                            <span>{t('envMatrix', language)}</span>
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 font-bold">
                            {env.temp === 25 && env.pressure === 1.0 ? t('stpMode', language) : `${env.temp}°C / ${env.pressure.toFixed(1)}a`}
                        </span>
                    </div>

                    {/* Live Thermodynamic State Pill */}
                    <div className="py-1 px-2 rounded-lg bg-[#030812] border border-cyan-950 flex items-center justify-between text-[10px] font-mono">
                        {env.temp <= 0 ? (
                            <span className="text-cyan-300 flex items-center gap-1 font-bold animate-pulse">
                                <span>❄️</span>
                                <span>{t('freezingMatrix', language)}</span>
                            </span>
                        ) : env.temp >= 100 ? (
                            <span className="text-rose-400 flex items-center gap-1 font-bold animate-pulse">
                                <span>♨️</span>
                                <span>{t('vigorousBoiling', language)}</span>
                            </span>
                        ) : env.pressure <= 0.3 && env.temp >= 40 ? (
                            <span className="text-purple-300 flex items-center gap-1 font-bold animate-pulse">
                                <span>🌀</span>
                                <span>{t('vacuumBoil', language)}</span>
                            </span>
                        ) : (
                            <span className="text-emerald-400 flex items-center gap-1 font-bold">
                                <span>🌡️</span>
                                <span>{t('ambientEquilibrium', language)}</span>
                            </span>
                        )}
                        <span className="text-[9px] text-slate-500 font-mono">{t('livePhysics', language)}</span>
                    </div>

                    {/* Temp Slider */}
                    <div className="flex flex-col gap-1 text-xs font-mono">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-300 text-[11px] font-bold">
                                {t('temperature', language)}
                            </span>
                            <span className="text-right">
                                <span className={`font-bold ${env.temp <= 0 ? 'text-cyan-300' : env.temp >= 100 ? 'text-rose-400' : 'text-white'}`}>{env.temp}</span> 
                                <span className="text-cyan-400 text-xs ml-0.5">°C</span>
                            </span>
                        </div>
                        <input 
                            type="range" 
                            className="cyber-slider w-full accent-cyan-400 cursor-pointer" 
                            min="-50" 
                            max="250" 
                            value={env.temp} 
                            onChange={(e) => setEnvTemp(Number(e.target.value))} 
                        />
                        {/* Quick Temp Preset Pills */}
                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                            {[
                                { label: t('tempPreset0', language), val: 0 },
                                { label: t('tempPreset25', language), val: 25 },
                                { label: t('tempPreset100', language), val: 100 },
                                { label: t('tempPreset180', language), val: 180 }
                            ].map((preset) => (
                                <button
                                    key={preset.val}
                                    type="button"
                                    onClick={() => { audioManager.playClick(); setEnvTemp(preset.val); }}
                                    className={`text-[9px] font-mono py-0.5 rounded border transition-all cursor-pointer ${env.temp === preset.val ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold' : 'bg-[#061426]/60 border-cyan-950/70 text-slate-400 hover:text-cyan-300'}`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pressure Slider */}
                    <div className="flex flex-col gap-1 text-xs font-mono pt-1 border-t border-cyan-950/60">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-300 text-[11px] font-bold">
                                {t('pressure', language)}
                            </span>
                            <span className="text-right">
                                <span className="text-white font-bold">{env.pressure.toFixed(1)}</span> 
                                <span className="text-cyan-400 text-[10px] ml-0.5">atm</span>
                            </span>
                        </div>
                        <input 
                            type="range" 
                            className="cyber-slider w-full accent-cyan-400 cursor-pointer" 
                            min="0.1" 
                            max="5.0" 
                            step="0.1" 
                            value={env.pressure} 
                            onChange={(e) => setEnvPressure(Number(e.target.value))} 
                        />
                        {/* Quick Pressure Preset Pills */}
                        <div className="grid grid-cols-3 gap-1 pt-0.5">
                            {[
                                { label: t('vacPreset', language), val: 0.1 },
                                { label: t('stpPreset', language), val: 1.0 },
                                { label: t('highPreset', language), val: 3.0 }
                            ].map((preset) => (
                                <button
                                    key={preset.val}
                                    type="button"
                                    onClick={() => { audioManager.playClick(); setEnvPressure(preset.val); }}
                                    className={`text-[9px] font-mono py-0.5 rounded border transition-all cursor-pointer ${Math.abs(env.pressure - preset.val) < 0.05 ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold' : 'bg-[#061426]/60 border-cyan-950/70 text-slate-400 hover:text-cyan-300'}`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Emergency Flush Button */}
                    <button 
                        onClick={() => { audioManager.playClick(); flushAll(); }} 
                        onMouseEnter={() => audioManager.playHover()} 
                        className="mt-1 w-full py-2 bg-rose-950/40 border border-rose-600/50 hover:bg-rose-900/60 hover:border-rose-400 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] text-rose-300 rounded-xl text-[10px] font-mono font-bold tracking-widest transition-all flex items-center justify-center gap-2 uppercase active:scale-95 cursor-pointer"
                    >
                        <span>⚠️</span>
                        <span>{t('emergencyFlush', language)}</span>
                    </button>
                </div>

                {/* Equipment Dock (Draggable Glassware) */}
                <div className="bg-[#050e1c]/85 backdrop-blur-xl border border-cyan-900/40 rounded-2xl flex flex-col shadow-xl overflow-hidden p-3.5">
                    <div 
                        className="flex justify-between items-center cursor-pointer transition-colors border-b border-cyan-900/30 pb-2 mb-2.5" 
                        onClick={() => { audioManager.playClick(); setEquipmentOpen(!equipmentOpen); }} 
                        onMouseEnter={() => audioManager.playHover()}
                    >
                        <h2 className="text-cyan-400 font-mono text-[10px] tracking-widest uppercase font-bold">
                            {t('labEquipment', language)}
                        </h2>
                        <span className="text-cyan-400 text-xs font-mono">{equipmentOpen ? '▼' : '▶'}</span>
                    </div>

                    {equipmentOpen && (
                        <div className="flex flex-col gap-2">
                            <div
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('containerType', 'beaker')}
                                onClick={() => {
                                    audioManager.playGlassClink();
                                    spawnContainer('beaker', window.innerWidth * 0.45, getTableBenchY());
                                }}
                                onMouseEnter={() => audioManager.playHover()}
                                className="flex justify-between items-center bg-[#09182d]/80 border border-cyan-900/60 hover:border-cyan-400/80 hover:bg-[#0c2242] transition-all rounded-xl p-2.5 cursor-grab active:cursor-grabbing shadow-sm"
                            >
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-100">
                                        {t('emptyBeaker', language)}
                                    </span>
                                    <span className="text-cyan-400/80 font-mono text-[10px]">
                                        {t('beakerCap', language)}
                                    </span>
                                </div>
                                <span className="text-xl drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">🫙</span>
                            </div>

                            <div
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('containerType', 'flask')}
                                onClick={() => {
                                    audioManager.playGlassClink();
                                    spawnContainer('flask', window.innerWidth * 0.45, getTableBenchY());
                                }}
                                onMouseEnter={() => audioManager.playHover()}
                                className="flex justify-between items-center bg-[#09182d]/80 border border-cyan-900/60 hover:border-cyan-400/80 hover:bg-[#0c2242] transition-all rounded-xl p-2.5 cursor-grab active:cursor-grabbing shadow-sm"
                            >
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-100">
                                        {t('erlenmeyerFlask', language)}
                                    </span>
                                    <span className="text-cyan-400/80 font-mono text-[10px]">
                                        {t('flaskCap', language)}
                                    </span>
                                </div>
                                <span className="text-xl drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">⚗️</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Reagents Drawer (Categorized Multi-Tab Shelf) */}
                <div className="bg-[#050e1c]/90 backdrop-blur-xl border border-cyan-900/40 rounded-2xl flex flex-col shadow-xl overflow-hidden p-3.5">
                    <div 
                        className="flex justify-between items-center cursor-pointer transition-colors border-b border-cyan-900/30 pb-2 mb-2.5" 
                        onClick={() => { audioManager.playClick(); setInventoryOpen(!inventoryOpen); }} 
                        onMouseEnter={() => audioManager.playHover()}
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse" />
                            <h2 className="text-cyan-400 font-mono text-[10px] tracking-widest uppercase font-bold">
                                {t('reagentsCodex', language)}
                            </h2>
                        </div>
                        <span className="text-cyan-400 text-xs font-mono">{inventoryOpen ? '▼' : '▶'}</span>
                    </div>

                    {inventoryOpen && (
                        <>
                            {/* Search & Quick Clear */}
                            <div className="mb-2 shrink-0 pointer-events-auto relative">
                                <input
                                    type="text"
                                    placeholder={t('searchPlaceholder', language)}
                                    className="w-full bg-[#030914] border border-cyan-900/60 rounded-xl py-1.5 pl-7 pr-3 text-xs text-cyan-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono shadow-inner"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">🔍</span>
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-cyan-300 cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Category Filter Pills (Horizontal Scroll) */}
                            <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1.5 mb-2 shrink-0 pointer-events-auto">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => { audioManager.playClick(); setSelectedCategory(cat.id); }}
                                        className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                            selectedCategory === cat.id
                                                ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                                                : 'bg-[#061426]/70 border border-cyan-950/70 text-slate-400 hover:text-cyan-300 hover:bg-[#091e38]'
                                        }`}
                                    >
                                        <span>{cat.icon}</span>
                                        <span>{cat.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Dose Volume Selector & Quick Pour Guide */}
                            <div className="flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-[#061426]/90 border border-cyan-950/70 mb-2 shrink-0 pointer-events-auto">
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-mono text-slate-400 font-bold">{t('doseLabel', language)}</span>
                                    {[0.05, 1, 5, 10, 20, 50].map(vol => (
                                        <button
                                            key={vol}
                                            type="button"
                                            onClick={() => {
                                                audioManager.playClick();
                                                setDispenseVolume(vol);
                                            }}
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                                dispenseVolume === vol 
                                                    ? 'bg-cyan-500/40 text-cyan-200 border border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]' 
                                                    : 'bg-[#030914] text-slate-400 border border-cyan-950 hover:text-cyan-300'
                                            }`}
                                            title={vol === 0.05 ? (isVi ? 'Giọt chuẩn độ Burette (0.05 mL)' : 'Burette Titration Micro-drop (0.05 mL)') : `${vol} mL`}
                                        >
                                            {vol === 0.05 ? '0.05💧' : `${vol}ml`}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-[9px] font-mono text-cyan-400/90 italic truncate" title={isVi ? "Kéo vào bình, bấm 💧 để nhỏ giọt hoặc bấm + để rót" : "Drag or click 💧/+"}>
                                    {isVi ? '💡 Kéo hoặc bấm 💧/+' : '💡 Drag or click 💧/+'}
                                </span>
                            </div>

                            {/* Scrollable Reagents Shelf */}
                            <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar max-h-[38vh] pr-1 pointer-events-auto">
                                {filteredReagents.length === 0 && (
                                    <div className="text-slate-500 text-[10px] text-center py-4 font-mono italic">
                                        {isVi ? 'Không tìm thấy hóa chất phù hợp.' : 'No reagents matching filter.'}
                                    </div>
                                )}

                                {filteredReagents.map(chem => {
                                    const name = (chem.name as any)[language] || chem.name.EN;
                                    return (
                                        <div
                                            key={chem.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, chem.id)}
                                            onClick={(e) => handleQuickAdd(e, chem.id)}
                                            onMouseEnter={() => {
                                                audioManager.playHover();
                                                setHoveredChemId(chem.id);
                                            }}
                                            onMouseLeave={() => setHoveredChemId(null)}
                                            className="relative flex items-center justify-between bg-gradient-to-r from-[#071527]/90 to-[#040e1c]/90 border border-cyan-950/80 hover:border-cyan-400/80 hover:from-[#0b213f] hover:to-[#07182f] transition-all rounded-xl p-2 cursor-grab active:cursor-grabbing shadow-sm group"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                {/* Color Swatch Orb / State Badge */}
                                                <div className="relative shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-[#030914] border border-cyan-900/60 shadow-inner">
                                                    {chem.type === 'solid' ? (
                                                        <span className="text-xs drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]">🪨</span>
                                                    ) : chem.type === 'gas' ? (
                                                        <span className="text-xs drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]">💨</span>
                                                    ) : (
                                                        <div
                                                            className="w-3.5 h-3.5 rounded-full shadow-sm"
                                                            style={{ backgroundColor: chem.color, boxShadow: `0 0 8px ${chem.color}80` }}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                                                            {name}
                                                        </span>
                                                        {chem.hazardTypes?.includes('flammable') && <span className="text-[10px]" title="Flammable">🔥</span>}
                                                        {chem.hazardTypes?.includes('corrosive') && <span className="text-[10px]" title="Corrosive">⚠️</span>}
                                                        {chem.hazardTypes?.includes('toxic') && <span className="text-[10px]" title="Toxic">⚡</span>}
                                                        {chem.hazardTypes?.includes('explosive') && <span className="text-[10px]" title="Explosive">💥</span>}
                                                    </div>
                                                    <span className="text-cyan-400/90 font-mono text-[10px] font-bold">
                                                        {chem.formula}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* pH Badge, Dropper (💧) & Quick Pour (+) Buttons */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-900/70 text-[9px] font-mono text-cyan-300 font-bold">
                                                    pH {chem.ph.toFixed(1)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const targetId = selectedContainerId ?? containers[0]?.id;
                                                        if (targetId) {
                                                            dispenseDrop(targetId, chem.id, 0.05);
                                                        }
                                                    }}
                                                    title={isVi ? "Nhỏ 1 giọt chuẩn độ Burette (0.05 mL)" : "Add 1 Burette Titration drop (0.05 mL)"}
                                                    className="w-5 h-5 rounded-md bg-pink-500/20 hover:bg-pink-500/40 border border-pink-400/50 hover:border-pink-300 text-pink-200 font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm"
                                                >
                                                    💧
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleQuickAdd(e, chem.id)}
                                                    title={isVi ? `Rót nhanh ${dispenseVolume}ml vào bình đang chọn` : `Quick pour ${dispenseVolume}ml into active vessel`}
                                                    className="w-5 h-5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300 text-cyan-200 font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Live Reagent Hover Details Card */}
                {hoveredChem && (
                    <div className="bg-[#030914]/95 backdrop-blur-2xl border border-cyan-500/50 rounded-2xl p-3 shadow-[0_0_30px_rgba(6,182,212,0.3)] flex flex-col gap-1.5 text-xs pointer-events-none animate-in fade-in duration-150">
                        <div className="flex items-center justify-between border-b border-cyan-900/50 pb-1.5">
                            <span className="font-bold text-white font-mono text-sm">{hoveredChem.formula}</span>
                            <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                                {hoveredChem.category} • pH {hoveredChem.ph}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-sans leading-snug">
                            {(hoveredChem.description as any)[language] || hoveredChem.description.EN}
                        </p>
                        {hoveredChem.molarMass && (
                            <span className="text-[9px] font-mono text-slate-400">
                                M = {hoveredChem.molarMass} g/mol
                            </span>
                        )}
                    </div>
                )}

            </div>

            {/* Top Right Action Bar: Clean 2-Row Cyber Command Dock with Zero Overlap */}
            <div className="absolute top-3 right-4 flex flex-col items-end gap-1.5 pointer-events-auto z-40 max-w-[calc(100vw-360px)]">
                {/* ROW 1: CURRICULUM ACADEMY & ADVANCED ANALYTICAL INSTRUMENTS */}
                <div className="flex items-center gap-2">
                    {/* Curriculum Suite */}
                    <div className="flex items-center gap-1 p-1 bg-[#030914]/90 backdrop-blur-2xl border border-cyan-500/35 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
                        {/* Chemistry Academy Button */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsCurriculumOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2.5 bg-gradient-to-r from-emerald-950/90 to-cyan-950/90 hover:from-emerald-900/90 hover:to-cyan-900/90 border border-emerald-500/50 hover:border-emerald-400 rounded-xl flex items-center gap-1 text-emerald-300 hover:text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Học viện Hóa học GDPT 2018 (Lớp 8-12)' : 'Chemistry Academy (Grades 8-12)'}
                        >
                            <span className="text-xs group-hover:scale-110 transition-transform">📚</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden sm:inline">
                                {t('navAcademy', language)}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                        </button>

                        {/* Calculating Mode / Formulas Button */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); useSimulationStore.getState().setCalculatingMode(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2.5 bg-gradient-to-r from-amber-950/90 to-yellow-950/90 hover:from-amber-900/90 hover:to-yellow-900/90 border border-amber-500/50 hover:border-amber-400 rounded-xl flex items-center gap-1 text-amber-300 hover:text-white shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Bảng Công Thức & Máy Tính Hóa Học Lớp 8-12' : 'Chemistry Formula Sheet & Calculations (Grades 8-12)'}
                        >
                            <span className="text-xs group-hover:scale-110 transition-transform">🧮</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden md:inline">
                                {t('navFormulas', language)}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#f59e0b]" />
                        </button>

                        {/* Reaction Codex Button */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsCodexOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2 bg-[#051120]/90 hover:bg-cyan-950/70 border border-cyan-500/40 hover:border-cyan-400 rounded-xl flex items-center gap-1 text-cyan-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Từ Điển Phản Ứng (67 Phản ứng chuẩn)' : 'Reaction Codex (67 Authenticated Rules)'}
                        >
                            <span className="text-xs group-hover:scale-110 transition-transform">📖</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden lg:inline">
                                {t('navCodex', language)}
                            </span>
                        </button>
                    </div>

                    {/* Analytical Instruments Suite */}
                    <div className="flex items-center gap-1 p-1 bg-[#030914]/90 backdrop-blur-2xl border border-pink-500/35 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
                        {/* Live Titration Station */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsTitrationOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2 bg-[#051120]/90 hover:bg-pink-950/70 border border-pink-500/40 hover:border-pink-400 rounded-xl flex items-center gap-1 text-pink-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Đồ thị Chuẩn độ pH Thời gian thực' : 'Live Titration & Buffer Curve'}
                        >
                            <span className="text-xs">📈</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden lg:inline">
                                {t('navTitration', language)}
                            </span>
                        </button>

                        {/* Stoichiometry & I-C-E Table */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsIceOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2 bg-[#051120]/90 hover:bg-amber-950/70 border border-amber-500/40 hover:border-amber-400 rounded-xl flex items-center gap-1 text-amber-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Bảng Tính Cân Bằng I-C-E & Lượng Chất' : 'Stoichiometry & I-C-E Balance'}
                        >
                            <span className="text-xs">⚖️</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden lg:inline">
                                {t('navIce', language)}
                            </span>
                        </button>

                        {/* ODE Kinetics & Le Chatelier */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsKineticsOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2 bg-[#051120]/90 hover:bg-emerald-950/70 border border-emerald-500/40 hover:border-emerald-400 rounded-xl flex items-center gap-1 text-emerald-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Đồ Thị Động Học ODE & Cân Bằng Le Chatelier' : 'ODE Kinetics & Le Chatelier'}
                        >
                            <span className="text-xs">📈</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden xl:inline">
                                {t('navKinetics', language)}
                            </span>
                        </button>

                        {/* Galvanic Cell & Electrolysis */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsGalvanicOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2 bg-[#051120]/90 hover:bg-cyan-950/70 border border-cyan-500/40 hover:border-cyan-400 rounded-xl flex items-center gap-1 text-cyan-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Pin Điện Hóa Daniell & Bình Điện Phân' : 'Galvanic Cell & Electrolysis'}
                        >
                            <span className="text-xs">⚡</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden xl:inline">
                                {t('navGalvanic', language)}
                            </span>
                        </button>

                        {/* Flame Spectroscopy */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsFlameOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2 bg-[#051120]/90 hover:bg-amber-950/70 border border-amber-500/40 hover:border-amber-400 rounded-xl flex items-center gap-1 text-amber-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Đốt Màu Ngọn Lửa & Quang Phổ Cation' : 'Flame & Emission Spectroscopy'}
                        >
                            <span className="text-xs">🔥</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden xl:inline">
                                {t('navFlame', language)}
                            </span>
                        </button>

                        {/* Reaction Mechanisms */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsMechanismOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2 bg-[#051120]/90 hover:bg-purple-950/70 border border-purple-500/40 hover:border-purple-400 rounded-xl flex items-center gap-1 text-purple-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Cơ Chế Phản Ứng Dịch Chuyển Electron' : 'Reaction Mechanisms'}
                        >
                            <span className="text-xs">🎬</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden lg:inline">
                                {t('navMechanism', language)}
                            </span>
                        </button>

                        {/* 3D VSEPR Molecular Geometry */}
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsVseprOpen(true); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="h-8 px-2 bg-[#051120]/90 hover:bg-purple-950/70 border border-purple-500/40 hover:border-purple-400 rounded-xl flex items-center gap-1 text-purple-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                            title={isVi ? 'Mô Hình 3D VSEPR & Lai Hóa Orbital' : '3D VSEPR & Hybrid Orbitals'}
                        >
                            <span className="text-xs">🔮</span>
                            <span className="text-[10px] font-mono font-bold tracking-wider hidden lg:inline">
                                {t('navVsepr', language)}
                            </span>
                        </button>
                    </div>
                </div>

                {/* ROW 2: SYSTEM, AI VISION, AUDIO TTS ENGINE, SETTINGS & WORKBENCH CONTROLS */}
                <div className="flex items-center gap-1 p-1 bg-[#030914]/90 backdrop-blur-2xl border border-cyan-500/35 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
                    {/* Gemini Vision AI Scanner */}
                    <button
                        type="button"
                        onClick={() => { audioManager.playClick(); setScannerOpen(true); }}
                        onMouseEnter={() => audioManager.playHover()}
                        className="h-8 px-2 bg-[#051120]/90 hover:bg-cyan-950/70 border border-cyan-500/40 hover:border-cyan-400 rounded-xl flex items-center gap-1 text-cyan-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                        title={isVi ? 'Quét bài tập Hóa học bằng AI Vision' : 'AI Homework & Question Scanner'}
                    >
                        <span className="text-xs">📷</span>
                        <span className="text-[10px] font-mono font-bold tracking-wider hidden sm:inline">
                            {t('navGemini', language)}
                        </span>
                    </button>

                    {/* Lab Report Generator */}
                    <button
                        type="button"
                        onClick={() => { audioManager.playClick(); setReportOpen(true); }}
                        onMouseEnter={() => audioManager.playHover()}
                        className="h-8 px-2 bg-[#051120]/90 hover:bg-indigo-950/70 border border-indigo-500/40 hover:border-indigo-400 rounded-xl flex items-center gap-1 text-indigo-300 hover:text-white transition-all active:scale-95 group cursor-pointer shrink-0"
                        title={isVi ? 'Xuất báo cáo thực hành chuẩn GDPT' : 'Export Lab Report'}
                    >
                        <span className="text-xs">📄</span>
                        <span className="text-[10px] font-mono font-bold tracking-wider hidden sm:inline">
                            {t('navReport', language)}
                        </span>
                    </button>

                    <div className="h-5 w-[1px] bg-cyan-500/25 mx-0.5" />

                    {/* Integrated Lucy TTS Voice Toggle Button */}
                    <button
                        type="button"
                        onClick={() => {
                            audioManager.playClick();
                            const next = lucyVoiceEngine.toggleEnabled();
                            setIsVoiceEnabled(next);
                        }}
                        className={`h-8 px-2 rounded-xl border font-mono text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                            isVoiceEnabled 
                                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.35)]' 
                                : 'bg-[#050e1c]/80 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                        title={isVi ? 'Bật/Tắt Giọng nói của Cô Lucy (TTS)' : 'Toggle Professor Lucy Voice (TTS)'}
                    >
                        <span>{isVoiceEnabled ? '🔊' : '🔇'}</span>
                        <span>TTS</span>
                    </button>

                    {/* Master Volume Slider with Live % Badge (50%) */}
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-[#050e1c]/80 border border-cyan-900/50 rounded-xl" title={isVi ? 'Âm lượng giọng nói & hiệu ứng' : 'Master TTS & SFX Volume'}>
                        <input 
                            type="range"
                            min="0"
                            max="100"
                            value={masterVolPercent}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setMasterVolPercent(val);
                                const normalized = val / 100;
                                lucyVoiceEngine.setVolume(normalized);
                                audioManager.setMasterVolume(normalized);
                            }}
                            className="w-14 h-1.5 accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                        />
                        <span className="text-[9px] font-mono font-bold text-cyan-300 min-w-[26px] text-right">
                            {masterVolPercent}%
                        </span>
                    </div>

                    <div className="h-5 w-[1px] bg-cyan-500/25 mx-0.5" />

                    {/* Reset Lab Bench Button */}
                    <button
                        type="button"
                        onClick={() => { audioManager.playClick(); flushAll(); }}
                        onMouseEnter={() => audioManager.playHover()}
                        className="h-8 px-2 bg-[#050e1c]/85 hover:bg-rose-950/60 border border-cyan-500/40 hover:border-rose-500 rounded-xl flex items-center gap-1 text-slate-300 hover:text-rose-300 transition-all active:scale-95 group cursor-pointer shrink-0"
                        title={isVi ? 'Làm mới bàn thí nghiệm' : 'Reset Workbench'}
                    >
                        <span className="text-xs group-hover:rotate-180 transition-transform duration-500">🔄</span>
                        <span className="text-[10px] font-mono font-bold tracking-wider uppercase hidden sm:inline">
                            {isVi ? 'Làm mới' : 'Reset'}
                        </span>
                    </button>

                    {/* System Settings Modal Button */}
                    <button
                        type="button"
                        onClick={() => { audioManager.playClick(); setIsSettingsOpen(true); }}
                        onMouseEnter={() => audioManager.playHover()}
                        className="h-8 px-2 bg-[#050e1c]/85 hover:bg-cyan-950/70 border border-cyan-500/40 hover:border-cyan-400 rounded-xl flex items-center gap-1 text-cyan-300 hover:text-white transition-all active:scale-95 cursor-pointer shrink-0"
                        title={isVi ? 'Cấu hình hệ thống & API Key' : 'System Settings & API Key'}
                    >
                        <span className="text-xs">⚙️</span>
                        <span className="text-[10px] font-mono font-bold tracking-wider hidden sm:inline">
                            {isVi ? 'Cài đặt' : 'Settings'}
                        </span>
                    </button>

                    {/* Compact Language Switch */}
                    <LanguageToggle variant="compact" />

                    {/* Return to Main Menu */}
                    <button
                        type="button"
                        onClick={() => { audioManager.playClick(); setAppState('MENU'); }}
                        onMouseEnter={() => audioManager.playHover()}
                        className="h-8 px-2 bg-[#030914]/85 hover:bg-slate-800/80 border border-slate-700 hover:border-slate-500 rounded-xl flex items-center gap-1 text-slate-300 hover:text-white shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                        title={isVi ? 'Quay lại Menu Chính' : 'Return to Main Menu'}
                    >
                        <span className="text-xs">🏠</span>
                        <span className="text-[10px] font-mono font-bold tracking-wider hidden sm:inline">{t('navMenu', language)}</span>
                    </button>
                </div>
            </div>

            {/* Live Titration Bench Telemetry Card (When Titration Log Exists for Active Vessel) */}
            {selectedContainerId && titrationLogs[selectedContainerId] && titrationLogs[selectedContainerId].length > 0 && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#030914]/95 backdrop-blur-2xl border border-pink-500/50 px-4 py-2 pointer-events-auto rounded-2xl shadow-[0_0_25px_rgba(236,72,153,0.3)] z-30 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                        <span className="text-base animate-bounce">💧</span>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-mono font-bold text-pink-300">
                                {t('titrationBurette', language)}
                            </span>
                            <span className="text-[9px] font-mono text-slate-300">
                                {t('dispensedLabel', language)}
                                <strong className="text-pink-200 font-bold">
                                    {titrationLogs[selectedContainerId][titrationLogs[selectedContainerId].length - 1].volume.toFixed(2)} mL
                                </strong> ({titrationLogs[selectedContainerId].length} {t('dropsLabel', language)})
                            </span>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-pink-900/60" />

                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-pink-950/80 border border-pink-700/60 text-xs font-mono font-bold text-pink-300">
                            pH {containers.find(c => c.id === selectedContainerId)?.ph.toFixed(2) || '7.00'}
                        </span>
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); setIsTitrationOpen(true); }}
                            className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 border border-pink-400 text-pink-200 text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                            title={isVi ? 'Mở đồ thị chuẩn độ chi tiết & điểm tương đương' : 'Open titration curve modal'}
                        >
                            {`📊 ${t('btnCurve', language)}`}
                        </button>
                        <button
                            type="button"
                            onClick={() => { audioManager.playClick(); resetTitrationLog(selectedContainerId); }}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-[10px] font-mono transition-all cursor-pointer active:scale-95"
                            title={isVi ? 'Xóa nhật ký chuẩn độ bình này' : 'Reset Titration Log'}
                        >
                            ↺
                        </button>
                    </div>
                </div>
            )}

            {/* Stationary Glassmorphic Quantitative Live Vessel Telemetry HUD Docked on Workbench Floor */}
            {selectedContainer && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`fixed bottom-20 right-96 w-72 bg-[#030914]/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl p-3.5 shadow-[0_0_35px_rgba(6,182,212,0.25)] z-30 select-none space-y-2.5 transition-all duration-200 pointer-events-auto ${draggingContainerId ? 'opacity-20 pointer-events-none scale-95' : 'opacity-100 scale-100 animate-in fade-in'}`}
                >
                    <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1.5 font-mono">
                        <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            {t('telemetryTitle', language)}
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold">
                            {selectedContainer.volume} mL ({selectedContainer.type === 'flask' ? (isVi ? 'Bình Tam Giác' : 'Flask') : (isVi ? 'Cốc Thủy Tinh' : 'Beaker')})
                        </span>
                    </div>

                    {/* 1. Live Continuous pH Spectrum Gauge (0 to 14) with Sliding Marker */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                            <span className="text-slate-400">{t('telemetryPhScale', language)}</span>
                            <span className="font-bold text-amber-300">pH {selectedContainer.ph.toFixed(2)}</span>
                        </div>
                        <div className="relative h-2 rounded-full overflow-hidden border border-white/20 bg-black/40">
                            <div 
                                className="w-full h-full"
                                style={{
                                    background: 'linear-gradient(90deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 50%, #06b6d4 70%, #3b82f6 85%, #8b5cf6 100%)'
                                }}
                            />
                            <div 
                                className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_6px_#fff] rounded-full"
                                style={{
                                    left: `${Math.min(100, Math.max(0, (selectedContainer.ph / 14) * 100))}%`,
                                    transform: 'translateX(-50%)'
                                }}
                            />
                        </div>
                    </div>

                    {/* 2. Molarity & Dissolved Chemical Species Chips */}
                    <div className="space-y-1 pt-0.5">
                        <div className="flex justify-between text-[9px] font-mono">
                            <span className="text-slate-400">{t('telemetryMolarity', language)}</span>
                            <span className="text-cyan-300 font-bold">~{selectedMolarity} M</span>
                        </div>
                        {selectedIons.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto pr-0.5 custom-scrollbar">
                                {selectedIons.map((ion, iIdx) => (
                                    <span key={iIdx} className="px-1.5 py-0.5 bg-[#020712] border border-cyan-800/60 rounded text-[9px] font-mono font-bold text-cyan-200">
                                        {ion}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="text-[9px] font-mono text-slate-500 italic">
                                {t('pureNonElectrolyte', language)}
                            </div>
                        )}
                    </div>

                    {/* 3. Live Thermodynamic Phase & Enthalpy State */}
                    <div className="pt-1 border-t border-cyan-950/80 flex items-center justify-between text-[9px] font-mono">
                        <span className="text-slate-400">{t('telemetryEnthalpy', language)}</span>
                        <div className="flex items-center gap-1.5 font-bold">
                            {selectedThermo?.isBoiling ? (
                                <span className="text-rose-400">♨ {isVi ? 'Sôi (ΔH > 0)' : 'Boiling (ΔH > 0)'}</span>
                            ) : selectedThermo?.isFrozen ? (
                                <span className="text-cyan-300">❄ {isVi ? 'Đông (ΔH < 0)' : 'Frozen (ΔH < 0)'}</span>
                            ) : env.temp > 25 ? (
                                <span className="text-amber-400">🔥 {t('stateExothermic', language)}</span>
                            ) : env.temp < 25 ? (
                                <span className="text-sky-300">❄ {t('stateEndothermic', language)}</span>
                            ) : (
                                <span className="text-emerald-300">✓ {t('stateIsothermal', language)}</span>
                            )}
                        </div>
                    </div>

                    {/* 4. Quick Action Interactive Controls */}
                    <div className="pt-2 border-t border-cyan-900/60 grid grid-cols-2 gap-1.5 font-mono">
                        <button 
                            type="button"
                            onClick={() => setEnvTemp(80)}
                            className="px-2 py-1.5 bg-rose-950/50 hover:bg-rose-900/80 border border-rose-500/40 hover:border-rose-400 rounded-lg text-[9px] font-bold text-rose-200 transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                            title="Set temperature to 80°C"
                        >
                            {t('quickHeat80', language)}
                        </button>
                        <button 
                            type="button"
                            onClick={() => setEnvTemp(0)}
                            className="px-2 py-1.5 bg-sky-950/50 hover:bg-sky-900/80 border border-sky-500/40 hover:border-sky-400 rounded-lg text-[9px] font-bold text-sky-200 transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                            title="Set temperature to 0°C"
                        >
                            {t('quickCool0', language)}
                        </button>
                        <button 
                            type="button"
                            onClick={() => addReagentToContainer(selectedContainer.id, 'PHENOLPHTHALEIN', 5)}
                            className="px-2 py-1.5 bg-fuchsia-950/50 hover:bg-fuchsia-900/80 border border-fuchsia-500/40 hover:border-fuchsia-400 rounded-lg text-[9px] font-bold text-fuchsia-200 transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                            title="Add Phenolphthalein indicator"
                        >
                            {t('quickAddPhenol', language)}
                        </button>
                        <button 
                            type="button"
                            onClick={() => clearContainer(selectedContainer.id)}
                            className="px-2 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 rounded-lg text-[9px] font-bold text-slate-300 transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                            title="Rinse/flush container"
                        >
                            {t('quickRinse', language)}
                        </button>
                    </div>
                </div>
            )}


            {/* Bottom Center Cyber Telemetry Ribbon */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#040c18]/90 backdrop-blur-xl border border-cyan-900/50 px-4 py-1.5 pointer-events-auto rounded-2xl shadow-2xl">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#071326] border border-cyan-950">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                        {t('sysOnline', language)}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#071326] border border-cyan-950">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                        {t('nodeLabel', language)}
                    </span>
                </div>

                <PerformanceHud />

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#071326] border border-cyan-950">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                        {t('vesselsCount', language)} <span className="text-cyan-300 font-bold">{containers.length}</span>
                    </span>
                </div>
            </div>

            {/* MODALS */}
            <MultimodalScannerModal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} />
            <LabReportModal isOpen={isReportOpen} onClose={() => setReportOpen(false)} />
            <GoogleProfileModal isOpen={isProfileOpen} onClose={() => setProfileOpen(false)} onUserUpdated={setGoogleUser} />
            <CurriculumLearningModal isOpen={isCurriculumOpen} onClose={() => setIsCurriculumOpen(false)} />
            <ReactionCodex isOpen={isCodexOpen} onClose={() => setIsCodexOpen(false)} />
            <LiveTitrationModal isOpen={isTitrationOpen} onClose={() => setIsTitrationOpen(false)} isVi={isVi} />
            <StoichiometryIceModal isOpen={isIceOpen} onClose={() => setIsIceOpen(false)} isVi={isVi} />
            <ReactionMechanismModal isOpen={isMechanismOpen} onClose={() => setIsMechanismOpen(false)} isVi={isVi} />
            <FlameSpectroscopyModal isOpen={isFlameOpen} onClose={() => setIsFlameOpen(false)} isVi={isVi} />
            <GalvanicCellModal isOpen={isGalvanicOpen} onClose={() => setIsGalvanicOpen(false)} isVi={isVi} />
            <ReactionKineticsModal isOpen={isKineticsOpen} onClose={() => setIsKineticsOpen(false)} isVi={isVi} />
            <VseprOrbitalModal isOpen={isVseprOpen} onClose={() => setIsVseprOpen(false)} isVi={isVi} />
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}

            {/* PAUSE MENU OVERLAY */}
            {isPaused && (
                <div className="fixed inset-0 z-[100] bg-[#02050c]/85 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-auto">
                    <div className="absolute bottom-6 left-6">
                        <LanguageToggle />
                    </div>
                    
                    <div className="text-center mb-10">
                        <h2 className="text-4xl md:text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 drop-shadow-[0_0_25px_rgba(34,211,238,0.6)] tracking-[0.3em] uppercase mb-2">
                            {t('simPaused', language)}
                        </h2>
                        <p className="text-sm font-mono text-cyan-400/80">
                            {t('simPausedDesc', language)}
                        </p>
                    </div>

                    <div className="flex flex-col gap-4 w-72">
                        <button 
                            onClick={() => { audioManager.playClick(); togglePause(); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl text-white transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] font-mono font-bold tracking-wider uppercase active:scale-95"
                        >
                            {t('btnResume', language)}
                        </button>

                        <button 
                            onClick={() => { audioManager.playClick(); togglePause(); setAppState('MENU'); }}
                            onMouseEnter={() => audioManager.playHover()}
                            className="w-full py-3.5 bg-slate-900/90 border border-slate-700 hover:border-rose-500/80 rounded-xl text-slate-300 hover:text-white transition-all font-mono font-bold tracking-wider uppercase active:scale-95"
                        >
                            {t('btnExitMenu', language)}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UIOverlay;
