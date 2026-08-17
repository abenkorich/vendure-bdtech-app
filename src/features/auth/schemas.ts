import {z} from 'zod';
import {translate} from '../account/i18n';

/**
 * Form schemas.
 *
 * Messages are catalog key paths resolved at validation time, so an error
 * renders in the user's language rather than English. Every message below
 * already exists in all three catalogs — no new keys, so the parity test is
 * unaffected.
 *
 * Validation runs on submit and then live per-field once a field has been
 * touched. Validating on every keystroke from the first character means the
 * email field is red before it can possibly be valid, which trains people to
 * ignore the error color.
 */

export const emailSchema = z
    .string()
    .trim()
    .min(1, {error: () => translate('Errors.emailRequired')})
    .email({error: () => translate('Auth.emailValidation')});

export const passwordSchema = z
    .string()
    .min(1, {error: () => translate('Auth.passwordRequired')})
    .min(8, {error: () => translate('Auth.passwordMinLength')});

export const signInSchema = z.object({
    email: emailSchema,
    // Sign-in deliberately does *not* enforce the 8-character minimum: an
    // existing account may predate that rule, and rejecting it locally would
    // lock the user out of an account the server would happily accept.
    password: z.string().min(1, {error: () => translate('Auth.passwordRequired')}),
});

export const registerSchema = z
    .object({
        firstName: z.string().trim().min(1, {error: () => translate('Errors.firstLastNameRequired')}),
        lastName: z.string().trim().min(1, {error: () => translate('Errors.firstLastNameRequired')}),
        email: emailSchema,
        phoneNumber: z.string().trim().optional(),
        password: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine(values => values.password === values.confirmPassword, {
        path: ['confirmPassword'],
        message: translate('Auth.passwordsMismatch'),
    });

export const forgotPasswordSchema = z.object({email: emailSchema});

export const resetPasswordSchema = z
    .object({
        password: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine(values => values.password === values.confirmPassword, {
        path: ['confirmPassword'],
        message: translate('Auth.passwordsMismatch'),
    });

export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, {error: () => translate('Auth.passwordRequired')}),
        password: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine(values => values.password === values.confirmPassword, {
        path: ['confirmPassword'],
        message: translate('Auth.passwordsMismatch'),
    })
    .refine(values => values.password !== values.currentPassword, {
        path: ['password'],
        message: translate('Errors.newPasswordMustDiffer'),
    });

export const profileSchema = z.object({
    firstName: z.string().trim().min(1, {error: () => translate('Errors.firstLastNameRequired')}),
    lastName: z.string().trim().min(1, {error: () => translate('Errors.firstLastNameRequired')}),
    phoneNumber: z.string().trim().optional(),
});

export const addressSchema = z.object({
    fullName: z.string().trim().min(1, {error: () => translate('Account.fullNameRequired')}),
    company: z.string().trim().optional(),
    streetLine1: z.string().trim().min(1, {error: () => translate('Account.streetRequired')}),
    streetLine2: z.string().trim().optional(),
    city: z.string().trim().min(1, {error: () => translate('Account.cityRequired')}),
    province: z.string().trim().min(1, {error: () => translate('Account.stateProvinceRequired')}),
    postalCode: z.string().trim().min(1, {error: () => translate('Account.postalCodeRequired')}),
    countryCode: z.string().trim().min(1, {error: () => translate('Account.countryRequired')}),
    phoneNumber: z.string().trim().min(1, {error: () => translate('Account.phoneRequired')}),
});

/** Field-keyed errors from a zod parse, for direct use as form state. */
export function fieldErrors<T>(result: z.ZodSafeParseResult<T>): Record<string, string> {
    if (result.success) return {};
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '_');
        errors[key] ??= issue.message;
    }
    return errors;
}
