import {useCallback, useMemo, useState} from 'react';
import type {z} from 'zod';
import {fieldErrors} from './schemas';

/**
 * Tiny form controller.
 *
 * react-hook-form is not a dependency and adding one for six forms is not
 * worth the bundle; this is the ~60 lines of it these screens actually use.
 *
 * The touched-field rule is the interesting part: a field shows its error only
 * after it has been blurred once or the form has been submitted, and from then
 * on it re-validates live so the error clears as soon as the input is fixed.
 * Erroring while someone is still typing their email trains them to ignore
 * red.
 */
export function useForm<TSchema extends z.ZodType, TValues extends Record<string, unknown>>(
    schema: TSchema,
    initialValues: TValues,
) {
    const [values, setValues] = useState<TValues>(initialValues);
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [submitted, setSubmitted] = useState(false);

    const allErrors = useMemo(
        () => fieldErrors(schema.safeParse(values) as never),
        [schema, values],
    );

    const errors = useMemo(() => {
        const visible: Record<string, string> = {};
        for (const [key, message] of Object.entries(allErrors)) {
            if (submitted || touched[key]) visible[key] = message;
        }
        return visible as Partial<Record<keyof TValues & string, string>>;
    }, [allErrors, submitted, touched]);

    const setValue = useCallback(<K extends keyof TValues & string>(key: K, value: TValues[K]) => {
        setValues(current => ({...current, [key]: value}));
    }, []);

    const blur = useCallback((key: keyof TValues & string) => {
        setTouched(current => ({...current, [key]: true}));
    }, []);

    const submit = useCallback((): z.infer<TSchema> | null => {
        setSubmitted(true);
        const result = schema.safeParse(values);
        return result.success ? (result.data as z.infer<TSchema>) : null;
    }, [schema, values]);

    const reset = useCallback(
        (next?: TValues) => {
            setValues(next ?? initialValues);
            setTouched({});
            setSubmitted(false);
        },
        [initialValues],
    );

    return {
        values,
        errors,
        setValue,
        blur,
        submit,
        reset,
        isValid: Object.keys(allErrors).length === 0,
    };
}
