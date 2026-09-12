import {z} from 'zod';
import {translate} from '../account/i18n';
import {isValidEmail} from '@/lib/contact-details';
import {phoneFieldValidate, type CallingCountry} from '@/lib/phone-number';

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

/**
 * Sign-in takes an email *or* a mobile, because registration does: an account
 * created with a mobile and no address has no email to type here, and a field
 * that only accepts one would lock those customers out of their own accounts.
 * `normalizeLoginIdentifier` turns whichever they typed into the identifier
 * the account was created with.
 */
export const signInSchema = z.object({
    identifier: z
        .string()
        .trim()
        .min(1, {error: () => translate('Errors.emailRequired')})
        .superRefine((value, ctx) => {
            if (!value) return;
            const looksLikeEmail = value.includes('@');
            if (looksLikeEmail && !isValidEmail(value)) {
                ctx.addIssue({code: 'custom', message: translate('Auth.emailValidation')});
                return;
            }
            if (!looksLikeEmail && value.replace(/\D/g, '').length < 6) {
                ctx.addIssue({code: 'custom', message: translate('Auth.emailOrPhoneRequired')});
            }
        }),
    // Sign-in deliberately does *not* enforce the 8-character minimum: an
    // existing account may predate that rule, and rejecting it locally would
    // lock the user out of an account the server would happily accept.
    password: z.string().min(1, {error: () => translate('Auth.passwordRequired')}),
});

/* ------------------------------------------------------- contact details */

/**
 * The shape both the sign-up form and guest checkout collect: one name, a
 * mobile, an email, and the rule that **at least one way to reach the
 * customer** is present.
 *
 * Two things make this a factory rather than a constant. The country decides
 * what a valid mobile looks like, and it lives in component state; and the
 * either/or rule has to raise its message on *both* fields, so neither one
 * reads as "this field is wrong" when the truth is "fill in one of these".
 *
 * The web storefront applies the same rule (`register/registration-form.tsx`)
 * and the two must agree: a customer who signed up on the phone with a mobile
 * and no email has to be recognised by the website, and the other way round.
 */
export function contactFields(country: CallingCountry) {
    return {
        fullName: z.string().trim().min(1, {error: () => translate('Account.fullNameRequired')}),
        phone: z
            .string()
            .trim()
            .optional()
            .superRefine((value, ctx) => {
                const result = phoneFieldValidate(
                    country,
                    value,
                    {
                        required: translate('Auth.phoneRequired'),
                        format: translate('Auth.invalidPhone'),
                        pattern: translate('Auth.phonePatternError'),
                    },
                    true,
                );
                if (result !== true) ctx.addIssue({code: 'custom', message: result});
            }),
        email: z
            .string()
            .trim()
            .optional()
            .superRefine((value, ctx) => {
                if (!value) return;
                if (!isValidEmail(value)) {
                    ctx.addIssue({code: 'custom', message: translate('Auth.emailValidation')});
                }
            }),
    };
}

/** Raise "give us one of these" on both fields, or neither. */
function requireOneContact(
    values: {email?: string; phone?: string},
    ctx: z.RefinementCtx,
): void {
    const hasEmail = Boolean(values.email?.trim());
    const hasPhone = Boolean(values.phone?.trim());
    if (hasEmail || hasPhone) return;
    const message = translate('Auth.emailOrPhoneRequired');
    ctx.addIssue({code: 'custom', message, path: ['phone']});
    ctx.addIssue({code: 'custom', message, path: ['email']});
}

/** Guest checkout: contact details only, no credentials. */
export function createContactSchema(country: CallingCountry) {
    return z.object(contactFields(country)).superRefine(requireOneContact);
}

export function createRegisterSchema(country: CallingCountry) {
    return z
        .object({
            ...contactFields(country),
            password: passwordSchema,
            confirmPassword: z.string(),
        })
        .refine(values => values.password === values.confirmPassword, {
            path: ['confirmPassword'],
            message: translate('Auth.passwordsMismatch'),
        })
        .superRefine(requireOneContact);
}

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
