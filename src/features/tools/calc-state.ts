import {
    solveOhmsLaw,
    toBaseVoltage,
    toBaseCurrent,
    toBaseResistance,
    toBasePower,
    fromBaseVoltage,
    fromBaseCurrent,
    fromBaseResistance,
    fromBasePower,
    formatOhmsLawValue,
    type OhmsLawField,
    type VoltageUnit,
    type CurrentUnit,
    type ResistanceUnit,
    type PowerUnit,
} from '@/lib/tools/ohms-law';
import {
    solveVoltageDivider,
    formatDividerValue,
    toBaseVoltage as dividerToBaseVoltage,
    toBaseResistance as dividerToBaseResistance,
    fromBaseVoltage as dividerFromBaseVoltage,
    fromBaseResistance as dividerFromBaseResistance,
    type DividerField,
    type VoltageUnit as DividerVoltageUnit,
    type ResistanceUnit as DividerResistanceUnit,
} from '@/lib/tools/voltage-divider';

/**
 * Screen-side calculator logic.
 *
 * The engines under `@/lib/tools` take numbers in base units; the screens hold
 * *strings* (a text field mid-edit is `"1."`, `""` or `"abc"`) plus a unit
 * picker. Everything between those two — parsing, deciding which field is an
 * input and which is a computed output, converting the answer back into the
 * user's chosen unit — lives here rather than in a component, because it is the
 * part that can actually be wrong and the part a Node test can reach.
 *
 * Results are derived on every keystroke. There is no "calculate" button: the
 * whole point of an instrument is that the readout tracks the input.
 */

/** `""`, `"."`, `"abc"` -> null. Accepts a comma as the decimal separator. */
export function parseNumericInput(input: string): number | null {
    const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
    if (!cleaned) return null;
    if (!/^\d*\.?\d*$/.test(cleaned)) return null;
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) && value > 0 ? value : null;
}

/* -------------------------------------------------------------- ohm's law */

export interface OhmsLawFieldState {
    value: string;
    unit: string;
}

export type OhmsLawState = Record<OhmsLawField, OhmsLawFieldState>;

export interface OhmsLawRow {
    field: OhmsLawField;
    /** Rendered value in the field's own unit. */
    display: string;
    /** True when the user typed it, false when the engine derived it. */
    isInput: boolean;
}

export interface OhmsLawResult {
    rows: OhmsLawRow[];
    formulas: string[];
    /** Set when fewer than two values are known, or the pair cannot solve. */
    error: 'needs_two' | 'invalid_combination' | null;
    /** Which fields the user supplied, in entry order-independent form. */
    inputs: OhmsLawField[];
}

const OHMS_FIELDS: OhmsLawField[] = ['voltage', 'current', 'resistance', 'power'];

function ohmsToBase(field: OhmsLawField, value: number, unit: string): number {
    if (field === 'voltage') return toBaseVoltage(value, unit as VoltageUnit);
    if (field === 'current') return toBaseCurrent(value, unit as CurrentUnit);
    if (field === 'resistance') return toBaseResistance(value, unit as ResistanceUnit);
    return toBasePower(value, unit as PowerUnit);
}

function ohmsFromBase(field: OhmsLawField, value: number, unit: string): number {
    if (field === 'voltage') return fromBaseVoltage(value, unit as VoltageUnit);
    if (field === 'current') return fromBaseCurrent(value, unit as CurrentUnit);
    if (field === 'resistance') return fromBaseResistance(value, unit as ResistanceUnit);
    return fromBasePower(value, unit as PowerUnit);
}

/**
 * Solve from the raw field state.
 *
 * Only the *first two* filled fields are fed to the engine. A user who fills a
 * third has over-constrained the system, and passing all three would let the
 * engine pick a pair arbitrarily and silently contradict one of the numbers on
 * screen. Taking the first two makes the extra field a derived readout instead,
 * which is what the surrounding UI already claims it is.
 */
export function solveOhmsLawState(state: OhmsLawState): OhmsLawResult {
    const parsed = OHMS_FIELDS.map(field => ({
        field,
        value: parseNumericInput(state[field].value),
        unit: state[field].unit,
    }));

    const filled = parsed.filter(entry => entry.value !== null);
    const inputs = filled.slice(0, 2).map(entry => entry.field);

    if (inputs.length < 2) {
        return {
            rows: parsed.map(entry => ({
                field: entry.field,
                display: entry.value === null ? '—' : formatOhmsLawValue(entry.value),
                isInput: entry.value !== null,
            })),
            formulas: [],
            error: 'needs_two',
            inputs,
        };
    }

    const known: Partial<Record<OhmsLawField, number>> = {};
    for (const entry of filled.slice(0, 2)) {
        known[entry.field] = ohmsToBase(entry.field, entry.value as number, entry.unit);
    }

    const solution = solveOhmsLaw(known);

    return {
        rows: parsed.map(entry => {
            const base = solution[entry.field];
            return {
                field: entry.field,
                display:
                    base === null
                        ? '—'
                        : formatOhmsLawValue(ohmsFromBase(entry.field, base, entry.unit)),
                isInput: inputs.includes(entry.field),
            };
        }),
        formulas: solution.formulas,
        error: solution.error ? 'invalid_combination' : null,
        inputs,
    };
}

export function initialOhmsLawState(): OhmsLawState {
    return {
        voltage: {value: '12', unit: 'V'},
        current: {value: '', unit: 'A'},
        resistance: {value: '100', unit: 'ohm'},
        power: {value: '', unit: 'W'},
    };
}

/* --------------------------------------------------------- voltage divider */

export type DividerState = Record<DividerField, {value: string; unit: string}>;

export interface DividerRow {
    field: DividerField;
    display: string;
    isInput: boolean;
}

export interface DividerResult {
    rows: DividerRow[];
    /** Divider current in amperes, or null. */
    currentAmps: number | null;
    formulas: string[];
    error: 'needs_three' | 'vout_exceeds_vin' | 'invalid_combination' | null;
}

const DIVIDER_FIELDS: DividerField[] = ['vin', 'r1', 'r2', 'vout'];

function dividerToBase(field: DividerField, value: number, unit: string): number {
    return field === 'vin' || field === 'vout'
        ? dividerToBaseVoltage(value, unit as DividerVoltageUnit)
        : dividerToBaseResistance(value, unit as DividerResistanceUnit);
}

function dividerFromBase(field: DividerField, value: number, unit: string): number {
    return field === 'vin' || field === 'vout'
        ? dividerFromBaseVoltage(value, unit as DividerVoltageUnit)
        : dividerFromBaseResistance(value, unit as DividerResistanceUnit);
}

/** Same "first N wins" rule as Ohm's law, with three knowns instead of two. */
export function solveDividerState(state: DividerState): DividerResult {
    const parsed = DIVIDER_FIELDS.map(field => ({
        field,
        value: parseNumericInput(state[field].value),
        unit: state[field].unit,
    }));

    const filled = parsed.filter(entry => entry.value !== null);
    const inputs = filled.slice(0, 3).map(entry => entry.field);

    const rowsFrom = (resolve: (field: DividerField) => number | null): DividerRow[] =>
        parsed.map(entry => {
            const base = resolve(entry.field);
            return {
                field: entry.field,
                display:
                    base === null
                        ? '—'
                        : formatDividerValue(dividerFromBase(entry.field, base, entry.unit)),
                isInput: inputs.includes(entry.field),
            };
        });

    if (inputs.length < 3) {
        const bases = new Map(
            parsed
                .filter(entry => entry.value !== null)
                .map(entry => [
                    entry.field,
                    dividerToBase(entry.field, entry.value as number, entry.unit),
                ]),
        );
        return {
            rows: rowsFrom(field => bases.get(field) ?? null),
            currentAmps: null,
            formulas: [],
            error: 'needs_three',
        };
    }

    const known: Partial<Record<DividerField, number>> = {};
    for (const entry of filled.slice(0, 3)) {
        known[entry.field] = dividerToBase(entry.field, entry.value as number, entry.unit);
    }

    const solution = solveVoltageDivider(known);

    return {
        rows: rowsFrom(field => solution[field]),
        currentAmps: solution.current,
        formulas: solution.formulas,
        error:
            solution.error === 'vout_exceeds_vin'
                ? 'vout_exceeds_vin'
                : solution.error
                  ? 'invalid_combination'
                  : null,
    };
}

export function initialDividerState(): DividerState {
    return {
        vin: {value: '12', unit: 'V'},
        r1: {value: '10', unit: 'kohm'},
        r2: {value: '10', unit: 'kohm'},
        vout: {value: '', unit: 'V'},
    };
}

/** Amperes -> the unit a bench meter would show. */
export function formatCurrent(amps: number | null): string {
    if (amps === null || !Number.isFinite(amps)) return '—';
    if (Math.abs(amps) >= 1) return `${formatDividerValue(amps)} A`;
    if (Math.abs(amps) >= 1e-3) return `${formatDividerValue(amps * 1_000)} mA`;
    return `${formatDividerValue(amps * 1_000_000)} µA`;
}
