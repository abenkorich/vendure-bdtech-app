export const RESISTANCE_UNITS = {
    ohm: 1,
    kohm: 1_000,
    Mohm: 1_000_000,
} as const;

export const CAPACITANCE_UNITS = {
    pF: 1e-12,
    nF: 1e-9,
    uF: 1e-6,
    mF: 1e-3,
} as const;

export type ResistanceUnit = keyof typeof RESISTANCE_UNITS;
export type CapacitanceUnit = keyof typeof CAPACITANCE_UNITS;
export type TimerMode = 'astable' | 'monostable';

export interface AstableInputs {
    r1: number;
    r1Unit: ResistanceUnit;
    r2: number;
    r2Unit: ResistanceUnit;
    c: number;
    cUnit: CapacitanceUnit;
}

export interface MonostableInputs {
    r: number;
    rUnit: ResistanceUnit;
    c: number;
    cUnit: CapacitanceUnit;
}

export interface AstableSolution {
    frequencyHz: number | null;
    periodSeconds: number | null;
    dutyCyclePercent: number | null;
    formulas: string[];
    error?: string;
}

export interface MonostableSolution {
    pulseWidthSeconds: number | null;
    formulas: string[];
    error?: string;
}

export function toBaseResistance(value: number, unit: ResistanceUnit): number {
    return value * RESISTANCE_UNITS[unit];
}

export function toBaseCapacitance(value: number, unit: CapacitanceUnit): number {
    return value * CAPACITANCE_UNITS[unit];
}

function isPositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

export function calculateAstable(inputs: AstableInputs): AstableSolution {
    const r1 = toBaseResistance(inputs.r1, inputs.r1Unit);
    const r2 = toBaseResistance(inputs.r2, inputs.r2Unit);
    const c = toBaseCapacitance(inputs.c, inputs.cUnit);

    if (!isPositive(r1) || !isPositive(r2) || !isPositive(c)) {
        return {frequencyHz: null, periodSeconds: null, dutyCyclePercent: null, formulas: []};
    }

    const denominator = (r1 + 2 * r2) * c;
    if (denominator <= 0) {
        return {
            frequencyHz: null,
            periodSeconds: null,
            dutyCyclePercent: null,
            formulas: [],
            error: 'invalid_combination',
        };
    }

    const frequencyHz = 1.44 / denominator;
    const periodSeconds = 1 / frequencyHz;
    const dutyCyclePercent = ((r1 + r2) / (r1 + 2 * r2)) * 100;

    return {
        frequencyHz,
        periodSeconds,
        dutyCyclePercent,
        formulas: [
            'f = 1.44 / ((R1 + 2×R2) × C)',
            'T = 1 / f',
            'D = (R1 + R2) / (R1 + 2×R2) × 100%',
        ],
    };
}

export function calculateMonostable(inputs: MonostableInputs): MonostableSolution {
    const r = toBaseResistance(inputs.r, inputs.rUnit);
    const c = toBaseCapacitance(inputs.c, inputs.cUnit);

    if (!isPositive(r) || !isPositive(c)) {
        return {pulseWidthSeconds: null, formulas: []};
    }

    return {
        pulseWidthSeconds: 1.1 * r * c,
        formulas: ['t = 1.1 × R × C'],
    };
}

export function formatTimerValue(value: number | null, decimals = 4): string {
    if (value === null || !Number.isFinite(value)) return '—';
    if (value === 0) return '0';

    const abs = Math.abs(value);
    if (abs >= 1_000_000) return value.toExponential(3);
    if (abs < 0.000_001) return value.toExponential(3);
    return Number.parseFloat(value.toPrecision(decimals)).toString();
}

export function formatFrequency(hz: number | null): string {
    if (hz === null || !Number.isFinite(hz)) return '—';
    if (hz >= 1_000_000) return `${formatTimerValue(hz / 1_000_000)} MHz`;
    if (hz >= 1_000) return `${formatTimerValue(hz / 1_000)} kHz`;
    return `${formatTimerValue(hz)} Hz`;
}

export function formatTime(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds)) return '—';
    if (seconds >= 1) return `${formatTimerValue(seconds)} s`;
    if (seconds >= 1e-3) return `${formatTimerValue(seconds * 1_000)} ms`;
    if (seconds >= 1e-6) return `${formatTimerValue(seconds * 1_000_000)} µs`;
    return `${formatTimerValue(seconds * 1_000_000_000)} ns`;
}
