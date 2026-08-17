import {useEffect, useRef, useState} from 'react';

/**
 * Debounced mirror of a value.
 *
 * The input itself is **never** debounced — `value` is React state updated on
 * every keystroke so the field stays perfectly responsive — only the copy the
 * query key is built from lags behind. Debouncing the field instead is the
 * classic mistake that makes typing feel like it is fighting the user.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
    const [debounced, setDebounced] = useState(value);
    const first = useRef(true);

    useEffect(() => {
        // First value is what the screen mounts with (usually empty, or a term
        // restored from a link); waiting 250ms to adopt it would show the
        // start state for a beat before the results it already has.
        if (first.current) {
            first.current = false;
            setDebounced(value);
            return;
        }

        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}
