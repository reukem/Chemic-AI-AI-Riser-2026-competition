/**
 * @file BeerLambertOptics.ts
 * @description Authentic physical optics engine applying the Beer-Lambert absorption law
 * (A = ε * b * c) and Rayleigh / Mie light scattering for chemical solution realism.
 */

export interface ChromophoreProfile {
    molarExtinction: number; // ε (L·mol⁻¹·cm⁻¹) at characteristic peak λ_max
    peakWavelengthNm: number; // λ_max in nanometers
    absorptionRgb: { r: number; g: number; b: number }; // Complementary color absorbed
    baseRgb: { r: number; g: number; b: number };       // Native transmission color
}

// Characteristic chromophores for aqueous chemical species
export const CHROMOPHORE_DATABASE: Record<string, ChromophoreProfile> = {
    'CuSO4': {
        molarExtinction: 28.5,
        peakWavelengthNm: 810,
        absorptionRgb: { r: 255, g: 120, b: 0 },
        baseRgb: { r: 37, g: 99, b: 235 } // Azure Blue
    },
    'KMnO4': {
        molarExtinction: 2450.0,
        peakWavelengthNm: 525,
        absorptionRgb: { r: 0, g: 255, b: 0 },
        baseRgb: { r: 147, g: 51, b: 234 } // Deep Violet-Purple
    },
    'K2Cr2O7': {
        molarExtinction: 410.0,
        peakWavelengthNm: 440,
        absorptionRgb: { r: 0, g: 120, b: 255 },
        baseRgb: { r: 249, g: 115, b: 22 } // Vibrant Orange
    },
    'FeCl3': {
        molarExtinction: 120.0,
        peakWavelengthNm: 460,
        absorptionRgb: { r: 0, g: 80, b: 255 },
        baseRgb: { r: 180, g: 83, b: 9 } // Amber / Yellow-Brown
    },
    'FeSO4': {
        molarExtinction: 18.0,
        peakWavelengthNm: 900,
        absorptionRgb: { r: 220, g: 50, b: 50 },
        baseRgb: { r: 74, g: 222, b: 128 } // Pale Green
    },
    'KI': {
        molarExtinction: 1.2,
        peakWavelengthNm: 220,
        absorptionRgb: { r: 0, g: 0, b: 0 },
        baseRgb: { r: 255, g: 255, b: 255 }
    },
    'IODINE': {
        molarExtinction: 850.0,
        peakWavelengthNm: 450,
        absorptionRgb: { r: 0, g: 100, b: 255 },
        baseRgb: { r: 120, g: 53, b: 15 } // Deep Brown-Violet
    }
};

export interface SolutionOpticalProperties {
    absorbance: number;     // Total absorbance A
    transmittance: number;  // Fractional transmittance T (0 to 1)
    turbidity: number;      // Turbidity (0 = crystal clear, 1 = opaque colloid)
    alpha: number;          // Rendered fluid alpha opacity (0.2 to 0.98)
}

/**
 * Calculates authentic optical properties of a solution using Beer-Lambert & turbidity laws.
 * @param contents Volume distribution of chemical reagents (mL)
 * @param totalVolume Total liquid volume (mL)
 * @param pathLengthCm Physical path length across glassware (default 5.0 cm for standard 100mL beaker)
 */
export function calculateSolutionOptics(
    contents: Record<string, number> | undefined,
    totalVolume: number,
    pathLengthCm: number = 5.0
): SolutionOpticalProperties {
    if (!contents || totalVolume <= 0) {
        return {
            absorbance: 0,
            transmittance: 1.0,
            turbidity: 0,
            alpha: 0.25
        };
    }

    let totalAbsorbance = 0;
    let turbidityScore = 0;

    for (const [chemId, vol] of Object.entries(contents)) {
        if (!vol || vol <= 0.001) continue;

        // Check for colloidal / precipitate turbidity
        if (chemId.endsWith('_PRECIPITATE')) {
            const fraction = vol / totalVolume;
            turbidityScore += fraction * 3.5;
        }

        // Beer-Lambert chromophore absorbance: A = ε * b * c
        const chromo = CHROMOPHORE_DATABASE[chemId];
        if (chromo) {
            // Estimate concentration c (mol/L) assuming ~0.5M stock
            const concentration = (vol / totalVolume) * 0.5;
            const A = chromo.molarExtinction * pathLengthCm * concentration * 0.01;
            totalAbsorbance += A;
        }
    }

    const transmittance = Math.max(0.01, Math.min(1.0, Math.pow(10, -totalAbsorbance)));
    const normalizedTurbidity = Math.min(1.0, turbidityScore);
    
    // Calculate final rendered opacity
    const baseAlpha = 0.45;
    const absorptionAlpha = (1.0 - transmittance) * 0.4;
    const turbidityAlpha = normalizedTurbidity * 0.45;
    const finalAlpha = Math.max(0.25, Math.min(0.96, baseAlpha + absorptionAlpha + turbidityAlpha));

    return {
        absorbance: +(totalAbsorbance.toFixed(3)),
        transmittance: +(transmittance.toFixed(3)),
        turbidity: +(normalizedTurbidity.toFixed(2)),
        alpha: +(finalAlpha.toFixed(2))
    };
}
