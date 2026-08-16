export type OhmsLawField = 'voltage' | 'current' | 'resistance' | 'power';

export const VOLTAGE_UNITS = {
    mV: 0.001,
    V: 1,
    kV: 1_000,
} as const;

export const CURRENT_UNITS = {
    mA: 0.001,
    A: 1,
} as const;

export const RESISTANCE_UNITS = {
    ohm: 1,
    kohm: 1_000,
    Mohm: 1_000_000,
} as const;

export const POWER_UNITS = {
    mW: 0.001,
    W: 1,
    kW: 1_000,
} as const;

export type VoltageUnit = keyof typeof VOLTAGE_UNITS;
export type CurrentUnit = keyof typeof CURRENT_UNITS;
export type ResistanceUnit = keyof typeof RESISTANCE_UNITS;
export type PowerUnit = keyof typeof POWER_UNITS;

export interface OhmsLawValues {
    voltage: number | null;
    current: number | null;
    resistance: number | null;
    power: number | null;
}

export interface OhmsLawSolution extends OhmsLawValues {
    formulas: string[];
    error?: string;
}

function isPositive(value: number | null): value is number {
    return value !== null && Number.isFinite(value) && value > 0;
}

export function toBaseVoltage(value: number, unit: VoltageUnit): number {
    return value * VOLTAGE_UNITS[unit];
}

export function toBaseCurrent(value: number, unit: CurrentUnit): number {
    return value * CURRENT_UNITS[unit];
}

export function toBaseResistance(value: number, unit: ResistanceUnit): number {
    return value * RESISTANCE_UNITS[unit];
}

export function toBasePower(value: number, unit: PowerUnit): number {
    return value * POWER_UNITS[unit];
}

export function fromBaseVoltage(value: number, unit: VoltageUnit): number {
    return value / VOLTAGE_UNITS[unit];
}

export function fromBaseCurrent(value: number, unit: CurrentUnit): number {
    return value / CURRENT_UNITS[unit];
}

export function fromBaseResistance(value: number, unit: ResistanceUnit): number {
    return value / RESISTANCE_UNITS[unit];
}

export function fromBasePower(value: number, unit: PowerUnit): number {
    return value / POWER_UNITS[unit];
}

export function solveOhmsLaw(
    known: Partial<Record<OhmsLawField, number>>,
): OhmsLawSolution {
    const V = known.voltage ?? null;
    const I = known.current ?? null;
    const R = known.resistance ?? null;
    const P = known.power ?? null;

    const knownCount = [V, I, R, P].filter(isPositive).length;
    const formulas: string[] = [];

    if (knownCount < 2) {
        return {voltage: V, current: I, resistance: R, power: P, formulas};
    }

    let voltage = V;
    let current = I;
    let resistance = R;
    let power = P;

    if (isPositive(voltage) && isPositive(current)) {
        resistance = voltage / current;
        power = voltage * current;
        formulas.push('R = V / I', 'P = V × I');
    } else if (isPositive(voltage) && isPositive(resistance)) {
        current = voltage / resistance;
        power = (voltage * voltage) / resistance;
        formulas.push('I = V / R', 'P = V² / R');
    } else if (isPositive(voltage) && isPositive(power)) {
        current = power / voltage;
        resistance = (voltage * voltage) / power;
        formulas.push('I = P / V', 'R = V² / P');
    } else if (isPositive(current) && isPositive(resistance)) {
        voltage = current * resistance;
        power = current * current * resistance;
        formulas.push('V = I × R', 'P = I² × R');
    } else if (isPositive(current) && isPositive(power)) {
        voltage = power / current;
        resistance = power / (current * current);
        formulas.push('V = P / I', 'R = P / I²');
    } else if (isPositive(resistance) && isPositive(power)) {
        current = Math.sqrt(power / resistance);
        voltage = Math.sqrt(power * resistance);
        formulas.push('I = √(P / R)', 'V = √(P × R)');
    } else {
        return {
            voltage,
            current,
            resistance,
            power,
            formulas,
            error: 'invalid_combination',
        };
    }

    return {voltage, current, resistance, power, formulas};
}

export function formatOhmsLawValue(
    value: number | null,
    decimals = 4,
): string {
    if (value === null || !Number.isFinite(value)) return '—';
    if (value === 0) return '0';

    const abs = Math.abs(value);
    if (abs >= 1_000_000) return value.toExponential(3);
    if (abs < 0.001) return value.toExponential(3);
    return Number.parseFloat(value.toPrecision(decimals)).toString();
}
