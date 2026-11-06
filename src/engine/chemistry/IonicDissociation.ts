/**
 * @file IonicDissociation.ts
 * @description Advanced electrolyte speciation, ionic dissociation equilibria,
 * ionic strength calculation (Lewis-Randall), and electrical conductivity modeling (Kohlrausch).
 */

import { CHEMICAL_REGISTRY } from '../../data/ChemicalRegistry';

export interface IonSpecies {
    ion: string;
    charge: number;       // e.g. +1, -1, +2, -2
    stoichiometry: number; // stoichiometric coefficient in dissociation formula
    limitingMobility?: number; // S·cm²·mol⁻¹ at 25°C (Kohlrausch ionic conductance)
}

export interface ElectrolyteDissociationRule {
    dissociationDegree: number; // 1.0 = strong electrolyte, 0.01 - 0.1 = weak electrolyte
    ions: IonSpecies[];
    isBuffer?: boolean;
}

// Limiting molar ionic conductivities at 25°C (S·cm²·mol⁻¹)
const ION_MOBILITIES: Record<string, number> = {
    'H⁺': 349.8,
    'OH⁻': 198.6,
    'Na⁺': 50.1,
    'K⁺': 73.5,
    'NH₄⁺': 73.5,
    'Ca²⁺': 119.0,
    'Ba²⁺': 127.2,
    'Mg²⁺': 106.0,
    'Cu²⁺': 107.2,
    'Fe²⁺': 108.0,
    'Fe³⁺': 204.0,
    'Al³⁺': 189.0,
    'Zn²⁺': 105.6,
    'Ag⁺': 61.9,
    'Pb²⁺': 139.0,
    'Cl⁻': 76.3,
    'Br⁻': 78.1,
    'I⁻': 76.8,
    'NO₃⁻': 71.4,
    'SO₄²⁻': 160.0,
    'CO₃²⁻': 138.6,
    'HCO₃⁻': 44.5,
    'CH₃COO⁻': 40.9,
    'MnO₄⁻': 61.3,
    'Cr₂O₇²⁻': 144.0,
    'PO₄³⁻': 207.0
};

export const DISSOCIATION_DATABASE: Record<string, ElectrolyteDissociationRule> = {
    // Strong Acids
    'HCl': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'H⁺', charge: 1, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 1 }]
    },
    'HNO3': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'H⁺', charge: 1, stoichiometry: 1 }, { ion: 'NO₃⁻', charge: -1, stoichiometry: 1 }]
    },
    'H2SO4': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'H⁺', charge: 1, stoichiometry: 2 }, { ion: 'SO₄²⁻', charge: -2, stoichiometry: 1 }]
    },
    'HI': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'H⁺', charge: 1, stoichiometry: 1 }, { ion: 'I⁻', charge: -1, stoichiometry: 1 }]
    },
    'HBr': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'H⁺', charge: 1, stoichiometry: 1 }, { ion: 'Br⁻', charge: -1, stoichiometry: 1 }]
    },

    // Weak Acids
    'ACETIC_ACID': {
        dissociationDegree: 0.013,
        ions: [{ ion: 'H⁺', charge: 1, stoichiometry: 1 }, { ion: 'CH₃COO⁻', charge: -1, stoichiometry: 1 }]
    },
    'H3PO4': {
        dissociationDegree: 0.28,
        ions: [{ ion: 'H⁺', charge: 1, stoichiometry: 1 }, { ion: 'H₂PO₄⁻', charge: -1, stoichiometry: 1 }]
    },

    // Strong Bases
    'NaOH': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Na⁺', charge: 1, stoichiometry: 1 }, { ion: 'OH⁻', charge: -1, stoichiometry: 1 }]
    },
    'KOH': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'K⁺', charge: 1, stoichiometry: 1 }, { ion: 'OH⁻', charge: -1, stoichiometry: 1 }]
    },
    'BaOH2': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Ba²⁺', charge: 2, stoichiometry: 1 }, { ion: 'OH⁻', charge: -1, stoichiometry: 2 }]
    },
    'CaOH2': {
        dissociationDegree: 0.95,
        ions: [{ ion: 'Ca²⁺', charge: 2, stoichiometry: 1 }, { ion: 'OH⁻', charge: -1, stoichiometry: 2 }]
    },

    // Weak Bases
    'NH3_AQ': {
        dissociationDegree: 0.015,
        ions: [{ ion: 'NH₄⁺', charge: 1, stoichiometry: 1 }, { ion: 'OH⁻', charge: -1, stoichiometry: 1 }]
    },

    // Soluble Salts
    'NaCl': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Na⁺', charge: 1, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 1 }]
    },
    'KCl': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'K⁺', charge: 1, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 1 }]
    },
    'CuSO4': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Cu²⁺', charge: 2, stoichiometry: 1 }, { ion: 'SO₄²⁻', charge: -2, stoichiometry: 1 }]
    },
    'PbNO32': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Pb²⁺', charge: 2, stoichiometry: 1 }, { ion: 'NO₃⁻', charge: -1, stoichiometry: 2 }]
    },
    'KI': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'K⁺', charge: 1, stoichiometry: 1 }, { ion: 'I⁻', charge: -1, stoichiometry: 1 }]
    },
    'AgNO3': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Ag⁺', charge: 1, stoichiometry: 1 }, { ion: 'NO₃⁻', charge: -1, stoichiometry: 1 }]
    },
    'FeCl3': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Fe³⁺', charge: 3, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 3 }]
    },
    'FeCl2': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Fe²⁺', charge: 2, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 2 }]
    },
    'FeSO4': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Fe²⁺', charge: 2, stoichiometry: 1 }, { ion: 'SO₄²⁻', charge: -2, stoichiometry: 1 }]
    },
    'Na2CO3': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Na⁺', charge: 1, stoichiometry: 2 }, { ion: 'CO₃²⁻', charge: -2, stoichiometry: 1 }]
    },
    'NaHCO3': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Na⁺', charge: 1, stoichiometry: 1 }, { ion: 'HCO₃⁻', charge: -1, stoichiometry: 1 }]
    },
    'KMnO4': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'K⁺', charge: 1, stoichiometry: 1 }, { ion: 'MnO₄⁻', charge: -1, stoichiometry: 1 }]
    },
    'K2Cr2O7': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'K⁺', charge: 1, stoichiometry: 2 }, { ion: 'Cr₂O₇²⁻', charge: -2, stoichiometry: 1 }]
    },
    'AlCl3': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Al³⁺', charge: 3, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 3 }]
    },
    'ZnSO4': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Zn²⁺', charge: 2, stoichiometry: 1 }, { ion: 'SO₄²⁻', charge: -2, stoichiometry: 1 }]
    },
    'MgCl2': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Mg²⁺', charge: 2, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 2 }]
    },
    'CaCl2': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Ca²⁺', charge: 2, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 2 }]
    },
    'BaCl2': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Ba²⁺', charge: 2, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 2 }]
    },
    'CH3COONa': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'Na⁺', charge: 1, stoichiometry: 1 }, { ion: 'CH₃COO⁻', charge: -1, stoichiometry: 1 }]
    },
    'NH4Cl': {
        dissociationDegree: 1.0,
        ions: [{ ion: 'NH₄⁺', charge: 1, stoichiometry: 1 }, { ion: 'Cl⁻', charge: -1, stoichiometry: 1 }]
    }
};

export interface SolutionAnalysis {
    ions: string[];                     // Distinct ionic species formatted e.g. ['Na⁺', 'Cl⁻']
    totalMoles: number;                // Total dissolved solute moles
    molarity: number;                  // Solute molar concentration (mol/L)
    ionicStrength: number;             // Ionic strength I = 0.5 * sum(c_i * z_i^2) (mol/L)
    conductivityMicroSiemens: number;  // Specific conductivity in μS/cm
    osmolarity: number;                // Total dissolved particles in Osm/L
    electrolyteClass: 'Strong Electrolyte' | 'Weak Electrolyte' | 'Non-Electrolyte';
}

/**
 * Analyzes solution contents in a container to yield exact chemical telemetry.
 */
export function analyzeContainerSolution(
    contents: Record<string, number> | undefined,
    totalVolumeMl: number
): SolutionAnalysis {
    if (!contents || totalVolumeMl <= 0) {
        return {
            ions: [],
            totalMoles: 0,
            molarity: 0,
            ionicStrength: 0,
            conductivityMicroSiemens: 0,
            osmolarity: 0,
            electrolyteClass: 'Non-Electrolyte'
        };
    }

    const volumeLiters = totalVolumeMl / 1000;
    const ionConcentrations: Record<string, { charge: number; concentration: number }> = {};
    let totalMolesSolute = 0;
    let hasStrong = false;
    let hasWeak = false;

    for (const [chemId, volMl] of Object.entries(contents)) {
        if (!volMl || volMl <= 0.05 || chemId.endsWith('_PRECIPITATE')) continue;

        const reg = CHEMICAL_REGISTRY[chemId];
        const molarMass = reg?.molarMass || 60; // fallback molecular weight
        // Estimate solute moles (assuming standard aqueous density ~1.0 g/mL)
        const moles = (volMl * 1.0) / molarMass;
        totalMolesSolute += moles;

        const rule = DISSOCIATION_DATABASE[chemId];
        if (rule) {
            if (rule.dissociationDegree >= 0.9) hasStrong = true;
            else hasWeak = true;

            const molarity = moles / volumeLiters;
            for (const sp of rule.ions) {
                const ionMolarity = molarity * sp.stoichiometry * rule.dissociationDegree;
                if (!ionConcentrations[sp.ion]) {
                    ionConcentrations[sp.ion] = { charge: sp.charge, concentration: 0 };
                }
                ionConcentrations[sp.ion].concentration += ionMolarity;
            }
        }
    }

    // Calculate Ionic Strength (I = 0.5 * sum(c_i * z_i^2))
    let ionicStrength = 0;
    let totalOsmolytes = 0;
    let totalConductivity = 0; // mS/cm

    for (const [ionName, data] of Object.entries(ionConcentrations)) {
        const c = data.concentration; // mol/L
        const z = data.charge;
        ionicStrength += 0.5 * c * (z * z);
        totalOsmolytes += c;

        // Kohlrausch limiting molar conductivity: kappa = sum(c_i * lambda_i) / 1000
        const mobility = ION_MOBILITIES[ionName] || (Math.abs(z) * 60);
        totalConductivity += (c * mobility);
    }

    // Add un-dissociated molecules to osmolarity
    const overallMolarity = totalMolesSolute / volumeLiters;
    const electrolyteClass = hasStrong 
        ? 'Strong Electrolyte' 
        : hasWeak 
            ? 'Weak Electrolyte' 
            : 'Non-Electrolyte';

    return {
        ions: Object.keys(ionConcentrations),
        totalMoles: +(totalMolesSolute.toFixed(4)),
        molarity: +(overallMolarity.toFixed(2)),
        ionicStrength: +(ionicStrength.toFixed(3)),
        conductivityMicroSiemens: Math.round(totalConductivity * 1000), // convert to μS/cm
        osmolarity: +(totalOsmolytes.toFixed(3)),
        electrolyteClass
    };
}
