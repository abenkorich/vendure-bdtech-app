import {Text} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {isCaptchaRequired, type CaptchaAction} from '@/lib/vendure/captcha';
import {useCaptcha} from './captcha';

/**
 * The reCAPTCHA attribution.
 *
 * Google allows the badge to be hidden — which it must be here, since the
 * bridge web view is one pixel — only if the surface shows this notice
 * instead. Rendered only when the backend actually gates this action, so a
 * shop with captcha switched off does not claim protection it lacks.
 */
export function CaptchaNotice({action}: {action: CaptchaAction}) {
    const {config} = useCaptcha();
    const t = useTranslations('Auth');

    if (!isCaptchaRequired(config, action)) return null;

    return (
        <Text variant="micro" color="textMuted" align="center">
            {t('recaptchaNotice')}
        </Text>
    );
}
