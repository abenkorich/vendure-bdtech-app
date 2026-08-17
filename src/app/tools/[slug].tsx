import {useLocalSearchParams, useRouter} from 'expo-router';
import {Screen, EmptyState} from '@/components/ui';
import {getToolBySlug, type ToolSlug} from '@/lib/tools/registry';
import {TOOL_NAMESPACE} from '@/lib/tools/namespaces';
import {useT} from '@/features/account/i18n';
import {ToolScreenBody} from '@/features/tools/components/ToolScreenBody';
import {ResistorColorCodeTool} from '@/features/tools/components/ResistorColorCodeTool';
import {OhmsLawTool} from '@/features/tools/components/OhmsLawTool';
import {VoltageDividerTool} from '@/features/tools/components/VoltageDividerTool';
import {SeriesParallelTool} from '@/features/tools/components/SeriesParallelTool';
import {SmdCodeTool} from '@/features/tools/components/SmdCodeTool';
import {Timer555Tool} from '@/features/tools/components/Timer555Tool';

/**
 * One route for all six calculators.
 *
 * A single dynamic route rather than six files: the chrome (title, description,
 * hint, education block) is identical and comes from `Tools.<namespace>.*`, so
 * six route files would be six copies of the same layout differing by one
 * component. The slug -> component map below is exhaustive over `ToolSlug`, so
 * adding a tool to the registry without a screen is a type error.
 */
const TOOLS: Record<ToolSlug, () => React.ReactElement> = {
    'resistor-color-code': ResistorColorCodeTool,
    'ohms-law': OhmsLawTool,
    'voltage-divider': VoltageDividerTool,
    'series-parallel': SeriesParallelTool,
    'smd-code': SmdCodeTool,
    '555-timer': Timer555Tool,
};

export default function ToolScreen() {
    const {slug} = useLocalSearchParams<{slug: string}>();
    const router = useRouter();
    const tNotFound = useT('NotFound');

    const definition = slug ? getToolBySlug(slug) : undefined;
    const Tool = definition ? TOOLS[definition.slug as ToolSlug] : undefined;

    // `useT` must be called unconditionally, so the namespace falls back to the
    // hub's rather than being skipped when the slug is unknown.
    const namespace = definition
        ? TOOL_NAMESPACE[definition.slug as ToolSlug]
        : undefined;
    const t = useT(namespace ? `Tools.${namespace}` : 'Tools');

    if (!definition || !Tool) {
        return (
            <Screen>
                <EmptyState
                    icon="calculator"
                    title={tNotFound('title')}
                    message={tNotFound('message')}
                    action={{label: tNotFound('goHome'), onPress: () => router.replace('/tools')}}
                />
            </Screen>
        );
    }

    return (
        <Screen>
            <ToolScreenBody title={t('title')} description={t('description')} hint={safeHint(t)}>
                <Tool />
            </ToolScreenBody>
        </Screen>
    );
}

/**
 * `hint` exists for five of the six tools; the resistor decoder has none
 * because its band UI is self-evident. A missing key renders its own path, so
 * this drops it rather than printing `Tools.resistorColorCode.hint` on screen.
 */
function safeHint(t: (key: string) => string): string | undefined {
    const hint = t('hint');
    return hint.endsWith('.hint') ? undefined : hint;
}
