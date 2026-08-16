export const RESISTANCE_UNITS = {
    ohm: 1,
    kohm: 1_000,
    Mohm: 1_000_000,
} as const;

export type ResistanceUnit = keyof typeof RESISTANCE_UNITS;
export type CircuitMode = 'series' | 'parallel';

export const MAX_RESISTORS = 10;
export const MIN_RESISTORS = 1;

export interface ResistorEntry {
    value: number;
    unit: ResistanceUnit;
}

export interface SeriesParallelSolution {
    equivalentOhms: number | null;
    formulas: string[];
    error?: string;
}

export function toBaseResistance(value: number, unit: ResistanceUnit): number {
    return value * RESISTANCE_UNITS[unit];
}

export function fromBaseResistance(value: number, unit: ResistanceUnit): number {
    return value / RESISTANCE_UNITS[unit];
}

export function calculateEquivalentResistance(
    resistors: ResistorEntry[],
    mode: CircuitMode,
): SeriesParallelSolution {
    const valid = resistors
        .map((r) => toBaseResistance(r.value, r.unit))
        .filter((ohms) => Number.isFinite(ohms) && ohms > 0);

    if (valid.length === 0) {
        return {equivalentOhms: null, formulas: []};
    }

    if (mode === 'series') {
        const sum = valid.reduce((acc, ohms) => acc + ohms, 0);
        return {
            equivalentOhms: sum,
            formulas: ['Req = R1 + R2 + … + Rn'],
        };
    }

    const reciprocalSum = valid.reduce((acc, ohms) => acc + 1 / ohms, 0);
    if (reciprocalSum <= 0) {
        return {equivalentOhms: null, formulas: [], error: 'invalid_combination'};
    }

    return {
        equivalentOhms: 1 / reciprocalSum,
        formulas: ['1/Req = 1/R1 + 1/R2 + … + 1/Rn'],
    };
}

export function formatResistanceValue(value: number | null, decimals = 4): string {
    if (value === null || !Number.isFinite(value)) return '—';
    if (value === 0) return '0';

    const abs = Math.abs(value);
    if (abs >= 1_000_000) return value.toExponential(3);
    if (abs < 0.001) return value.toExponential(3);
    return Number.parseFloat(value.toPrecision(decimals)).toString();
}
