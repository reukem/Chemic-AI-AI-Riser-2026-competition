/**
 * @file store.ts
 * @description The central Zustand state management architecture for the Chemic-AI Quantum Engine.
 * Houses the AAA Chaining Engine, Root Mean Square (RMS) color mixing algorithms, and Spatial Clamping data.
 */

import { create } from 'zustand';
import { CHEMICAL_REGISTRY, REACTION_RULES } from '../data/ChemicalRegistry';
import { evaluateThermodynamicState } from './ThermodynamicEngine';
import { audioManager } from './AudioManager';

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
 * Highly optimized utility to parse exact Hexadecimal strings into RGB channels for the math engine.
 * @param {string} hex - The hex string (e.g., '#3b82f6').
 * @returns {{r:number, g:number, b:number}} RGB map.
 */
const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

/**
 * Root Mean Square (RMS) Color Blending Algorithm.
 * Applies true physical photon absorption interpolation rather than basic arithmetic averages.
 * This guarantees that mixing Yellow and Blue outputs a physically authentic Green hue based on volumetric weights.
 * 
 * @param {Object} c1 - Current RGB color of the container.
 * @param {number} v1 - Current volume of the container.
 * @param {Object} c2 - RGB color of the incoming poured/dropped fluid.
 * @param {number} v2 - Added volume.
 * @returns {{r:number, g:number, b:number}} The newly calculated physical color.
 */
const blendColorsRMS = (c1: {r:number, g:number, b:number}, v1: number, c2: {r:number, g:number, b:number}, v2: number) => {
    const tVol = v1 + v2;
    if (tVol <= 0) return { r: 0, g: 0, b: 0 };
    return {
        r: Math.round(Math.sqrt((c1.r * c1.r * v1 + c2.r * c2.r * v2) / tVol)),
        g: Math.round(Math.sqrt((c1.g * c1.g * v1 + c2.g * c2.g * v2) / tVol)),
        b: Math.round(Math.sqrt((c1.b * c1.b * v1 + c2.b * c2.b * v2) / tVol))
    };
};

/**
 * Calculates exact stoichiometric molar ratios & concentrations for authentic Limiting Reactant kinetics.
 */
interface StoichiometricRatio {
    coef0: number;
    coef1: number;
    conc0: number; // mol / L
    conc1: number; // mol / L
}

const getReactionStoichiometry = (r0: string, r1: string): StoichiometricRatio => {
    const chem0 = CHEMICAL_REGISTRY[r0];
    const chem1 = CHEMICAL_REGISTRY[r1];

    // Standard aqueous solution concentration is 0.1 M, or concentrated if flagged
    let conc0 = 0.1;
    let conc1 = 0.1;
    if (r0.includes('H2SO4') && chem0?.description?.EN?.toLowerCase().includes('concentrated')) conc0 = 18.0;
    else if (r0.includes('HCl') && chem0?.description?.EN?.toLowerCase().includes('concentrated')) conc0 = 12.0;
    else if (chem0?.category === 'element' || chem0?.type === 'solid') conc0 = 1.0;

    if (r1.includes('H2SO4') && chem1?.description?.EN?.toLowerCase().includes('concentrated')) conc1 = 18.0;
    else if (r1.includes('HCl') && chem1?.description?.EN?.toLowerCase().includes('concentrated')) conc1 = 12.0;
    else if (chem1?.category === 'element' || chem1?.type === 'solid') conc1 = 1.0;

    // Stoichiometric coefficients: coef0 * R0 + coef1 * R1 -> products
    let coef0 = 1;
    let coef1 = 1;

    // Diprotic acid H2SO4 with monobases (NaOH, KOH)
    if (r0 === 'H2SO4' && (r1 === 'NaOH' || r1 === 'KOH')) {
        coef0 = 1; coef1 = 2;
    } else if ((r0 === 'NaOH' || r0 === 'KOH') && r1 === 'H2SO4') {
        coef0 = 2; coef1 = 1;
    }
    // Carbonate + Acid: Na2CO3 + 2HCl -> 2NaCl + H2O + CO2
    else if ((r0 === 'Na2CO3' || r0 === 'CaCO3') && (r1 === 'HCl' || r1 === 'HNO3')) {
        coef0 = 1; coef1 = 2;
    } else if ((r1 === 'Na2CO3' || r1 === 'CaCO3') && (r0 === 'HCl' || r0 === 'HNO3')) {
        coef0 = 2; coef1 = 1;
    }
    // Active Metal (Mg, Fe, Zn) + 2HCl -> MCl2 + H2
    else if ((r0 === 'MAGNESIUM' || r0 === 'ZINC' || r0 === 'IRON') && (r1 === 'HCl' || r1 === 'HNO3')) {
        coef0 = 1; coef1 = 2;
    } else if ((r1 === 'MAGNESIUM' || r1 === 'ZINC' || r1 === 'IRON') && (r0 === 'HCl' || r0 === 'HNO3')) {
        coef0 = 2; coef1 = 1;
    }
    // Aluminum: 2Al + 6HCl -> 2AlCl3 + 3H2 (1:3 ratio)
    else if (r0 === 'ALUMINUM' && (r1 === 'HCl' || r1 === 'HNO3')) {
        coef0 = 1; coef1 = 3;
    } else if (r1 === 'ALUMINUM' && (r0 === 'HCl' || r0 === 'HNO3')) {
        coef0 = 3; coef1 = 1;
    }
    // Transition metal precipitation: CuSO4 + 2NaOH -> Cu(OH)2 + Na2SO4
    else if (r0 === 'CuSO4' && (r1 === 'NaOH' || r1 === 'KOH')) {
        coef0 = 1; coef1 = 2;
    } else if ((r0 === 'NaOH' || r0 === 'KOH') && r1 === 'CuSO4') {
        coef0 = 2; coef1 = 1;
    }

    return { coef0, coef1, conc0, conc1 };
};

/**
 * Scientifically recalculates a container's aqueous pH based on hydrogen/hydroxide ion equilibrium
 * across all dissolved acids, bases, and neutral salts, and shifts indicator colors dynamically.
 */
const recalculateContainerPH = (container: Container) => {
    let totalMolesH = 0;
    let totalMolesOH = 0;
    let totalVol = 0;
    let hasPhenolphthalein = false;
    let hasMethylOrange = false;
    let hasUniversalIndicator = false;

    for (const [id, vol] of Object.entries(container.contents)) {
        if (id.startsWith('reacted_') || vol <= 0) continue;
        if (id === 'PHENOLPHTHALEIN') { hasPhenolphthalein = true; continue; }
        if (id === 'METHYL_ORANGE') { hasMethylOrange = true; continue; }
        if (id === 'UNIVERSAL_INDICATOR') { hasUniversalIndicator = true; continue; }

        const rg = CHEMICAL_REGISTRY[id];
        if (!rg) continue;
        totalVol += vol;

        if (rg.reactionClass === 'strong_acid') {
            const hFactor = id === 'H2SO4' ? 2 : 1;
            totalMolesH += 0.1 * hFactor * (vol / 1000);
        } else if (rg.reactionClass === 'weak_acid' || rg.reactionClass === 'carboxylic_acid') {
            const c = 0.1;
            const hConc = Math.sqrt(1.75e-5 * c); // Ka = 1.75e-5
            totalMolesH += hConc * (vol / 1000);
        } else if (rg.reactionClass === 'strong_base') {
            const ohFactor = id === 'BaOH2' ? 2 : 1;
            totalMolesOH += 0.1 * ohFactor * (vol / 1000);
        } else if (rg.reactionClass === 'weak_base') {
            const c = 0.1;
            const ohConc = Math.sqrt(1.8e-5 * c);
            totalMolesOH += ohConc * (vol / 1000);
        } else if (rg.ph < 7) {
            totalMolesH += Math.pow(10, -rg.ph) * (vol / 1000);
        } else if (rg.ph > 7) {
            totalMolesOH += Math.pow(10, -(14 - rg.ph)) * (vol / 1000);
        } else {
            totalMolesH += 1e-7 * (vol / 1000);
            totalMolesOH += 1e-7 * (vol / 1000);
        }
    }
    
    if (totalVol > 0) {
        const liters = totalVol / 1000;
        if (totalMolesH > totalMolesOH) {
            const excessH = totalMolesH - totalMolesOH;
            const excessHConc = excessH / liters;
            container.ph = Math.max(0, Math.min(14, +(-Math.log10(Math.max(1e-14, excessHConc))).toFixed(2)));
        } else if (totalMolesOH > totalMolesH) {
            const excessOH = totalMolesOH - totalMolesH;
            const excessOHConc = excessOH / liters;
            const pOH = -Math.log10(Math.max(1e-14, excessOHConc));
            container.ph = Math.max(0, Math.min(14, +(14 - pOH).toFixed(2)));
        } else {
            container.ph = 7.0;
        }
    } else {
        container.ph = 7.0;
    }

    // Dynamic Indicator Color Transformations during Titration & pH Measurement
    if (hasUniversalIndicator) {
        if (container.ph < 3.0) {
            container.color = hexToRgb('#ef4444'); // Crimson Red (pH 1-3)
        } else if (container.ph < 5.0) {
            container.color = hexToRgb('#f97316'); // Vibrant Orange (pH 3-5)
        } else if (container.ph < 6.5) {
            container.color = hexToRgb('#eab308'); // Amber Yellow (pH 5-6.5)
        } else if (container.ph <= 7.5) {
            container.color = hexToRgb('#22c55e'); // Neutral Emerald Green (pH 6.5-7.5)
        } else if (container.ph <= 9.5) {
            container.color = hexToRgb('#06b6d4'); // Teal Cyan (pH 7.5-9.5)
        } else if (container.ph <= 11.5) {
            container.color = hexToRgb('#3b82f6'); // Royal Blue (pH 9.5-11.5)
        } else {
            container.color = hexToRgb('#7c3aed'); // Deep Alkaline Violet (pH > 11.5)
        }
    } else if (hasPhenolphthalein) {
        if (container.ph >= 8.2) {
            container.color = hexToRgb('#f43f5e'); // Vibrant magenta pink endpoint!
        } else {
            container.color = hexToRgb('#e0f2fe'); // Crystal clear lactone
        }
    } else if (hasMethylOrange) {
        if (container.ph <= 3.1) {
            container.color = hexToRgb('#ef4444'); // Red
        } else if (container.ph >= 4.4) {
            container.color = hexToRgb('#f59e0b'); // Yellow
        } else {
            container.color = hexToRgb('#f97316'); // Orange transition
        }
    }
};

/**
 * The core Chaining Engine algorithm. Scans a container's contents array and evaluates thermodynamic rules.
 * Automatically checks strict explicit combinations first, then falls back to generic Class-Based taxonomy logic.
 * Also scans for the Thermodynamic Sludge state to prevent infinite loops.
 * 
 * @param {Container} container - The container entity being modified.
 * @returns {any} The triggered reaction payload, or null if totally inert.
 */
const evaluateDynamicReactions = (container: Container, incomingReagents: string[] = [], currentTemp: number = 25) => {
    // 0. The Thermodynamic Death State (NO FURTHER REACTIONS)
    if (container.contents['ENTROPY_SLUDGE'] > 0) {
        return null; // Totally inert
    }

    // 0.5. Multi-Class Entropy Collapse:
    // When 4 or more distinct non-solvent chemical classes accumulate in the vessel,
    // the system undergoes catastrophic thermodynamic collapse into inert ENTROPY_SLUDGE!
    const nonSolventClasses = new Set<string>();
    for (const [key, val] of Object.entries(container.contents)) {
        if (!key.startsWith('reacted_') && val > 0) {
            const rClass = CHEMICAL_REGISTRY[key]?.reactionClass;
            if (rClass && rClass !== 'solvent') nonSolventClasses.add(rClass);
        }
    }
    if (nonSolventClasses.size >= 4) {
        container.contents = { ENTROPY_SLUDGE: container.volume };
        container.color = hexToRgb(CHEMICAL_REGISTRY.ENTROPY_SLUDGE?.color || '#4a3b32');
        container.ph = 7.0;
        return {
            reactants: ['UNKNOWN', 'UNKNOWN'],
            product: 'ENTROPY_SLUDGE',
            reactionType: {
                EN: 'Thermodynamic Death State (Entropy Sludge)',
                VN: 'Sụp Đổ Nhiệt Động (Bùn Entropy)'
            },
            equation: {
                EN: 'Multi-reagent chaotic collapse → Inert Sludge (ΔS > 0)',
                VN: 'Hỗn hợp hỗn loạn sụp đổ → Bùn trơ hóa học'
            },
            message: {
                EN: 'Thermodynamic death state reached! Chaotic chemical collapse. Sludge formed.',
                VN: 'Thermodynamic death state reached! Đạt trạng thái sụp đổ hóa học! Hoàn toàn trơ.'
            },
            effect: 'smoke',
            requiresPopup: true,
            temperatureSpike: 0,
            hazardLevel: 'WARNING'
        };
    }

    let triggeredReaction: any = null;

    // 1. Explicit Hardcoded Logic (Highest Priority)
    for (const rule of REACTION_RULES) {
        // Temperature constraints check (e.g. heated Fehling reaction >= 60°C)
        if (rule.minTemperature !== undefined && currentTemp < rule.minTemperature) continue;
        if (rule.maxTemperature !== undefined && currentTemp > rule.maxTemperature) continue;

        const r0 = rule.reactants[0];
        const r1 = rule.reactants[1];
        
        if (rule.orderMatters) {
            // Only triggers if both present in positive stoichiometric quantity
            if ((container.contents[r0] || 0) > 0.001 && (container.contents[r1] || 0) > 0.001) {
                if (incomingReagents.includes(r1) && !incomingReagents.includes(r0)) {
                    triggeredReaction = rule;
                    break;
                }
            }
        } else {
            if ((container.contents[r0] || 0) > 0.001 && (container.contents[r1] || 0) > 0.001) {
                triggeredReaction = rule;
                break;
            }
        }
    }

    // 2. Class-Based Fallback Engine (Scientific Multi-Class Routing)
    if (!triggeredReaction) {
        const presentClasses = Array.from(new Set(
            Object.keys(container.contents)
                .filter(id => !id.startsWith('reacted_') && container.contents[id] > 0)
                .map(id => CHEMICAL_REGISTRY[id]?.reactionClass)
        ));

        const incomingClasses = incomingReagents.map(id => CHEMICAL_REGISTRY[id]?.reactionClass);
        const currentClasses = Object.keys(container.contents)
            .filter(id => !id.startsWith('reacted_') && !incomingReagents.includes(id) && container.contents[id] > 0)
            .map(id => CHEMICAL_REGISTRY[id]?.reactionClass);

        // Generic Neutralization (Strong Acid + Base)
        if (presentClasses.includes('strong_acid') && (presentClasses.includes('strong_base') || presentClasses.includes('weak_base'))) {
            const acid = Object.keys(container.contents).find(id => CHEMICAL_REGISTRY[id]?.reactionClass === 'strong_acid' && container.contents[id] > 0.001) || 'HCl';
            const base = Object.keys(container.contents).find(id => (CHEMICAL_REGISTRY[id]?.reactionClass === 'strong_base' || CHEMICAL_REGISTRY[id]?.reactionClass === 'weak_base') && container.contents[id] > 0.001) || 'NaOH';
            if ((container.contents[acid] || 0) > 0.001 && (container.contents[base] || 0) > 0.001) {
                triggeredReaction = {
                    reactants: [acid, base],
                    product: 'SALT_WATER',
                    products: ['SALT_WATER'],
                    equation: {
                        EN: 'H⁺ (aq) + OH⁻ (aq) → H₂O (l) (Exothermic Neutralization)',
                        VN: 'H⁺ (dd) + OH⁻ (dd) → H₂O (l) (Phản Ứng Trung Hòa Tỏa Nhiệt)'
                    },
                    reactionType: {
                        EN: 'Acid-Base Neutralization',
                        VN: 'Phản Ứng Trung Hòa Axit - Bazơ'
                    },
                    mechanism: {
                        EN: 'Hydronium and hydroxide ions neutralize each other to produce liquid water and soluble spectator ions.',
                        VN: 'Ion H⁺ và OH⁻ trung hòa lẫn nhau tạo ra nước và dung dịch muối trung tính.'
                    },
                    message: { EN: 'Neutralization reaction: Acid + Base neutralizes to form Salt and Water.', VN: 'Phản ứng trung hòa: Axit + Bazơ tạo thành Muối và Nước.' },
                    effect: 'bubbles',
                    temperatureSpike: 15
                };
            }
        }
        // Alkali Metal + Strong Acid (Li, Na, K + HCl, HNO3, H2SO4) -> Violent Detonation / Critical Hazard!
        else if (presentClasses.includes('alkali_metal') && presentClasses.includes('strong_acid')) {
            const metal = Object.keys(container.contents).find(id => CHEMICAL_REGISTRY[id]?.reactionClass === 'alkali_metal' && container.contents[id] > 0.001) || 'LITHIUM';
            const acid = Object.keys(container.contents).find(id => CHEMICAL_REGISTRY[id]?.reactionClass === 'strong_acid' && container.contents[id] > 0.001) || 'HNO3';
            if ((container.contents[metal] || 0) > 0.001 && (container.contents[acid] || 0) > 0.001) {
                triggeredReaction = {
                    reactants: [metal, acid],
                    product: 'SALT_WATER',
                    products: ['SALT_WATER', 'HYDROGEN_GAS'],
                    equation: {
                        EN: '2M (s) + 2H⁺ (aq) → 2M⁺ (aq) + H₂ (g) ↑ (Violent Exothermic Detonation)',
                        VN: '2M (r) + 2H⁺ (dd) → 2M⁺ (dd) + H₂ (k) ↑ (Phản Ứng Phát Nổ Mãnh Liệt)'
                    },
                    reactionType: {
                        EN: 'Alkali Metal + Strong Acid Explosion',
                        VN: 'Nổ Kim Loại Kiềm & Axit Mạnh'
                    },
                    mechanism: {
                        EN: 'Alkali metals react violently with strong acids due to extreme reduction potential difference and instantaneous proton reduction, causing rapid thermal detonation.',
                        VN: 'Kim loại kiềm khử ion H⁺ cực nhanh giải phóng nhiệt lượng khổng lồ và khí Hydro gây nổ tức thì.'
                    },
                    message: {
                        EN: 'CRITICAL LAB HAZARD: Alkali metal in strong acid causes instant explosive hydrogen detonation!',
                        VN: 'NGUY HIỂM CỰC ĐỘ: Kim loại kiềm gặp axit mạnh gây nổ khí hydro tức thì!'
                    },
                    effect: 'explosion',
                    requiresPopup: true,
                    temperatureSpike: 150,
                    hazardLevel: 'CRITICAL'
                };
            }
        }
        // Active Metal + Acid (Mg, Zn, Fe, etc.) -> Metal Salt + H2 gas bubbles
        else if ((presentClasses.includes('alkaline_earth_metal') || presentClasses.includes('transition_metal')) && presentClasses.includes('strong_acid')) {
            const metal = Object.keys(container.contents).find(id => (CHEMICAL_REGISTRY[id]?.reactionClass === 'alkaline_earth_metal' || CHEMICAL_REGISTRY[id]?.reactionClass === 'transition_metal') && container.contents[id] > 0.001) || 'MAGNESIUM';
            const acid = Object.keys(container.contents).find(id => CHEMICAL_REGISTRY[id]?.reactionClass === 'strong_acid' && container.contents[id] > 0.001) || 'HCl';
            if ((container.contents[metal] || 0) > 0.001 && (container.contents[acid] || 0) > 0.001) {
                triggeredReaction = {
                    reactants: [metal, acid],
                    product: 'SALT_WATER',
                    products: ['SALT_WATER', 'HYDROGEN_GAS'],
                    equation: {
                        EN: 'M (s) + 2H⁺ (aq) → M²⁺ (aq) + H₂ (g) ↑',
                        VN: 'M (r) + 2H⁺ (dd) → M²⁺ (dd) + H₂ (k) ↑'
                    },
                    reactionType: {
                        EN: 'Active Metal Single Displacement',
                        VN: 'Kim Loại Đẩy Hydro Ra Khỏi Axit'
                    },
                    mechanism: {
                        EN: 'Active metal is oxidized by acid protons, releasing hydrogen gas effervescence and dissolving into a soluble salt.',
                        VN: 'Kim loại hoạt động bị oxi hóa bởi axit, giải phóng bọt khí hydro và tan thành muối.'
                    },
                    message: { EN: 'Metal Oxidation: Active metal reacts with acid, evolving Hydrogen gas (H₂) bubbles.', VN: 'Kim loại tác dụng axit: Giải phóng bọt khí Hydro (H₂) và tan dần.' },
                    effect: 'bubbles',
                    temperatureSpike: 20
                };
            }
        }
        // Carbonate + Acid -> Salt + H2O + CO2 effervescence
        else if (presentClasses.includes('carbonate') && (presentClasses.includes('strong_acid') || presentClasses.includes('weak_acid') || presentClasses.includes('carboxylic_acid'))) {
            const carb = Object.keys(container.contents).find(id => CHEMICAL_REGISTRY[id]?.reactionClass === 'carbonate' && container.contents[id] > 0.001) || 'Na2CO3';
            const acid = Object.keys(container.contents).find(id => (CHEMICAL_REGISTRY[id]?.reactionClass === 'strong_acid' || CHEMICAL_REGISTRY[id]?.reactionClass === 'weak_acid' || CHEMICAL_REGISTRY[id]?.reactionClass === 'carboxylic_acid') && container.contents[id] > 0.001) || 'HCl';
            if ((container.contents[carb] || 0) > 0.001 && (container.contents[acid] || 0) > 0.001) {
                triggeredReaction = {
                    reactants: [carb, acid],
                    product: 'SALT_WATER',
                    products: ['SALT_WATER', 'CARBON_DIOXIDE'],
                    equation: {
                        EN: 'CO₃²⁻ / HCO₃⁻ + H⁺ → H₂O (l) + CO₂ (g) ↑',
                        VN: 'CO₃²⁻ / HCO₃⁻ + H⁺ → H₂O (l) + CO₂ (k) ↑'
                    },
                    reactionType: {
                        EN: 'Carbonate Acidification & Effervescence',
                        VN: 'Axit Hóa Muối Cacbonat & Sủi Bọt CO₂'
                    },
                    mechanism: {
                        EN: 'Protons decompose carbonate/bicarbonate into unstable carbonic acid, liberating Carbon Dioxide gas bubbles.',
                        VN: 'Axit phân hủy muối cacbonat giải phóng bọt khí CO₂ mãnh liệt.'
                    },
                    message: { EN: 'Effervescence: Acid reacts with carbonate salt to liberate vigorous Carbon Dioxide (CO₂) gas bubbles.', VN: 'Sủi bọt khí: Axit tác dụng với muối cacbonat giải phóng khí CO₂ sủi bọt mạnh mẽ.' },
                    effect: 'bubbles',
                    temperatureSpike: 10
                };
            }
        }
        // Dangerous Acid Dilution Check
        else if (incomingClasses.includes('solvent') && currentClasses.includes('strong_acid') && incomingReagents.includes('DISTILLED_WATER')) {
            const acid = Object.keys(container.contents).find(id => CHEMICAL_REGISTRY[id]?.reactionClass === 'strong_acid' && !incomingReagents.includes(id) && container.contents[id] > 0.001) || 'H2SO4';
            if ((container.contents[acid] || 0) > 0.001 && (container.contents['DISTILLED_WATER'] || 0) > 0.001) {
                triggeredReaction = {
                    reactants: ['DISTILLED_WATER', acid],
                    product: acid,
                    products: [acid],
                    equation: {
                        EN: 'H₂O (added) + H₂SO₄ (conc) → Flash Boiling & Acid Splattering!',
                        VN: 'H₂O (rót vào) + H₂SO₄ (đặc) → Sôi Bùng Nổ & Bắn Axit!'
                    },
                    reactionType: {
                        EN: 'Hazardous Hydration Exotherm',
                        VN: 'Hiểm Họa Tỏa Nhiệt Hydrat Hóa'
                    },
                    mechanism: {
                        EN: 'Water added to concentrated acid flashes into steam, violently ejecting caustic acid droplets.',
                        VN: 'Rót nước vào axit đặc làm nước sôi tức thì biến thành hơi nước, bắn tung tóe axit gây bỏng nặng.'
                    },
                    message: { EN: 'LAB SAFETY VIOLATION: Never pour water into concentrated acid! Exothermic boil-over hazard!', VN: 'VI PHẠM AN TOÀN: Không bao giờ đổ nước vào axit đặc! Sôi trào nguy hiểm!' },
                    effect: 'explosion',
                    requiresPopup: true,
                    temperatureSpike: 110,
                    hazardLevel: 'CRITICAL'
                };
            }
        }
    }

    // 2.5 True Molar Stoichiometry & Limiting Reactant Consumption
    if (triggeredReaction) {
        if (triggeredReaction.reactants) {
            const r0 = triggeredReaction.reactants[0];
            const r1 = triggeredReaction.reactants[1];
            const vol0 = container.contents[r0] || 0;
            const vol1 = container.contents[r1] || 0;

            const { coef0, coef1, conc0, conc1 } = getReactionStoichiometry(r0, r1);

            // True moles present: n = (V / 1000) * C
            const moles0 = (vol0 / 1000) * conc0;
            const moles1 = (vol1 / 1000) * conc1;

            // Limiting reactant reaction extent: xi = min(n0 / coef0, n1 / coef1)
            const xi = Math.min(moles0 / coef0, moles1 / coef1);

            if (xi > 0) {
                const reactedMoles0 = xi * coef0;
                const reactedMoles1 = xi * coef1;

                const reactedVol0 = Math.min(vol0, (reactedMoles0 / conc0) * 1000);
                const reactedVol1 = Math.min(vol1, (reactedMoles1 / conc1) * 1000);

                // Deduct precisely reacted volumes - excess chemical is PRESERVED!
                container.contents[r0] = Math.max(0, +(vol0 - reactedVol0).toFixed(4));
                container.contents[r1] = Math.max(0, +(vol1 - reactedVol1).toFixed(4));

                if (container.contents[r0] <= 0.0001) delete container.contents[r0];
                if (container.contents[r1] <= 0.0001) delete container.contents[r1];

                // Products generated
                const totalReactedVol = reactedVol0 + reactedVol1;
                const productsToAdd = triggeredReaction.products || [triggeredReaction.product];
                const prodShare = +(totalReactedVol / Math.max(1, productsToAdd.length)).toFixed(4);

                for (const prodId of productsToAdd) {
                    if (prodId && CHEMICAL_REGISTRY[prodId]) {
                        const prodInfo = CHEMICAL_REGISTRY[prodId];
                        if (prodInfo.type === 'gas' || prodInfo.reactionClass === 'inert') {
                            container.contents[prodId] = Math.min(4, +((container.contents[prodId] || 0) + 1).toFixed(2));
                        } else {
                            container.contents[prodId] = +((container.contents[prodId] || 0) + prodShare).toFixed(4);
                        }
                    }
                }

                // Thermodynamic Temperature Scaling: Delta T = (xi * Delta H) / (m * Cp)
                const baseSpike = triggeredReaction.temperatureSpike || 15;
                const mass = Math.max(10, container.volume);
                const dynamicSpike = Math.min(120, +((xi * baseSpike * 41.84 * 1000) / (mass * 4.184)).toFixed(1));
                if (dynamicSpike > 0.5) {
                    triggeredReaction.temperatureSpike = dynamicSpike;
                }
            }

            // Recalculate container net liquid/solid volume
            let netVol = 0;
            for (const [cId, cVol] of Object.entries(container.contents)) {
                if (!cId.startsWith('reacted_')) {
                    netVol += cVol;
                }
            }
            container.volume = Math.min(container.maxVol, Math.round(netVol * 100) / 100);
        }

        // Color and optic updates
        if (triggeredReaction.productColor) {
            container.color = hexToRgb(triggeredReaction.productColor);
        } else if (triggeredReaction.precipitateColor) {
            container.color = hexToRgb(triggeredReaction.precipitateColor);
        } else if (triggeredReaction.product && CHEMICAL_REGISTRY[triggeredReaction.product]) {
            container.color = hexToRgb(CHEMICAL_REGISTRY[triggeredReaction.product].color);
        }
    }

    return triggeredReaction;
};

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
