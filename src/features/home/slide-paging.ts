/**
 * Slide index <-> scroll offset for a paged horizontal carousel.
 *
 * Kept out of the component because it is the part that was wrong and the part
 * a screenshot cannot check: a horizontal `ScrollView` mirrors itself under
 * RTL, so slide 0 sits at the *right* and its offset is the far end of the
 * content rather than 0. The component multiplied index by width regardless,
 * which walked Arabic users backwards through the slides.
 */

export function slideOffset(index: number, count: number, width: number, isRTL: boolean): number {
    const lastIndex = Math.max(count - 1, 0);
    return (isRTL ? lastIndex - index : index) * width;
}

export function slideIndex(offset: number, count: number, width: number, isRTL: boolean): number {
    if (width <= 0) return 0;
    const lastIndex = Math.max(count - 1, 0);
    const position = Math.round(offset / width);
    return isRTL ? lastIndex - position : position;
}
