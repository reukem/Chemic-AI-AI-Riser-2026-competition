/**
 * @file ReactionKineticsEngine.ts
 * @description The core chemical kinetics and thermodynamic reaction engine for Chemic-AI.
 * Evaluates stoichiometric reaction rules, dynamic multi-class fallback routing,
 * molar limiting reactants, entropy sludge collapse, pH equilibrium, and RMS photon absorption color blending.
 */

import { CHEMICAL_REGISTRY, REACTION_RULES, Chemical } from '../../data/ChemicalRegistry';

export interface ContainerState {
    id: number;
    contents: Record<string, number>;
    volume: number;
    maxVol: number;
    color: { r: number; g: number; b: number };
    ph: number;
    [key: string]: any;
}

export interface StoichiometricRatio {
    coef0: number;
    coef1: number;
    conc0: number; // mol / L
    conc1: number; // mol / L
}

/**
 * Parses Hexadecimal color strings into RGB components.
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
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
 * Applies photon absorption mathematics (subtractive fluid mixing) weighted strictly by volume.
 */
export const blendColorsRMS = (
    c1: { r: number; g: number; b: number }, 
    v1: number, 
    c2: { r: number; g: number; b: number }, 
    v2: number
): { r: number; g: number; b: number } => {
    const tVol = v1 + v2;
    if (tVol <= 0) return { r: 0, g: 0, b: 0 };
    return {
        r: Math.round(Math.sqrt((c1.r * c1.r * v1 + c2.r * c2.r * v2) / tVol)),
        g: Math.round(Math.sqrt((c1.g * c1.g * v1 + c2.g * c2.g * v2) / tVol)),
        b: Math.round(Math.sqrt((c1.b * c1.b * v1 + c2.b * c2.b * v2) / tVol))
    };
};

/**
 * Calculates authentic stoichiometric molar ratios and stock concentrations.
 */
export const getReactionStoichiometry = (r0: string, r1: string): StoichiometricRatio => {
    const chem0 = CHEMICAL_REGISTRY[r0];
    const chem1 = CHEMICAL_REGISTRY[r1];

    let conc0 = 0.1;
    let conc1 = 0.1;
    if (r0.includes('H2SO4') && chem0?.description?.EN?.toLowerCase().includes('concentrated')) conc0 = 18.0;
    else if (r0.includes('HCl') && chem0?.description?.EN?.toLowerCase().includes('concentrated')) conc0 = 12.0;
    else if (chem0?.category === 'element' || chem0?.type === 'solid') conc0 = 1.0;

    if (r1.includes('H2SO4') && chem1?.description?.EN?.toLowerCase().includes('concentrated')) conc1 = 18.0;
    else if (r1.includes('HCl') && chem1?.description?.EN?.toLowerCase().includes('concentrated')) conc1 = 12.0;
    else if (chem1?.category === 'element' || chem1?.type === 'solid') conc1 = 1.0;

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
 * Scientifically recalculates aqueous pH and updates indicator colors.
 */
export const recalculateContainerPH = (container: ContainerState): void => {
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
 * Scans a container's contents and evaluates thermodynamic and kinetic reaction rules.
 */
export const evaluateDynamicReactions = (
    container: ContainerState, 
    incomingReagents: string[] = [], 
    currentTemp: number = 25
): any => {
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
                VN: 'Đã đạt trạng thái sụp đổ nhiệt động! Phản ứng hỗn loạn sinh ra bùn trơ.'
            },
            effect: 'smoke',
            temperatureSpike: 5,
            hazardLevel: 'WARNING'
        };
    }

    // 1. Strict Reaction Rules Check
    let triggeredReaction: any = null;
    for (const rule of REACTION_RULES) {
        const r0 = rule.reactants[0];
        const r1 = rule.reactants[1];

        // Check thermal activation requirements
        if (rule.minTemperature && currentTemp < rule.minTemperature) {
            continue;
        }

        if (incomingReagents.length > 0) {
            if ((container.contents[r0] || 0) > 0.001 && (container.contents[r1] || 0) > 0.001) {
                if (incomingReagents.includes(r0) && !incomingReagents.includes(r1)) {
                    triggeredReaction = rule;
                    break;
                }
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

    // 2. Class-Based Fallback Engine
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
        // Alkali Metal + Strong Acid -> Detonation
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
        // Active Metal + Acid -> H2 bubbles
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
        // Carbonate + Acid -> CO2 effervescence
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
    if (triggeredReaction && triggeredReaction.reactants) {
        const r0 = triggeredReaction.reactants[0];
        const r1 = triggeredReaction.reactants[1];
        const vol0 = container.contents[r0] || 0;
        const vol1 = container.contents[r1] || 0;

        const { coef0, coef1, conc0, conc1 } = getReactionStoichiometry(r0, r1);

        const moles0 = (vol0 / 1000) * conc0;
        const moles1 = (vol1 / 1000) * conc1;

        const xi = Math.min(moles0 / coef0, moles1 / coef1);

        if (xi > 0) {
            const reactedMoles0 = xi * coef0;
            const reactedMoles1 = xi * coef1;

            const reactedVol0 = Math.min(vol0, (reactedMoles0 / conc0) * 1000);
            const reactedVol1 = Math.min(vol1, (reactedMoles1 / conc1) * 1000);

            // Deduct precisely reacted volumes - excess chemical is preserved!
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
