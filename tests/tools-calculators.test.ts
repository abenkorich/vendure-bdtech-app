import assert from 'node:assert/strict';
import {
    parseNumericInput,
    solveOhmsLawState,
    solveDividerState,
    initialOhmsLawState,
    initialDividerState,
    formatCurrent,
} from '../src/features/tools/calc-state';
import {decodeResistor, formatResistance, reverseLookupResistance} from '../src/lib/tools/resistor-color-code';
import {decodeSmdCode, encodeResistanceToSmdCodes} from '../src/lib/tools/smd-code';
import {calculateEquivalentResistance} from '../src/lib/tools/series-parallel';
import {calculateAstable, calculateMonostable, formatFrequency, formatTime} from '../src/lib/tools/555-timer';
import {TOOL_REGISTRY} from '../src/lib/tools/registry';
import {TOOL_NAMESPACE} from '../src/lib/tools/namespaces';
/**
 * `4R7` support, mirroring the marking convention the engines do not cover.
 * Lives in a feature module rather than the lib because `src/lib/tools/**` is a
 * copy kept diffable against the web storefront (AGENTS.md rule 1); the screen
 * imports this same helper.
 */
import {decodeRDecimal} from '../src/features/tools/smd-r-notation';
import en from '../messages/en.json';

/**
 * The calculators are the whole point of the tools feature, and a wrong answer
 * that *looks* like a number is the failure mode that ships. So the three
 * hand-checked reference cases from the brief are asserted literally here,
 * alongside the screen-side glue (`calc-state`) that sits between a text field
 * and the engines.
 *
 * The engines themselves are ported and were already correct; what is new and
 * therefore tested is unit conversion round-tripping and the "first N filled
 * fields win" rule, which is the logic that decides what the readout means.
 */

function checkParsing(): void {
    assert.equal(parseNumericInput('12'), 12);
    assert.equal(parseNumericInput(' 4.7 '), 4.7);
    // A comma decimal separator is what a French or Arabic keyboard produces.
    assert.equal(parseNumericInput('4,7'), 4.7);
    assert.equal(parseNumericInput(''), null);
    assert.equal(parseNumericInput('.'), null);
    assert.equal(parseNumericInput('abc'), null);
    assert.equal(parseNumericInput('-5'), null, 'negative resistance is not a thing');
    assert.equal(parseNumericInput('0'), null, 'zero would divide by zero downstream');
    // Mid-edit states must not throw or produce garbage.
    assert.equal(parseNumericInput('1.'), 1);
}

/** Reference case: 12 V across 100 Ω = 0.12 A and 1.44 W. */
function checkOhmsLawReference(): void {
    const result = solveOhmsLawState(initialOhmsLawState());
    const by = Object.fromEntries(result.rows.map(row => [row.field, row]));

    assert.equal(result.error, null);
    assert.equal(by.voltage.display, '12');
    assert.equal(by.resistance.display, '100');
    assert.equal(by.current.display, '0.12', 'I = V/R = 12/100');
    assert.equal(by.power.display, '1.44', 'P = V²/R = 144/100');
    assert.equal(by.voltage.isInput, true);
    assert.equal(by.current.isInput, false);
    assert.deepEqual(result.formulas, ['I = V / R', 'P = V² / R']);
}

function checkOhmsLawUnits(): void {
    // Same circuit expressed in mA and kΩ: 12 V / 0.1 kΩ = 120 mA, 1.44 W.
    const result = solveOhmsLawState({
        voltage: {value: '12', unit: 'V'},
        current: {value: '', unit: 'mA'},
        resistance: {value: '0.1', unit: 'kohm'},
        power: {value: '', unit: 'mW'},
    });
    const by = Object.fromEntries(result.rows.map(row => [row.field, row]));
    assert.equal(by.current.display, '120');
    assert.equal(by.power.display, '1440');

    // Input given in mA converts on the way in, too: 120 mA × 100 Ω = 12 V.
    const reverse = solveOhmsLawState({
        voltage: {value: '', unit: 'V'},
        current: {value: '120', unit: 'mA'},
        resistance: {value: '100', unit: 'ohm'},
        power: {value: '', unit: 'W'},
    });
    const rby = Object.fromEntries(reverse.rows.map(row => [row.field, row]));
    assert.equal(rby.voltage.display, '12');
    assert.equal(rby.power.display, '1.44');
}

function checkOhmsLawUnderConstrained(): void {
    const result = solveOhmsLawState({
        voltage: {value: '12', unit: 'V'},
        current: {value: '', unit: 'A'},
        resistance: {value: '', unit: 'ohm'},
        power: {value: '', unit: 'W'},
    });
    assert.equal(result.error, 'needs_two');
    // The one value the user typed must still be echoed, not blanked.
    assert.equal(result.rows.find(row => row.field === 'voltage')?.display, '12');
    assert.equal(result.rows.find(row => row.field === 'power')?.display, '—');
}

function checkOhmsLawOverConstrained(): void {
    // Three fields filled: the first two win and the third becomes a readout,
    // rather than the engine silently choosing a different pair.
    const result = solveOhmsLawState({
        voltage: {value: '12', unit: 'V'},
        current: {value: '2', unit: 'A'},
        resistance: {value: '999', unit: 'ohm'},
        power: {value: '', unit: 'W'},
    });
    assert.deepEqual(result.inputs, ['voltage', 'current']);
    assert.equal(result.rows.find(row => row.field === 'resistance')?.display, '6');
    assert.equal(result.rows.find(row => row.field === 'power')?.display, '24');
}

/** Reference case: 4-band brown-black-red-gold = 1 kΩ ±5%. */
function checkResistorReference(): void {
    const result = decodeResistor(4, {
        digits: ['brown', 'black'],
        multiplier: 'red',
        tolerance: 'gold',
    });

    assert.ok(result, 'brown-black-red-gold must decode');
    assert.equal(result.ohms, 1000, '10 × 100 = 1000 Ω');
    assert.equal(result.formatted, '1kΩ');
    assert.equal(result.tolerancePercent, 5);
    assert.equal(result.minOhms, 950);
    assert.equal(result.maxOhms, 1050);
    assert.equal(result.tempCoefPpm, null, '4-band carries no temp coefficient');
}

function checkResistorFiveAndSix(): void {
    // 5-band brown-black-black-brown-brown = 100 × 10 = 1 kΩ ±1%.
    const five = decodeResistor(5, {
        digits: ['brown', 'black', 'black'],
        multiplier: 'brown',
        tolerance: 'brown',
    });
    assert.equal(five?.ohms, 1000);
    assert.equal(five?.tolerancePercent, 1);

    const six = decodeResistor(6, {
        digits: ['brown', 'black', 'black'],
        multiplier: 'brown',
        tolerance: 'brown',
        tempCoef: 'red',
    });
    assert.equal(six?.tempCoefPpm, 50, 'red = 50 ppm/K');

    // A digit band can never be gold, and the engine must refuse rather than
    // produce NaN — the band pickers rely on this to stay honest.
    assert.equal(
        decodeResistor(4, {digits: ['gold', 'black'], multiplier: 'red', tolerance: 'gold'}),
        null,
    );
}

function checkResistorReverseLookup(): void {
    const found = reverseLookupResistance(4700, 4);
    assert.ok(found);
    assert.deepEqual(found.digits, ['yellow', 'violet'], '47 -> yellow, violet');
    assert.equal(found.multiplier, 'red', '×100');
    assert.equal(formatResistance(found.ohms), '4.7kΩ');
}

/** Reference cases: SMD "103" = 10 kΩ; "4R7" = 4.7 Ω. */
function checkSmdReference(): void {
    const three = decodeSmdCode('103', '3digit');
    assert.equal(three?.ohms, 10_000, '10 × 10³');
    assert.equal(three?.formatted, '10kΩ');

    // "4R7" uses R as the decimal point. The ported engine's 3-digit branch is
    // numeric-only, so this documents where that notation is actually handled:
    // it is a distinct marking, and the UI must not claim it decodes as 3-digit.
    assert.equal(decodeSmdCode('4R7', '3digit')?.error, 'invalid_code');
    assert.equal(decodeRDecimal('4R7'), 4.7, 'R-notation decodes to 4.7 Ω');
    assert.equal(formatResistance(decodeRDecimal('4R7') as number), '4.7Ω');
    assert.equal(decodeRDecimal('R47'), 0.47);
    assert.equal(decodeRDecimal('47R'), 47);
    assert.equal(decodeRDecimal('103'), null, 'plain digits are not R-notation');

    // 4-digit and EIA-96.
    assert.equal(decodeSmdCode('1001', '4digit')?.ohms, 1000);
    assert.equal(decodeSmdCode('01A', 'eia96')?.ohms, 1000, 'code 01 = 100, A = ×10');

    const codes = encodeResistanceToSmdCodes('10k', '3digit');
    assert.ok(codes.some(match => match.code === '103'), '10k must encode back to 103');
}

function checkSeriesParallel(): void {
    const series = calculateEquivalentResistance(
        [
            {value: 1, unit: 'kohm'},
            {value: 2.2, unit: 'kohm'},
        ],
        'series',
    );
    assert.equal(series.equivalentOhms, 3200);

    // Two equal resistors in parallel halve.
    const parallel = calculateEquivalentResistance(
        [
            {value: 10, unit: 'kohm'},
            {value: 10, unit: 'kohm'},
        ],
        'parallel',
    );
    assert.equal(parallel.equivalentOhms, 5000);

    // An empty or blank row must not poison the result.
    const withBlank = calculateEquivalentResistance(
        [
            {value: 1, unit: 'kohm'},
            {value: 0, unit: 'kohm'},
        ],
        'series',
    );
    assert.equal(withBlank.equivalentOhms, 1000);
    assert.equal(calculateEquivalentResistance([], 'series').equivalentOhms, null);
}

function checkVoltageDivider(): void {
    // 12 V, 10k / 10k -> 6 V, 600 µA.
    const result = solveDividerState(initialDividerState());
    const by = Object.fromEntries(result.rows.map(row => [row.field, row]));
    assert.equal(result.error, null);
    assert.equal(by.vout.display, '6');
    assert.ok(result.currentAmps !== null);
    assert.equal(formatCurrent(result.currentAmps), '600 µA');

    // Solving for R2 instead: 12 V in, 3 V out, R1 = 10k -> R2 = 3.333k.
    const forR2 = solveDividerState({
        vin: {value: '12', unit: 'V'},
        r1: {value: '10', unit: 'kohm'},
        r2: {value: '', unit: 'kohm'},
        vout: {value: '3', unit: 'V'},
    });
    assert.equal(forR2.rows.find(row => row.field === 'r2')?.display, '3.333');

    // Vout above Vin is physically impossible and must say so.
    const impossible = solveDividerState({
        vin: {value: '5', unit: 'V'},
        r1: {value: '10', unit: 'kohm'},
        r2: {value: '', unit: 'kohm'},
        vout: {value: '9', unit: 'V'},
    });
    assert.equal(impossible.error, 'vout_exceeds_vin');

    assert.equal(
        solveDividerState({
            vin: {value: '12', unit: 'V'},
            r1: {value: '', unit: 'kohm'},
            r2: {value: '', unit: 'kohm'},
            vout: {value: '', unit: 'V'},
        }).error,
        'needs_three',
    );
}

function check555(): void {
    // Classic 1 Hz-ish blinker: R1 = 10k, R2 = 10k, C = 10 µF.
    // f = 1.44 / ((10k + 20k) × 10µ) = 4.8 Hz, duty = 20/30 = 66.67%.
    const astable = calculateAstable({
        r1: 10,
        r1Unit: 'kohm',
        r2: 10,
        r2Unit: 'kohm',
        c: 10,
        cUnit: 'uF',
    });
    assert.ok(astable.frequencyHz !== null);
    assert.ok(Math.abs(astable.frequencyHz - 4.8) < 1e-9, `got ${astable.frequencyHz}`);
    assert.equal(formatFrequency(astable.frequencyHz), '4.8 Hz');
    assert.ok(Math.abs((astable.dutyCyclePercent as number) - 200 / 3) < 1e-9);

    // Monostable: t = 1.1 × 100k × 10µF = 1.1 s.
    const mono = calculateMonostable({r: 100, rUnit: 'kohm', c: 10, cUnit: 'uF'});
    assert.ok(Math.abs((mono.pulseWidthSeconds as number) - 1.1) < 1e-9);
    assert.equal(formatTime(mono.pulseWidthSeconds), '1.1 s');

    // A blank capacitor must yield no reading rather than Infinity.
    assert.equal(
        calculateAstable({r1: 10, r1Unit: 'kohm', r2: 10, r2Unit: 'kohm', c: 0, cUnit: 'uF'})
            .frequencyHz,
        null,
    );
}

/**
 * Every tool the hub renders must have a namespace and a full message block,
 * or the screen shows a raw key path where its title should be. This is the
 * cheap guard for the `555-timer` -> `timer555` mapping in particular.
 */
function checkToolMessages(): void {
    const tools = (en as Record<string, any>).Tools;

    for (const tool of TOOL_REGISTRY) {
        const namespace = TOOL_NAMESPACE[tool.slug as keyof typeof TOOL_NAMESPACE];
        assert.ok(namespace, `${tool.slug} has no message namespace`);
        assert.ok(!/^\d/.test(namespace), `${namespace} may not start with a digit`);

        const hub = tools.tools[tool.slug];
        assert.ok(hub?.title, `Tools.tools.${tool.slug}.title missing`);
        assert.ok(hub?.description, `Tools.tools.${tool.slug}.description missing`);

        for (const key of tool.featureKeys) {
            assert.ok(hub.features?.[key], `Tools.tools.${tool.slug}.features.${key} missing`);
        }

        const page = tools[namespace];
        assert.ok(page?.title, `Tools.${namespace}.title missing`);
        assert.ok(page?.description, `Tools.${namespace}.description missing`);
    }

    assert.equal(TOOL_NAMESPACE['555-timer'], 'timer555');
}

export async function run(): Promise<void> {
    checkParsing();
    checkOhmsLawReference();
    checkOhmsLawUnits();
    checkOhmsLawUnderConstrained();
    checkOhmsLawOverConstrained();
    checkResistorReference();
    checkResistorFiveAndSix();
    checkResistorReverseLookup();
    checkSmdReference();
    checkSeriesParallel();
    checkVoltageDivider();
    check555();
    checkToolMessages();
}
