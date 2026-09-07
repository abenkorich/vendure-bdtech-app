import {useEffect, useState} from 'react';
import {Image} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import {StyleSheet} from 'react-native-unistyles';

/**
 * The boot overlay: the wordmark, beating, until the app has something to
 * show.
 *
 * A native splash cannot animate, so the handover is arranged to be
 * invisible: the native splash and this overlay draw the same logo at the
 * same size on the same background (`app.config.ts` keeps the colours equal
 * to the theme's), the native one is held until this has painted, and only
 * then released. From there the logo beats — two quick pulses and a rest,
 * a heartbeat rather than a throb — and the overlay fades once `ready` is
 * true, never before `MIN_VISIBLE_MS` so a fast launch still reads as a
 * deliberate moment rather than a flash.
 */

// Held here, at module scope, so it runs before the first render of anything
// that imports this file. The root layout imports it first.
void SplashScreen.preventAutoHideAsync().catch(() => {
    // Already hidden (a reload in development). Nothing to hold.
});

export interface BootSplashProps {
    /** True once the first screen has data to stand on. */
    ready: boolean;
}

const LOGO = require('../../../assets/splash-logo.png');
/** Matches `imageWidth` in app.config.ts; the wordmark asset is 800×298. */
const LOGO_WIDTH = 200;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 298) / 800);
const MIN_VISIBLE_MS = 1100;
const FADE_MS = 380;

export function BootSplash({ready}: BootSplashProps) {
    const [mounted, setMounted] = useState(true);
    const [minElapsed, setMinElapsed] = useState(false);
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const [logoShown, setLogoShown] = useState(false);

    useEffect(() => {
        // Release the native splash only once the logo is actually on screen:
        // in a development build the asset is fetched from Metro and can lag
        // the first frame by a second, which showed as a blank white beat.
        // A release build has it bundled and `onLoad` fires at once. The
        // timeout is the safety net for an asset that never loads.
        if (logoShown) {
            void SplashScreen.hideAsync().catch(() => {});
            return;
        }
        const safety = setTimeout(() => setLogoShown(true), 1500);
        return () => clearTimeout(safety);
    }, [logoShown]);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.12, {duration: 130, easing: Easing.out(Easing.quad)}),
                withTiming(1, {duration: 150, easing: Easing.in(Easing.quad)}),
                withTiming(1.07, {duration: 120, easing: Easing.out(Easing.quad)}),
                withTiming(1, {duration: 170, easing: Easing.in(Easing.quad)}),
                withTiming(1, {duration: 640}),
            ),
            -1,
        );

    }, [scale]);

    // The minimum counts from the moment the logo is visible, not from
    // mount: otherwise a logo that arrives late would spend its whole
    // allowance hidden under the native splash and fade the instant it shows.
    useEffect(() => {
        if (!logoShown) return;
        const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [logoShown]);

    useEffect(() => {
        if (!ready || !minElapsed) return;
        opacity.value = withTiming(0, {duration: FADE_MS, easing: Easing.out(Easing.quad)}, done => {
            if (done) runOnJS(setMounted)(false);
        });
    }, [ready, minElapsed, opacity]);

    const logoStyle = useAnimatedStyle(() => ({transform: [{scale: scale.value}]}));
    const rootStyle = useAnimatedStyle(() => ({opacity: opacity.value}));

    if (!mounted) return null;

    return (
        <Animated.View
            style={[styles.root, rootStyle]}
            pointerEvents={ready ? 'none' : 'auto'}
            accessibilityRole="progressbar"
            accessibilityLabel="Dzduino"
        >
            <Animated.View style={logoStyle}>
                {/* React Native's Image, not expo-image: a bundled asset
                    decodes synchronously enough that the first frame already
                    carries the logo, where expo-image's pipeline left the
                    overlay blank for its first beat. */}
                <Image
                    source={LOGO}
                    style={{width: LOGO_WIDTH, height: LOGO_HEIGHT}}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                    onLoad={() => setLogoShown(true)}
                />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
}));
