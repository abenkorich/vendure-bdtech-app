import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {check, done} from './harness';

/**
 * The Android adaptive icon must stay inside the mask's safe zone.
 *
 * Android masks an adaptive icon to whatever shape the launcher uses (circle
 * on Pixel, squircle elsewhere) and only guarantees the centre 66% of the
 * canvas survives. Art outside that band is silently clipped: the build
 * succeeds, the resources generate, every other check passes, and the icon is
 * simply wrong on the home screen. That already happened once here — the chip
 * shipped with its pins cut off.
 *
 * A first fix cleared the boundary by one pixel out of 338, which is a
 * coincidence rather than a margin. This asserts real headroom.
 */

const SAFE_FRACTION = 0.66;
/** Leave room for rounding in the PNG -> webp conversion and tighter masks. */
const MAX_UTILISATION = 0.9;

interface Bounds {
    width: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/** Bounding box of non-transparent pixels in a non-interlaced RGBA8 PNG. */
function opaqueBounds(path: string): Bounds {
    const raw = readFileSync(path);

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    const idat: Buffer[] = [];

    while (offset < raw.length) {
        const length = raw.readUInt32BE(offset);
        const tag = raw.toString('ascii', offset + 4, offset + 8);
        const data = raw.subarray(offset + 8, offset + 8 + length);

        if (tag === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8]!;
            colorType = data[9]!;
            interlace = data[12]!;
        } else if (tag === 'IDAT') {
            idat.push(Buffer.from(data));
        }

        offset += 12 + length;
    }

    // The generator writes 8-bit RGBA, non-interlaced. Anything else would
    // need a real decoder, so fail loudly rather than mis-measure.
    if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(`unexpected PNG format: depth ${bitDepth}, color ${colorType}`);
    }

    const pixels = inflateSync(Buffer.concat(idat));
    const stride = width * 4 + 1;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y += 1) {
        // Byte 0 of each row is the filter type; the generator uses 0 (none).
        const filter = pixels[y * stride];
        if (filter !== 0) throw new Error(`unexpected PNG row filter ${filter}`);

        for (let x = 0; x < width; x += 1) {
            const alpha = pixels[y * stride + 1 + x * 4 + 3]!;
            if (alpha === 0) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    return {width, minX, minY, maxX, maxY};
}

export async function run(): Promise<void> {
    const path = join(process.cwd(), 'assets', 'adaptive-icon.png');
    const {width, minX, minY, maxX, maxY} = opaqueBounds(path);

    check('the icon is square', width > 0, `width ${width}`);
    check('the icon draws something', maxX > minX && maxY > minY, 'canvas is empty');

    const centre = width / 2;
    const corners: Array<[number, number]> = [
        [minX, minY],
        [minX, maxY],
        [maxX, minY],
        [maxX, maxY],
    ];
    const radius = Math.max(
        ...corners.map(([x, y]) => Math.hypot(x - centre, y - centre)),
    );
    const safeRadius = (width * SAFE_FRACTION) / 2;
    const utilisation = radius / safeRadius;

    check(
        'the drawn art stays within the adaptive-icon safe zone, with margin',
        utilisation <= MAX_UTILISATION,
        `art reaches ${radius.toFixed(0)}px of a ${safeRadius.toFixed(0)}px safe radius ` +
            `(${(utilisation * 100).toFixed(0)}%, limit ${MAX_UTILISATION * 100}%)`,
    );

    done();
}
