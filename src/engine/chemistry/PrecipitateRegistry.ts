/**
 * @file PrecipitateRegistry.ts
 * @description Master catalog of chemical precipitate morphologies, sedimentation kinetics,
 * optical appearance, and crystalline textures for the Chemic-AI Laboratory.
 */

export interface PrecipitateProfile {
    formula: string;
    label: string;
    color: string;
    bgGrad: string;
    particleType: 'crystalline' | 'gelatinous' | 'curd' | 'metallic' | 'carbon_column' | 'ash';
    sedimentationRate: number; // Stokes terminal settling speed multiplier
    turbidityCoeff: number;   // Opacity per mole of precipitate
    particleHue?: string;     // Color for micro-crystal / flake particles
}

export const PRECIPITATE_REGISTRY: Record<string, PrecipitateProfile> = {
    'CuOH2_PRECIPITATE': {
        formula: 'Cu(OH)₂',
        label: 'Cu(OH)₂ ↓ (Gelatinous)',
        color: 'rgb(56, 189, 248)',
        bgGrad: 'linear-gradient(180deg, rgba(56, 189, 248, 0.9) 0%, rgba(2, 132, 199, 0.98) 100%)',
        particleType: 'gelatinous',
        sedimentationRate: 0.8,
        turbidityCoeff: 0.85,
        particleHue: 'rgba(56, 189, 248, 0.7)'
    },
    'Cu2O_PRECIPITATE': {
        formula: 'Cu₂O',
        label: 'Cu₂O ↓ (Brick Red)',
        color: 'rgb(185, 28, 28)',
        bgGrad: 'linear-gradient(180deg, rgba(220, 38, 38, 0.95) 0%, rgba(153, 27, 27, 0.98) 100%)',
        particleType: 'crystalline',
        sedimentationRate: 1.4,
        turbidityCoeff: 0.92,
        particleHue: 'rgba(220, 38, 38, 0.8)'
    },
    'PbI2_PRECIPITATE': {
        formula: 'PbI₂',
        label: 'PbI₂ ↓ (Golden Rain)',
        color: 'rgb(234, 179, 8)',
        bgGrad: 'linear-gradient(180deg, rgba(254, 240, 138, 0.95) 0%, rgba(234, 179, 8, 0.98) 50%, rgba(161, 98, 7, 1) 100%)',
        particleType: 'crystalline',
        sedimentationRate: 1.2,
        turbidityCoeff: 0.95,
        particleHue: 'rgba(250, 204, 21, 0.9)'
    },
    'SILVER': {
        formula: 'Ag',
        label: 'Ag (Silver Mirror) 🪞',
        color: 'rgb(241, 245, 249)',
        bgGrad: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(203, 213, 225, 0.95) 25%, rgba(148, 163, 184, 0.98) 50%, rgba(255, 255, 255, 0.98) 75%, rgba(100, 116, 139, 0.98) 100%)',
        particleType: 'metallic',
        sedimentationRate: 2.0,
        turbidityCoeff: 0.98,
        particleHue: 'rgba(255, 255, 255, 0.95)'
    },
    'CARBON': {
        formula: 'C',
        label: 'Carbon (Sugar Monster) █',
        color: 'rgb(24, 24, 27)',
        bgGrad: 'linear-gradient(180deg, #27272a 0%, #18181b 50%, #09090b 100%)',
        particleType: 'carbon_column',
        sedimentationRate: 0.5,
        turbidityCoeff: 1.0,
        particleHue: 'rgba(39, 39, 42, 0.95)'
    },
    'MANGANESE_DIOXIDE': {
        formula: 'MnO₂',
        label: 'MnO₂ ↓ (Brown Sludge)',
        color: 'rgb(68, 43, 33)',
        bgGrad: 'linear-gradient(180deg, rgba(87, 59, 44, 0.95) 0%, rgba(56, 38, 28, 0.98) 100%)',
        particleType: 'gelatinous',
        sedimentationRate: 1.3,
        turbidityCoeff: 0.9,
        particleHue: 'rgba(87, 59, 44, 0.8)'
    },
    'MgO_SOLID': {
        formula: 'MgO',
        label: 'MgO (White Ash) ↓',
        color: 'rgb(248, 250, 252)',
        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(226, 232, 240, 0.98) 100%)',
        particleType: 'ash',
        sedimentationRate: 0.9,
        turbidityCoeff: 0.85,
        particleHue: 'rgba(255, 255, 255, 0.8)'
    },
    'BaSO4_PRECIPITATE': {
        formula: 'BaSO₄',
        label: 'BaSO₄ ↓ (Dense White)',
        color: 'rgba(248, 250, 252, 0.95)',
        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(226, 232, 240, 0.98) 100%)',
        particleType: 'curd',
        sedimentationRate: 1.8,
        turbidityCoeff: 0.95,
        particleHue: 'rgba(255, 255, 255, 0.85)'
    },
    'CaCO3_PRECIPITATE': {
        formula: 'CaCO₃',
        label: 'CaCO₃ ↓ (Milky)',
        color: 'rgba(241, 245, 249, 0.95)',
        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(203, 213, 225, 0.98) 100%)',
        particleType: 'curd',
        sedimentationRate: 1.1,
        turbidityCoeff: 0.9,
        particleHue: 'rgba(241, 245, 249, 0.8)'
    },
    'BaCO3_PRECIPITATE': {
        formula: 'BaCO₃',
        label: 'BaCO₃ ↓',
        color: 'rgba(241, 245, 249, 0.95)',
        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(203, 213, 225, 0.98) 100%)',
        particleType: 'curd',
        sedimentationRate: 1.5,
        turbidityCoeff: 0.92,
        particleHue: 'rgba(241, 245, 249, 0.85)'
    },
    'AgCl_PRECIPITATE': {
        formula: 'AgCl',
        label: 'AgCl ↓ (Curdy White)',
        color: 'rgba(255, 255, 255, 0.98)',
        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(203, 213, 225, 0.98) 100%)',
        particleType: 'curd',
        sedimentationRate: 1.6,
        turbidityCoeff: 0.96,
        particleHue: 'rgba(255, 255, 255, 0.9)'
    },
    'AgI_PRECIPITATE': {
        formula: 'AgI',
        label: 'AgI ↓ (Bright Yellow)',
        color: 'rgb(234, 179, 8)',
        bgGrad: 'linear-gradient(180deg, rgba(250, 204, 21, 0.92) 0%, rgba(202, 138, 4, 0.98) 100%)',
        particleType: 'curd',
        sedimentationRate: 1.7,
        turbidityCoeff: 0.96,
        particleHue: 'rgba(250, 204, 21, 0.85)'
    },
    'AlOH3_PRECIPITATE': {
        formula: 'Al(OH)₃',
        label: 'Al(OH)₃ ↓ (Gelatinous)',
        color: 'rgba(241, 245, 249, 0.95)',
        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(226, 232, 240, 0.98) 100%)',
        particleType: 'gelatinous',
        sedimentationRate: 0.7,
        turbidityCoeff: 0.8,
        particleHue: 'rgba(241, 245, 249, 0.75)'
    },
    'FeOH2_PRECIPITATE': {
        formula: 'Fe(OH)₂',
        label: 'Fe(OH)₂ ↓ (Dirty Green)',
        color: 'rgb(34, 197, 94)',
        bgGrad: 'linear-gradient(180deg, rgba(74, 222, 128, 0.9) 0%, rgba(22, 101, 52, 0.98) 100%)',
        particleType: 'gelatinous',
        sedimentationRate: 0.9,
        turbidityCoeff: 0.88,
        particleHue: 'rgba(74, 222, 128, 0.8)'
    },
    'FeOH3_PRECIPITATE': {
        formula: 'Fe(OH)₃',
        label: 'Fe(OH)₃ ↓ (Reddish-Brown)',
        color: 'rgb(180, 83, 9)',
        bgGrad: 'linear-gradient(180deg, rgba(217, 119, 6, 0.9) 0%, rgba(146, 64, 14, 0.98) 100%)',
        particleType: 'gelatinous',
        sedimentationRate: 1.0,
        turbidityCoeff: 0.94,
        particleHue: 'rgba(217, 119, 6, 0.85)'
    },
    'TRIBROMOPHENOL_PRECIPITATE': {
        formula: 'C₆H₂Br₃OH',
        label: '2,4,6-Tribromophenol ↓ (White Needle)',
        color: 'rgba(248, 250, 252, 0.95)',
        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(226, 232, 240, 0.98) 100%)',
        particleType: 'crystalline',
        sedimentationRate: 1.1,
        turbidityCoeff: 0.92,
        particleHue: 'rgba(255, 255, 255, 0.9)'
    },
    'TRIBROMOANILINE_PRECIPITATE': {
        formula: 'C₆H₂Br₃NH₂',
        label: '2,4,6-Tribromoaniline ↓ (White Needle)',
        color: 'rgba(248, 250, 252, 0.95)',
        bgGrad: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(226, 232, 240, 0.98) 100%)',
        particleType: 'crystalline',
        sedimentationRate: 1.1,
        turbidityCoeff: 0.92,
        particleHue: 'rgba(255, 255, 255, 0.9)'
    }
};

/**
 * Helper to test if a chemical ID represents a recognized precipitate.
 */
export function isPrecipitate(chemicalId: string): boolean {
    return chemicalId in PRECIPITATE_REGISTRY || chemicalId.endsWith('_PRECIPITATE');
}

/**
 * Returns the profile for a precipitate, with a safe fallback for unknown precipitates.
 */
export function getPrecipitateProfile(chemicalId: string): PrecipitateProfile {
    if (PRECIPITATE_REGISTRY[chemicalId]) {
        return PRECIPITATE_REGISTRY[chemicalId];
    }
    return {
        formula: chemicalId.replace('_PRECIPITATE', ''),
        label: `${chemicalId.replace('_PRECIPITATE', '')} ↓`,
        color: 'rgba(203, 213, 225, 0.9)',
        bgGrad: 'linear-gradient(180deg, rgba(241, 245, 249, 0.9) 0%, rgba(148, 163, 184, 0.98) 100%)',
        particleType: 'curd',
        sedimentationRate: 1.0,
        turbidityCoeff: 0.85,
        particleHue: 'rgba(203, 213, 225, 0.8)'
    };
}
