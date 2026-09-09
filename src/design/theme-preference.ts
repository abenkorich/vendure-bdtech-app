import {prefsStorage} from '@/lib/storage/mmkv';

/**
 * The colour scheme the shopper chose, if they chose one.
 *
 * `system` is the default and means "follow the OS", which is what the app
 * ships with: overriding someone's system preference uninvited is the kind of
 * thing that gets an app uninstalled. Once they tap the switch they have made
 * a choice, and it sticks across launches.
 *
 * Deliberately free of any Unistyles import: this is read from
 * `design/unistyles.ts` while it configures the runtime, and a cycle there
 * would run before a theme exists.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'app.theme';

export function readThemePreference(): ThemePreference {
    try {
        const stored = prefsStorage().getString(KEY);
        return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
        // Storage unavailable on this launch; following the OS is the safe
        // answer, and the next write will persist normally.
        return 'system';
    }
}

export function writeThemePreference(preference: ThemePreference): void {
    try {
        prefsStorage().set(KEY, preference);
    } catch {
        // The choice still applies to this session; only persistence is lost.
    }
}
