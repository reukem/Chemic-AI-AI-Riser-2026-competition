/**
 * @file store.ts
 * @description The central Zustand state management architecture for the Chemic-AI Quantum Engine.
 * Houses the AAA Chaining Engine, Root Mean Square (RMS) color mixing algorithms, and Spatial Clamping data.
 */

import { create } from 'zustand';
import { CHEMICAL_REGISTRY, REACTION_RULES } from '../data/ChemicalRegistry';
import { evaluateThermodynamicState } from './ThermodynamicEngine';
import { audioManager } from './AudioManager';
import {
    hexToRgb,
    blendColorsRMS,
    recalculateContainerPH,
    evaluateDynamicReactions
} from './chemistry/ReactionKineticsEngine';

/**
 * Global game states. Controls UI rendering boundaries and asynchronous Audio API unlocking.
 */
export type AppState = 'MENU' | 'LOADING' | 'WORKBENCH';

/**
 * Represents a physical spatial container within the WebGL bounds.
 * Handles exact volume capacities, localized optical RGB mixing, and dynamic content dictionaries.
 * 
 * @interface Container
 * @property {number} id - Unique numeric identifier.
 * @property {'beaker' | 'flask'} type - The physical model to render.
 * @property {number} volume - Current fluid volume (0.0 to 100.0 mL).
 * @property {number} maxVol - Maximum capacity constraint. Overflow is blocked.
 * @property {{ r: number, g: number, b: number }} color - Exact computed Root Mean Square RGB color.
 * @property {Record<string, number>} contents - A live dictionary mapping Chemical IDs to their exact volumetric proportions.
 * @property {number} ph - Algorithmic pH approximation of the solution.
 * @property {number} x - The absolute Euclidean X coordinate of the container in the canvas.
 * @property {number} y - The absolute Euclidean Y coordinate of the container in the canvas.
 */
export interface Container {
    id: number;
    type: 'beaker' | 'flask';
    volume: number;
    maxVol: number;
    color: { r: number, g: number, b: number };
    contents: Record<string, number>;
    ph: number;
    x: number;
    y: number;
}

/**
 * Universally computed laboratory workbench table surface Y coordinate.
 * Raised to elevate the hotplate and vessels proudly above the bottom status bar.
 */
export const getTableBenchY = (): number => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    return Math.max(120, Math.round(vh * 0.68 - 270));
};

/**
 * The massive global simulation state strictly enforced by Zustand.
 * Triggers all React re-renders efficiently via targeted selector hooks.
 * 
 * @interface SimulationState
 */
interface SimulationState {
    customApiKey: string | null;
    setCustomApiKey: (key: string | null) => void;
    appState: AppState;
    setAppState: (state: AppState) => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    language: 'EN' | 'VN';
    setLanguage: (lang: 'EN' | 'VN') => void;
    env: { temp: number; pressure: number };
    containers: Container[];
    activeEffect: 'bubbles' | 'smoke' | 'fire' | 'explosion' | 'fizz' | 'cloud' | null;
    activeEffectContainerId: number | null;
    explosions: { id: number, x: number, y: number, type: string }[];

    // Pause State (Spatial Clamping)
    isPaused: boolean;
    togglePause: () => void;
    setPause: (status: boolean) => void;

    // Socratic Challenge Mode (VN UI)
    isSocraticModeActive: boolean;
    setSocraticMode: (active: boolean) => void;

    // Green Learning Mode (VN UI)
    isLearningModeActive: boolean;
    setLearningMode: (active: boolean) => void;

    // Organic Chemistry Mode (Wordle Puzzle)
    isOrganicModeActive: boolean;
    setOrganicMode: (active: boolean) => void;

    // Calculating Mode (Formula Sheet & Grade 8-12 Calculations)
    isCalculatingModeActive: boolean;
    setCalculatingMode: (active: boolean) => void;

    // Easter Egg Menu States (Permanent until simulation restart/reset)
    isMenuCracked: boolean;
    setMenuCracked: (cracked: boolean) => void;
    menuEasterEggStage: number;
    setMenuEasterEggStage: (stage: number) => void;

    // Reaction Popup
    pendingReaction: any | null;
    resolvePendingReaction: () => void;

    // Educational Insight
    pendingEducationalReaction: any | null;
    resolveEducationalReaction: () => void;

    // Active Vessel Selection & Volumetric Dispensing
    selectedContainerId: number | null;
    setSelectedContainerId: (id: number | null) => void;
    draggingContainerId: number | null;
    setDraggingContainerId: (id: number | null) => void;
    dispenseVolume: number;
    setDispenseVolume: (vol: number) => void;

    // Titration Dropper / Burette & Continuous Molar Stoichiometry Logging
    titrationLogs: Record<number, Array<{ volume: number; ph: number; color: string; reagent: string; timestamp: number }>>;
    isTitrationModeActive: boolean;
    setTitrationModeActive: (active: boolean) => void;
    dispenseDrop: (containerId: number, reagentId: string, dropVolume?: number) => void;
    resetTitrationLog: (containerId: number) => void;

    // Actions
    initialize: () => void;
    setEnvTemp: (temp: number) => void;
    setEnvTemperature: (temp: number) => void;
    setEnvPressure: (pressure: number) => void;
    spawnContainer: (type: 'beaker' | 'flask', x?: number, y?: number) => void;
    clearContainer: (id: number) => void;
    removeContainer: (id: number) => void;
    addReagentToContainer: (containerId: number, reagentId: string, amount?: number) => void;
    pourContainer: (sourceId: number, targetId: number, heightDiff: number) => void;
    updateContainerPosition: (id: number, x: number, y: number) => void;
    triggerExplosion: (x: number, y: number, type: string) => void;
    removeExplosion: (id: number) => void;
    flushAll: () => void;
    clearEffect: () => void;
}

/**
 * Instantiate the Zustand global store.
 */
export const useSimulationStore = create<SimulationState>((set, get) => ({
    customApiKey: null,
    setCustomApiKey: (key) => set({ customApiKey: key }),
    appState: 'MENU',
    setAppState: (appState) => set({ appState }),
    activeTab: 'lab',
    setActiveTab: (activeTab) => set({ activeTab }),
    language: 'EN',
    setLanguage: (language) => set({ language }),
    env: { temp: 25, pressure: 1.0 },
    containers: [],
    activeEffect: null,
    activeEffectContainerId: null,
    explosions: [],
    pendingReaction: null,
    pendingEducationalReaction: null,
    isPaused: false,
    
    // Socratic Challenge Mode
    isSocraticModeActive: false,
    setSocraticMode: (active: boolean) => set({ isSocraticModeActive: active }),

    // Green Learning Mode
    isLearningModeActive: false,
    setLearningMode: (active: boolean) => set({ isLearningModeActive: active }),

    // Organic Chemistry Mode (Wordle Puzzle)
    isOrganicModeActive: false,
    setOrganicMode: (active: boolean) => set({ isOrganicModeActive: active }),

    // Calculating Mode (Formula Sheet & Grade 8-12 Calculations)
    isCalculatingModeActive: false,
    setCalculatingMode: (active: boolean) => set({ isCalculatingModeActive: active }),

    // Easter Egg Menu States
    isMenuCracked: false,
    setMenuCracked: (isMenuCracked: boolean) => set({ isMenuCracked }),
    menuEasterEggStage: 0,
    setMenuEasterEggStage: (menuEasterEggStage: number) => set({ menuEasterEggStage }),

    // Active Vessel Selection & Volumetric Dispensing
    selectedContainerId: null,
    setSelectedContainerId: (id) => set({ selectedContainerId: id }),
    draggingContainerId: null,
    setDraggingContainerId: (id) => set({ draggingContainerId: id }),
    dispenseVolume: 20,
    setDispenseVolume: (dispenseVolume) => set({ dispenseVolume }),

    // Titration Dropper / Burette & Continuous Molar Stoichiometry Logging
    titrationLogs: {},
    isTitrationModeActive: false,
    setTitrationModeActive: (isTitrationModeActive: boolean) => set({ isTitrationModeActive }),
    dispenseDrop: (containerId: number, reagentId: string, dropVolume = 0.05) => {
        const state = get();
        state.addReagentToContainer(containerId, reagentId, dropVolume);
        try {
            audioManager.playDrop();
        } catch (_) {}

        const updated = get().containers.find(c => c.id === containerId);
        if (updated) {
            const currentLogs = state.titrationLogs[containerId] || [];
            const lastVol = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1].volume : 0;
            const nextPoint = {
                volume: +(lastVol + dropVolume).toFixed(2),
                ph: updated.ph,
                color: `rgb(${updated.color.r},${updated.color.g},${updated.color.b})`,
                reagent: reagentId,
                timestamp: Date.now()
            };
            set({
                titrationLogs: {
                    ...state.titrationLogs,
                    [containerId]: [...currentLogs, nextPoint]
                }
            });
        }
    },
    resetTitrationLog: (containerId: number) => {
        set(state => ({
            titrationLogs: {
                ...state.titrationLogs,
                [containerId]: []
            }
        }));
    },

    /**
     * Toggles the global Time-Stop parameter, instantaneously halting all WebGL Canvas motion.
     */
    togglePause: () => set(state => ({ isPaused: !state.isPaused })),
    setPause: (status: boolean) => set({ isPaused: status }),

    /**
     * Resumes the engine loop post-warning modal acknowledgment, discharging any stored VFX/Audio data.
     */
    resolvePendingReaction: () => {
        const state = get();
        const pending = state.pendingReaction;
        if (!pending) return;
        const effect = pending.effect;
        const containerId = pending.containerId;

        // Guaranteed immediate unmount of the modal dialog
        set({
            activeEffect: effect || null,
            activeEffectContainerId: containerId !== undefined ? containerId : null,
            pendingReaction: null
        });

        try {
            if (effect === 'explosion') {
                const c = state.containers.find(c => c.id === containerId);
                if (c) {
                    const r = pending.reactants || [];
                    const rxnType = r.includes('POTASSIUM') ? 'potassium'
                                  : r.includes('H2SO4') ? 'acid_dilution'
                                  : r.includes('SODIUM') ? 'sodium'
                                  : 'alkali_acid';
                    get().triggerExplosion(c.x + 70, c.y + 100, rxnType);
                }
            } else if (effect === 'fizz' || effect === 'bubbles' || effect === 'smoke') {
                audioManager.playSizzle();
            }
        } catch (err) {
            console.warn('VFX/Audio dispatch warning:', err);
        }

        if (effect) {
            setTimeout(() => {
                get().clearEffect();
            }, 4500);
        }
    },

    resolveEducationalReaction: () => {
        const state = get();
        const pending = state.pendingEducationalReaction;
        if (!pending) return;
        const effect = pending.effect;
        const containerId = pending.containerId;

        // Guaranteed immediate unmount of the modal dialog
        set({
            activeEffect: effect || null,
            activeEffectContainerId: containerId !== undefined ? containerId : null,
            pendingEducationalReaction: null
        });

        try {
            if (effect === 'explosion') {
                const c = state.containers.find(c => c.id === containerId);
                if (c) {
                    const r = pending.reactants || [];
                    const rxnType = r.includes('POTASSIUM') ? 'potassium'
                                  : r.includes('H2SO4') ? 'acid_dilution'
                                  : r.includes('SODIUM') ? 'sodium'
                                  : 'alkali_acid';
                    get().triggerExplosion(c.x + 70, c.y + 100, rxnType);
                }
            } else if (effect === 'fizz' || effect === 'bubbles') {
                audioManager.playEffervescence();
            } else if (effect === 'smoke' || effect === 'steam') {
                audioManager.playSteamHiss();
            } else if (effect === 'precipitate') {
                audioManager.playCrystalPrecipitate();
            } else {
                audioManager.playSizzle();
            }
        } catch (err) {
            console.warn('VFX/Audio dispatch warning:', err);
        }

        if (effect) {
            setTimeout(() => {
                 get().clearEffect();
            }, 4500);
        }
    },

    triggerExplosion: (x, y, type) => {
        set(state => ({
            explosions: [...state.explosions, { id: Date.now() + Math.random(), x, y, type }]
        }));
    },

    removeExplosion: (id) => {
        set(state => ({
            explosions: state.explosions.filter(e => e.id !== id)
        }));
    },

    initialize: () => {
        set({ containers: [], env: { temp: 25, pressure: 1.0 }, isPaused: false, selectedContainerId: null, dispenseVolume: 20 });
        const initX = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.45) : 580;
        get().spawnContainer('beaker', initX, getTableBenchY());
    },

    setEnvTemp: (temp: number) => {
        set((state) => ({ env: { ...state.env, temp } }));
        const state = get();
        const containers = [...state.containers];
        let hasChanges = false;
        let triggeredReaction: any = null;
        let activeContainerId = 0;

        for (let i = 0; i < containers.length; i++) {
            const container = { ...containers[i] };
            if (container.volume > 0 && container.contents) {
                // 1. Direct thermal cleavage of COPPER_POLYOL_COMPLEX into brick-red Cu2O precipitate at >= 60°C
                if ((container.contents['COPPER_POLYOL_COMPLEX'] || 0) > 0.001 && temp >= 60) {
                    const cVol = container.contents['COPPER_POLYOL_COMPLEX'];
                    delete container.contents['COPPER_POLYOL_COMPLEX'];
                    container.contents['Cu2O_PRECIPITATE'] = (container.contents['Cu2O_PRECIPITATE'] || 0) + +(cVol * 0.7).toFixed(4);
                    container.contents['DISTILLED_WATER'] = (container.contents['DISTILLED_WATER'] || 0) + +(cVol * 0.3).toFixed(4);
                    container.color = hexToRgb('#b91c1c');
                    recalculateContainerPH(container);
                    containers[i] = container;
                    hasChanges = true;
                    triggeredReaction = {
                        reactants: ['GLUCOSE', 'CuOH2_PRECIPITATE'],
                        product: 'Cu2O_PRECIPITATE',
                        products: ['Cu2O_PRECIPITATE', 'DISTILLED_WATER'],
                        equation: {
                            EN: '[Cu(C₆H₁₁O₆)₂] -(t° ≥ 60°C)-> Cu₂O ↓ (Dense Brick-Red) + oxidized sugar',
                            VN: '[Cu(C₆H₁₁O₆)₂] -(t° ≥ 60°C)-> Cu₂O ↓ (Kết Tủa Đỏ Gạch) + đường bị oxi hóa'
                        },
                        reactionType: {
                            EN: 'Fehling Reduction / Copper-Polyol Cleavage',
                            VN: 'Nhiệt Phân Khử Phức Đồng-Glucozơ Thành Cu₂O Đỏ Gạch'
                        },
                        mechanism: {
                            EN: 'Under heat (≥ 60°C), the open-chain form of glucose reduces Cu²⁺ in the complex to brick-red insoluble cuprous oxide (Cu₂O) precipitate.',
                            VN: 'Khi đun nóng (≥ 60°C), nhóm anđehit của glucozơ khử ion Cu²⁺ trong phức chất tạo kết tủa Cu₂O đỏ gạch.'
                        },
                        message: {
                            EN: 'Thermal Activation! Glucose-copper complex decomposes upon heating to form dense brick-red Cu₂O precipitate!',
                            VN: 'Nhiệt kích hoạt thành công! Phức đồng-glucozơ bị đun nóng chuyển hóa hoàn toàn thành kết tủa Cu₂O đỏ gạch!'
                        },
                        effect: 'precipitate',
                        productColor: '#b91c1c',
                        precipitateColor: '#b91c1c',
                        temperatureSpike: 15,
                        requiresPopup: true,
                        hazardLevel: 'SAFE'
                    };
                    activeContainerId = container.id;
                    break;
                }

                // 2. Scan for thermal activation reactions where minTemperature <= temp
                const keys = Object.keys(container.contents).filter(k => (container.contents[k] || 0) > 0.001);
                if (keys.length >= 2) {
                    const reaction = evaluateDynamicReactions(container, keys, temp);
                    if (reaction) {
                        recalculateContainerPH(container);
                        containers[i] = container;
                        hasChanges = true;
                        triggeredReaction = reaction;
                        activeContainerId = container.id;
                        break;
                    }
                }
            }
        }

        if (hasChanges) {
            if (triggeredReaction && triggeredReaction.requiresPopup) {
                set({
                    containers,
                    selectedContainerId: activeContainerId,
                    pendingReaction: {
                        ...triggeredReaction,
                        currentTemp: temp,
                        containerId: activeContainerId,
                        reactionType: triggeredReaction.reactionType || { EN: 'Thermal Reaction', VN: 'Phản Ứng Nhiệt Hóa' },
                        equation: triggeredReaction.equation || { EN: 'Thermal Reaction -(t°)-> Products', VN: 'Phản Ứng Nhiệt -(t°)-> Sản phẩm' },
                        mechanism: triggeredReaction.mechanism || triggeredReaction.message
                    }
                });
            } else if (triggeredReaction) {
                set({
                    containers,
                    selectedContainerId: activeContainerId,
                    pendingEducationalReaction: {
                        ...triggeredReaction,
                        currentTemp: temp,
                        containerId: activeContainerId
                    }
                });
            } else {
                set({ containers });
            }
        }
    },
    setEnvTemperature: (temp: number) => get().setEnvTemp(temp),
    setEnvPressure: (pressure: number) => set((state) => ({ env: { ...state.env, pressure } })),

    spawnContainer: (type: 'beaker' | 'flask', x?: number, y?: number) => {
        const state = get();
        if (state.containers.length >= 4) {
            console.log("Max containers reached!");
            return;
        }
        const newId = state.containers.length > 0 ? Math.max(...state.containers.map(c => c.id)) + 1 : 0;
        
        const tableY = getTableBenchY();
        const centerX = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.45) : 580;
        const defaultSlots = [centerX, centerX + 220, centerX - 220, centerX + 440];
        const startX = x ?? (defaultSlots[state.containers.length % defaultSlots.length] || centerX);
        const startY = y ?? tableY; // Strictly seated on tabletop surface!

        const newContainer: Container = {
            id: newId,
            type,
            volume: 0,
            maxVol: 100,
            color: { r: 0, g: 0, b: 0 },
            contents: {},
            ph: 7,
            x: startX,
            y: startY
        };
        set({ 
            containers: [...state.containers, newContainer],
            selectedContainerId: newId 
        });
        audioManager.playGlassClink();
    },

    clearContainer: (id: number) => {
        set((state) => ({
            containers: state.containers.map(c => c.id === id ? {
                ...c,
                volume: 0,
                color: { r: 0, g: 0, b: 0 },
                contents: {},
                ph: 7.0
            } : c)
        }));
    },

    removeContainer: (id: number) => {
        set((state) => {
            const nextContainers = state.containers.filter(c => c.id !== id);
            const nextSelected = state.selectedContainerId === id
                ? (nextContainers.length > 0 ? nextContainers[0].id : null)
                : state.selectedContainerId;
            return {
                containers: nextContainers,
                selectedContainerId: nextSelected
            };
        });
    },

    updateContainerPosition: (id: number, x: number, y: number) => {
        set((state) => ({
            containers: state.containers.map(c => c.id === id ? { ...c, x, y } : c)
        }));
    },

    /**
     * Physics event: Fires when the user executes a drag-and-drop or clicks a reagent card onto a target vessel.
     * Evaluates volume limits, triggers RMS blending, and runs the evaluation engine.
     * @param {number} containerId - The target container.
     * @param {string} reagentId - The dropped chemical.
     * @param {number} [amount] - Optional custom volume to dispense (defaults to state.dispenseVolume || 20).
     */
    addReagentToContainer: (containerId: number, reagentId: string, amount?: number) => {
        const state = get();
        const reagent = CHEMICAL_REGISTRY[reagentId];
        if (!reagent) return;

        const containers = [...state.containers];
        const containerIndex = containers.findIndex(c => c.id === containerId);
        if (containerIndex === -1) return;

        const container = { ...containers[containerIndex] } as Container;

        // Inert Sludge Protection Check
        if (container.contents['ENTROPY_SLUDGE'] > 0) return; // Prevent any additions

        const addVol = amount ?? state.dispenseVolume ?? 20;

        if (container.volume >= container.maxVol) {
            console.log("Container is FULL!");
            return;
        }

        const rColor = hexToRgb(reagent.color);

        // Optical Color Mixing (RMS Physics)
        if (container.volume === 0) {
            container.color = { ...rColor };
        } else {
            container.color = blendColorsRMS(container.color, container.volume, rColor, addVol);
        }

        container.volume += addVol;
        container.contents = { ...container.contents, [reagentId]: (container.contents[reagentId] || 0) + addVol };
        audioManager.playLiquidPour();

        // Recalculate pH based on initial addition
        recalculateContainerPH(container);

        const currentTemp = get().env?.temp ?? 25;
        const triggeredReaction = evaluateDynamicReactions(container, [reagentId], currentTemp);
        // Re-evaluate container pH if products were formed/reactants consumed
        if (triggeredReaction) {
            recalculateContainerPH(container);
        }
        containers[containerIndex] = container;

        if (triggeredReaction && triggeredReaction.requiresPopup) {
            set({
                containers,
                selectedContainerId: containerId,
                pendingReaction: {
                    ...triggeredReaction,
                    containerId
                }
            });
        } else if (triggeredReaction) {
            const r0 = triggeredReaction.reactants?.[0] || '';
            const r1 = triggeredReaction.reactants?.[1] || '';
            const rxnId = triggeredReaction.reactants ? `rxn_${r0}_${r1}` : `rxn_class_${triggeredReaction.product}`;
            const altRxnId = triggeredReaction.reactants ? `rxn_${r1}_${r0}` : '';
            const classRxnId = `rxn_class_${triggeredReaction.product}`;

            let isMuted = false;
            try {
                const muted = JSON.parse(localStorage.getItem('chemic_ai_muted_reactions') || '[]');
                if (muted.includes(rxnId) || (altRxnId && muted.includes(altRxnId)) || muted.includes(classRxnId)) {
                    isMuted = true;
                }
            } catch (_) {}

            if (!isMuted) {
                set({
                    containers,
                    selectedContainerId: containerId,
                    pendingEducationalReaction: {
                        ...triggeredReaction,
                        containerId,
                        rxnId
                    }
                });
            } else {
                set({ containers, selectedContainerId: containerId });
            }
        } else {
            set({ containers, selectedContainerId: containerId });
        }
    },

    /**
     * Physics event: Fires when the user clicks and drags one valid container onto another.
     * Evaluates spatial distance constraints and incrementally transfers proportional volumetric data matrices.
     * @param {number} sourceId - Container transferring fluid.
     * @param {number} targetId - Container receiving fluid.
     * @param {number} heightDiff - Vertical Euclidean coordinate drop delta (used for splash physics).
     */
    pourContainer: (sourceId: number, targetId: number, heightDiff: number) => {
        const state = get();
        const containers = [...state.containers];

        const sourceIdx = containers.findIndex(c => c.id === sourceId);
        const targetIdx = containers.findIndex(c => c.id === targetId);

        if (sourceIdx === -1 || targetIdx === -1) return;

        const source = { ...containers[sourceIdx], contents: { ...containers[sourceIdx].contents } };
        const target = { ...containers[targetIdx], contents: { ...containers[targetIdx].contents } };

        if (source.volume <= 0) return;
        if (target.volume >= target.maxVol) return;
        if (target.contents['ENTROPY_SLUDGE'] > 0) return; // Prevent pour target if dead

        // Thermodynamic freezing check: cannot pour if frozen solid!
        const sourceThermo = evaluateThermodynamicState(source, state.env);
        if (sourceThermo.isFrozen) {
            console.warn("Cannot pour: substance is frozen solid!");
            return;
        }

        const safeHeight = Math.max(0, Math.min(heightDiff, 500));
        const pourRate = 1 + (safeHeight / 500) * 5;

        const availableSpace = target.maxVol - target.volume;
        const actualPour = Math.min(pourRate, source.volume, availableSpace);

        if (actualPour <= 0) return;

        // Optical Color Mixing (RMS)
        if (target.volume === 0) {
            target.color = { ...source.color };
        } else {
            target.color = blendColorsRMS(target.color, target.volume, source.color, actualPour);
        }

        for (const [chemId, vol] of Object.entries(source.contents)) {
            const ratio = vol / source.volume;
            const transferredVol = ratio * actualPour;

            source.contents[chemId] -= transferredVol;
            if (source.contents[chemId] <= 0.01) delete source.contents[chemId];

            target.contents[chemId] = (target.contents[chemId] || 0) + transferredVol;
        }

        source.volume -= actualPour;
        target.volume += actualPour;
        if (Math.random() < 0.25) {
            audioManager.playLiquidPour();
        }

        // Recalculate pH of both vessels
        recalculateContainerPH(source);
        recalculateContainerPH(target);

        const currentTemp = get().env?.temp ?? 25;
        const triggeredReaction = evaluateDynamicReactions(target, Object.keys(source.contents), currentTemp);
        if (triggeredReaction) {
            recalculateContainerPH(target);
        }

        containers[sourceIdx] = source;
        containers[targetIdx] = target;

        if (triggeredReaction && triggeredReaction.requiresPopup) {
            set({
                containers,
                pendingReaction: {
                    ...triggeredReaction,
                    containerId: targetId
                }
            });
        } else if (triggeredReaction) {
            const rxnId = triggeredReaction.reactants ? `rxn_${triggeredReaction.reactants[0]}_${triggeredReaction.reactants[1]}` : `rxn_class_${triggeredReaction.product}`;
            set({
                containers,
                pendingEducationalReaction: {
                    ...triggeredReaction,
                    containerId: targetId,
                    rxnId
                }
            });
        } else {
            let newEffect = (safeHeight > 250) ? 'fizz' : null;

            set({
                containers,
                ...(newEffect && { activeEffect: newEffect, activeEffectContainerId: targetId })
            });

            if (newEffect) {
                setTimeout(() => get().clearEffect(), 300);
            }
        }
    },

    flushAll: () => {
        set({ containers: [], activeEffect: null, activeEffectContainerId: null, selectedContainerId: null, titrationLogs: {} });
    },

    clearEffect: () => set({ activeEffect: null, activeEffectContainerId: null })
}));
