import {readFileSync, existsSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {check, done} from './harness';

/**
 * The collection card's gradient scrim must actually darken the photo.
 *
 * This exists because "I looked at the screenshot and it seemed fine" is not
 * evidence. `expo-linear-gradient` is a native module: if it fails to link, or
 * a future refactor drops the `<LinearGradient>`, the card still renders — the
 * photo and the label both appear — and the only symptom is white text on a
 * pale product photo, which is easy to miss on the dark images and invisible
 * in a code review.
 *
 * So this measures the pixels. It reads a device screenshot and asserts the
 * bottom of a card (where the label sits) is materially darker than the top.
 *
 * The bands are committed as fixtures, cropped from real device screenshots.
 * They used to be read from `/tmp`, which meant the test quietly measured
 * nothing once those files aged out — it reported PASS with no screenshots at
 * all, which I only noticed by deleting them and watching it still pass. A
 * check that cannot fail is worse than no check, so the inputs now live in the
 * repo and a missing one is an error rather than a skip.
 */

/**
 * Bands are relative to the committed crops, not the full screenshots:
 * scrim-ios.png is x 60-430, y 990-1270 of the iPhone shot; scrim-android.png
 * is x 60-420, y 920-1095 of the Pixel one.
 */
const SHOTS = [
    {name: 'iOS', path: 'tests/fixtures/scrim-ios.png', x0: 0, x1: 370, top: [10, 90], bottom: [210, 272]},
    {name: 'Android', path: 'tests/fixtures/scrim-android.png', x0: 0, x1: 360, top: [10, 60], bottom: [120, 165]},
] as const;

/** Minimum luma drop from a card's top band to its label band. */
const MIN_DARKENING = 12;

interface Bitmap {
    width: number;
    height: number;
    bpp: number;
    pixels: Buffer;
}

/** Decode a non-interlaced 8-bit PNG, undoing the per-row filters. */
function decodePng(path: string): Bitmap {
    const raw = readFileSync(path);
    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 6;
    const idat: Buffer[] = [];

    while (offset < raw.length) {
        const length = raw.readUInt32BE(offset);
        const tag = raw.toString('ascii', offset + 4, offset + 8);
        const data = raw.subarray(offset + 8, offset + 8 + length);
        if (tag === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            colorType = data[9]!;
        } else if (tag === 'IDAT') {
            idat.push(Buffer.from(data));
        }
        offset += 12 + length;
    }

    const bpp = colorType === 6 ? 4 : 3;
    const encoded = inflateSync(Buffer.concat(idat));
    const stride = width * bpp + 1;
    const pixels = Buffer.alloc(width * height * bpp);
    let prev = Buffer.alloc(width * bpp);

    for (let y = 0; y < height; y += 1) {
        const filter = encoded[y * stride]!;
        const line = Buffer.from(encoded.subarray(y * stride + 1, (y + 1) * stride));

        for (let x = 0; x < line.length; x += 1) {
            const a = x >= bpp ? line[x - bpp]! : 0;
            const b = prev[x]!;
            const c = x >= bpp ? prev[x - bpp]! : 0;

            if (filter === 1) line[x] = (line[x]! + a) & 255;
            else if (filter === 2) line[x] = (line[x]! + b) & 255;
            else if (filter === 3) line[x] = (line[x]! + ((a + b) >> 1)) & 255;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                line[x] = (line[x]! + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
            }
        }

        line.copy(pixels, y * width * bpp);
        prev = line;
    }

    return {width, height, bpp, pixels};
}

function meanLuma(bmp: Bitmap, x0: number, x1: number, y0: number, y1: number): number {
    let total = 0;
    let count = 0;
    for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 3) {
            const i = (y * bmp.width + x) * bmp.bpp;
            total += 0.2126 * bmp.pixels[i]! + 0.7152 * bmp.pixels[i + 1]! + 0.0722 * bmp.pixels[i + 2]!;
            count += 1;
        }
    }
    return count > 0 ? total / count : 0;
}

export async function run(): Promise<void> {
    let checked = 0;

    for (const shot of SHOTS) {
        check(`${shot.name}: the scrim fixture is present`, existsSync(shot.path), shot.path);
        if (!existsSync(shot.path)) continue;
        checked += 1;

        const bmp = decodePng(shot.path);
        const top = meanLuma(bmp, shot.x0, shot.x1, shot.top[0], shot.top[1]);
        const bottom = meanLuma(bmp, shot.x0, shot.x1, shot.bottom[0], shot.bottom[1]);
        const darkening = top - bottom;

        check(
            `${shot.name}: the card scrim darkens the label area`,
            darkening >= MIN_DARKENING,
            `top ${top.toFixed(1)}, bottom ${bottom.toFixed(1)}, darkening ${darkening.toFixed(1)} ` +
                `(need >= ${MIN_DARKENING}); a near-zero value means LinearGradient did not render`,
        );
    }

    check('both scrim fixtures were measured', checked === SHOTS.length, `measured ${checked}`);

    done();
}
