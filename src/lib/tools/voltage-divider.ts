export const VOLTAGE_UNITS = {
    mV: 0.001,
    V: 1,
    kV: 1_000,
} as const;

export const RESISTANCE_UNITS = {
    ohm: 1,
    kohm: 1_000,
    Mohm: 1_000_000,
} as const;

export type VoltageUnit = keyof typeof VOLTAGE_UNITS;
export type ResistanceUnit = keyof typeof RESISTANCE_UNITS;

export type DividerField = 'vin' | 'r1' | 'r2' | 'vout';

export interface DividerValues {
    vin: number | null;
    r1: number | null;
    r2: number | null;
    vout: number | null;
}

export interface DividerSolution extends DividerValues {
    current: number | null;
    formulas: string[];
    error?: string;
}

function isPositive(value: number | null): value is number {
    return value !== null && Number.isFinite(value) && value > 0;
}

export function toBaseVoltage(value: number, unit: VoltageUnit): number {
    return value * VOLTAGE_UNITS[unit];
}

export function toBaseResistance(value: number, unit: ResistanceUnit): number {
    return value * RESISTANCE_UNITS[unit];
}

export function fromBaseVoltage(value: number, unit: VoltageUnit): number {
    return value / VOLTAGE_UNITS[unit];
}

export function fromBaseResistance(value: number, unit: ResistanceUnit): number {
    return value / RESISTANCE_UNITS[unit];
}

export function solveVoltageDivider(known: Partial<Record<DividerField, number>>): DividerSolution {
    const vin = known.vin ?? null;
    const r1 = known.r1 ?? null;
    const r2 = known.r2 ?? null;
    const vout = known.vout ?? null;

    const knownCount = [vin, r1, r2, vout].filter(isPositive).length;
    const formulas: string[] = [];

    if (knownCount < 3) {
        return {vin, r1, r2, vout, current: null, formulas};
    }

    let solvedVin = vin;
    let solvedR1 = r1;
    let solvedR2 = r2;
    let solvedVout = vout;

    if (!isPositive(solvedVout) && isPositive(solvedVin) && isPositive(solvedR1) && isPositive(solvedR2)) {
        solvedVout = solvedVin * solvedR2 / (solvedR1 + solvedR2);
        formulas.push('Vout = Vin × R2 / (R1 + R2)');
    } else if (!isPositive(solvedVin) && isPositive(solvedVout) && isPositive(solvedR1) && isPositive(solvedR2)) {
        solvedVin = solvedVout * (solvedR1 + solvedR2) / solvedR2;
        formulas.push('Vin = Vout × (R1 + R2) / R2');
    } else if (!isPositive(solvedR1) && isPositive(solvedVin) && isPositive(solvedVout) && isPositive(solvedR2)) {
        if (solvedVout >= solvedVin) {
            return {vin, r1, r2, vout, current: null, formulas, error: 'vout_exceeds_vin'};
        }
        solvedR1 = solvedR2 * (solvedVin / solvedVout - 1);
        formulas.push('R1 = R2 × (Vin / Vout − 1)');
    } else if (!isPositive(solvedR2) && isPositive(solvedVin) && isPositive(solvedVout) && isPositive(solvedR1)) {
        if (solvedVout >= solvedVin) {
            return {vin, r1, r2, vout, current: null, formulas, error: 'vout_exceeds_vin'};
        }
        solvedR2 = solvedR1 * solvedVout / (solvedVin - solvedVout);
        formulas.push('R2 = R1 × Vout / (Vin − Vout)');
    } else {
        return {vin, r1, r2, vout, current: null, formulas, error: 'invalid_combination'};
    }

    const current =
        isPositive(solvedVin) && isPositive(solvedR1) && isPositive(solvedR2)
            ? solvedVin / (solvedR1 + solvedR2)
            : null;

    if (current !== null && formulas.length > 0) {
        formulas.push('I = Vin / (R1 + R2)');
    }

    return {
        vin: solvedVin,
        r1: solvedR1,
        r2: solvedR2,
        vout: solvedVout,
        current,
        formulas,
    };
}

export function formatDividerValue(value: number | null, decimals = 4): string {
    if (value === null || !Number.isFinite(value)) return '—';
    if (value === 0) return '0';

    const abs = Math.abs(value);
    if (abs >= 1_000_000) return value.toExponential(3);
    if (abs < 0.001) return value.toExponential(3);
    return Number.parseFloat(value.toPrecision(decimals)).toString();
}
