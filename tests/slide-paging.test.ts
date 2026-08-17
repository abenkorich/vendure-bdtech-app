import {slideOffset, slideIndex} from '@/features/home/slide-paging';
import {check, eq, done} from './harness';

/**
 * The hero carousel must advance *forwards* in Arabic.
 *
 * A horizontal `ScrollView` mirrors itself under RTL, so slide 0 sits at the
 * right and its offset is the far end of the content, not 0. The component
 * multiplied index by width regardless, so autoplay scrolled Arabic users
 * away from the next slide and the dots tracked the wrong one.
 *
 * I found that by noticing a screenshot caught mid-autoplay with two slides
 * visible at once — which is luck, not a method. Offsets are arithmetic, so
 * they can be checked directly.
 */

const WIDTH = 400;
const COUNT = 3;

export async function run(): Promise<void> {
    // LTR: unchanged, first slide at the origin.
    eq('LTR slide 0 sits at offset 0', slideOffset(0, COUNT, WIDTH, false), 0);
    eq('LTR slide 2 sits at the far end', slideOffset(2, COUNT, WIDTH, false), 800);

    // RTL: the first slide is the *rightmost*, so it has the largest offset.
    eq('RTL slide 0 sits at the far end', slideOffset(0, COUNT, WIDTH, true), 800);
    eq('RTL slide 2 sits at offset 0', slideOffset(2, COUNT, WIDTH, true), 0);

    // The bug in one assertion: advancing 0 -> 1 must move towards the start
    // of the scroll content under RTL, not away from it.
    check(
        'RTL advancing to the next slide decreases the offset',
        slideOffset(1, COUNT, WIDTH, true) < slideOffset(0, COUNT, WIDTH, true),
        `${slideOffset(1, COUNT, WIDTH, true)} vs ${slideOffset(0, COUNT, WIDTH, true)}`,
    );

    // Round trip: whatever the user lands on must report its own index, or the
    // dots and the autoplay cursor drift apart.
    for (const isRTL of [false, true]) {
        for (let index = 0; index < COUNT; index += 1) {
            eq(
                `${isRTL ? 'RTL' : 'LTR'} index ${index} round-trips`,
                slideIndex(slideOffset(index, COUNT, WIDTH, isRTL), COUNT, WIDTH, isRTL),
                index,
            );
        }
    }

    // Width is 0 on the first paint, before layout. Dividing by it produced
    // NaN, which silently poisons the index.
    eq('a zero width does not produce NaN', slideIndex(0, COUNT, 0, false), 0);

    done();
}
