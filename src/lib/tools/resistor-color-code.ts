export type ResistorColorId =
    | 'black'
    | 'brown'
    | 'red'
    | 'orange'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'violet'
    | 'grey'
    | 'white'
    | 'gold'
    | 'silver';

export type BandCount = 4 | 5 | 6;

export interface ResistorColor {
    id: ResistorColorId;
    digit: number | null;
    multiplier: number | null;
    tolerancePercent: number | null;
    tempCoefPpm: number | null;
    hex: string;
    textColor: 'light' | 'dark';
}

export const RESISTOR_COLORS: Record<ResistorColorId, ResistorColor> = {
    black: {id: 'black', digit: 0, multiplier: 1, tolerancePercent: null, tempCoefPpm: null, hex: '#1a1a1a', textColor: 'light'},
    brown: {id: 'brown', digit: 1, multiplier: 10, tolerancePercent: 1, tempCoefPpm: 100, hex: '#8B4513', textColor: 'light'},
    red: {id: 'red', digit: 2, multiplier: 100, tolerancePercent: 2, tempCoefPpm: 50, hex: '#DC2626', textColor: 'light'},
    orange: {id: 'orange', digit: 3, multiplier: 1_000, tolerancePercent: null, tempCoefPpm: 15, hex: '#EA580C', textColor: 'dark'},
    yellow: {id: 'yellow', digit: 4, multiplier: 10_000, tolerancePercent: null, tempCoefPpm: 25, hex: '#EAB308', textColor: 'dark'},
    green: {id: 'green', digit: 5, multiplier: 100_000, tolerancePercent: 0.5, tempCoefPpm: null, hex: '#16A34A', textColor: 'light'},
    blue: {id: 'blue', digit: 6, multiplier: 1_000_000, tolerancePercent: 0.25, tempCoefPpm: 10, hex: '#2563EB', textColor: 'light'},
    violet: {id: 'violet', digit: 7, multiplier: 10_000_000, tolerancePercent: 0.1, tempCoefPpm: 5, hex: '#7C3AED', textColor: 'light'},
    grey: {id: 'grey', digit: 8, multiplier: 100_000_000, tolerancePercent: 0.05, tempCoefPpm: 1, hex: '#6B7280', textColor: 'light'},
    white: {id: 'white', digit: 9, multiplier: 1_000_000_000, tolerancePercent: null, tempCoefPpm: null, hex: '#F3F4F6', textColor: 'dark'},
    gold: {id: 'gold', digit: null, multiplier: 0.1, tolerancePercent: 5, tempCoefPpm: null, hex: '#D4AF37', textColor: 'dark'},
    silver: {id: 'silver', digit: null, multiplier: 0.01, tolerancePercent: 10, tempCoefPpm: null, hex: '#C0C0C0', textColor: 'dark'},
};

export const DIGIT_COLOR_IDS: ResistorColorId[] = [
    'black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white',
];

export const MULTIPLIER_COLOR_IDS: ResistorColorId[] = [...DIGIT_COLOR_IDS, 'gold', 'silver'];

export const TOLERANCE_COLOR_IDS: ResistorColorId[] = [
    'brown', 'red', 'green', 'blue', 'violet', 'grey', 'gold', 'silver',
];

export const TEMP_COEF_COLOR_IDS: ResistorColorId[] = [
    'brown', 'red', 'orange', 'yellow', 'blue', 'violet',
];

export interface BandSelection {
    digit?: ResistorColorId;
    multiplier?: ResistorColorId;
    tolerance?: ResistorColorId;
    tempCoef?: ResistorColorId;
}

export interface DecodeResult {
    ohms: number;
    formatted: string;
    exactOhms: string;
    tolerancePercent: number | null;
    minOhms: number | null;
    maxOhms: number | null;
    tempCoefPpm: number | null;
}

export function formatResistance(ohms: number): string {
    if (!Number.isFinite(ohms) || ohms <= 0) return '—';

    if (ohms >= 1_000_000_000) {
        return `${trimTrailingZeros(ohms / 1_000_000_000)}GΩ`;
    }
    if (ohms >= 1_000_000) {
        return `${trimTrailingZeros(ohms / 1_000_000)}MΩ`;
    }
    if (ohms >= 1_000) {
        return `${trimTrailingZeros(ohms / 1_000)}kΩ`;
    }
    if (ohms >= 1) {
        return `${trimTrailingZeros(ohms)}Ω`;
    }
    if (ohms >= 0.001) {
        return `${trimTrailingZeros(ohms * 1_000)}mΩ`;
    }
    return `${trimTrailingZeros(ohms)}Ω`;
}

function trimTrailingZeros(value: number): string {
    const fixed = value.toPrecision(4);
    return Number.parseFloat(fixed).toString();
}

export function formatExactOhms(ohms: number): string {
    if (!Number.isFinite(ohms)) return '—';
    return `${ohms.toLocaleString('en-US', {maximumFractionDigits: 2})} Ω`;
}

export function decodeResistor(
    bandCount: BandCount,
    bands: {
        digits: ResistorColorId[];
        multiplier: ResistorColorId;
        tolerance: ResistorColorId;
        tempCoef?: ResistorColorId;
    },
): DecodeResult | null {
    const digitCount = bandCount === 4 ? 2 : 3;
    if (bands.digits.length !== digitCount) return null;

    const digitValues = bands.digits.map((id) => RESISTOR_COLORS[id].digit);
    if (digitValues.some((d) => d === null)) return null;

    const multiplier = RESISTOR_COLORS[bands.multiplier].multiplier;
    if (multiplier === null) return null;

    const significand = Number(digitValues.join(''));
    const ohms = significand * multiplier;
    if (!Number.isFinite(ohms) || ohms <= 0) return null;

    const tolerancePercent = RESISTOR_COLORS[bands.tolerance].tolerancePercent;
    const tempCoefPpm = bandCount === 6 && bands.tempCoef
        ? RESISTOR_COLORS[bands.tempCoef].tempCoefPpm
        : null;

    let minOhms: number | null = null;
    let maxOhms: number | null = null;
    if (tolerancePercent !== null) {
        minOhms = ohms * (1 - tolerancePercent / 100);
        maxOhms = ohms * (1 + tolerancePercent / 100);
    }

    return {
        ohms,
        formatted: formatResistance(ohms),
        exactOhms: formatExactOhms(ohms),
        tolerancePercent,
        minOhms,
        maxOhms,
        tempCoefPpm,
    };
}

export function parseResistanceInput(input: string): number | null {
    const cleaned = input.trim().replace(/,/g, '').replace(/Ω|ohm|ohms/gi, '').trim();
    if (!cleaned) return null;

    const match = cleaned.match(/^([\d.]+)\s*([kKmMgG])?$/);
    if (!match) return null;

    const base = Number.parseFloat(match[1]);
    if (!Number.isFinite(base) || base <= 0) return null;

    const suffix = match[2]?.toLowerCase();
    const multipliers: Record<string, number> = {k: 1_000, m: 1_000_000, g: 1_000_000_000};
    return suffix ? base * (multipliers[suffix] ?? 1) : base;
}

export interface ReverseLookupResult {
    bandCount: BandCount;
    digits: ResistorColorId[];
    multiplier: ResistorColorId;
    tolerance: ResistorColorId;
    tempCoef?: ResistorColorId;
    ohms: number;
}

export function reverseLookupResistance(
    targetOhms: number,
    bandCount: BandCount = 4,
): ReverseLookupResult | null {
    if (!Number.isFinite(targetOhms) || targetOhms <= 0) return null;

    let best: ReverseLookupResult | null = null;
    let bestError = Infinity;

    for (const multiplierId of MULTIPLIER_COLOR_IDS) {
        const multiplier = RESISTOR_COLORS[multiplierId].multiplier;
        if (multiplier === null || multiplier <= 0) continue;

        const significand = targetOhms / multiplier;
        const digitCount = bandCount === 4 ? 2 : 3;
        const minSig = Math.pow(10, digitCount - 1);
        const maxSig = Math.pow(10, digitCount) - 1;

        if (significand < minSig || significand > maxSig) continue;

        const rounded = Math.round(significand);
        if (Math.abs(rounded - significand) > 0.001) continue;

        const digitStr = String(rounded).padStart(digitCount, '0');
        const digits = digitStr.split('').map((char) => {
            const digit = Number.parseInt(char, 10);
            return DIGIT_COLOR_IDS[digit];
        });

        const ohms = rounded * multiplier;
        const error = Math.abs(ohms - targetOhms) / targetOhms;

        for (const toleranceId of TOLERANCE_COLOR_IDS) {
            const candidate: ReverseLookupResult = {
                bandCount,
                digits,
                multiplier: multiplierId,
                tolerance: toleranceId,
                ohms,
            };

            if (bandCount === 6) {
                candidate.tempCoef = 'brown';
            }

            if (error < bestError) {
                bestError = error;
                best = candidate;
            }
        }
    }

    return best;
}

export function getDefaultBands(bandCount: BandCount): {
    digits: ResistorColorId[];
    multiplier: ResistorColorId;
    tolerance: ResistorColorId;
    tempCoef?: ResistorColorId;
} {
    const digits: ResistorColorId[] =
        bandCount === 4
            ? ['brown', 'black']
            : ['brown', 'black', 'black'];

    return {
        digits,
        multiplier: 'red',
        tolerance: 'gold',
        ...(bandCount === 6 ? {tempCoef: 'brown' as ResistorColorId} : {}),
    };
}

export const REFERENCE_TABLE_ROWS = [
    ...DIGIT_COLOR_IDS.map((colorId) => ({
        ...RESISTOR_COLORS[colorId],
        roles: ['digit', 'multiplier'] as const,
    })),
    {
        ...RESISTOR_COLORS.gold,
        roles: ['multiplier', 'tolerance'] as const,
    },
    {
        ...RESISTOR_COLORS.silver,
        roles: ['multiplier', 'tolerance'] as const,
    },
];
