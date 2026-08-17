import {ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Screen, Text, Card, Badge, IconSymbol} from '@/components/ui';
import {BackHeader} from '@/features/account/components/chrome';
import {TOOL_REGISTRY, type ToolDefinition} from '@/lib/tools/registry';
import {toolIcon} from '@/features/tools/icons';
import {useT} from '@/features/account/i18n';

/**
 * Tools hub.
 *
 * A two-column grid of the six calculators straight from `TOOL_REGISTRY` — the
 * registry is the source of truth, so adding a tool there and a message block
 * puts it on this screen with no edit here (and `tools-calculators.test.ts`
 * fails if the messages are missing rather than the hub rendering a key path).
 *
 * Phase is not surfaced as a filter: all six ship at once on mobile, and a
 * "phase 2" badge would be an implementation detail leaking into the store.
 */
export default function ToolsScreen() {
    const t = useT('Tools');

    return (
        <Screen>
            <BackHeader title={t('title')} />
            <ScrollView contentContainerStyle={styles.content}>
                <Text variant="body" color="textMuted">
                    {t('subtitle')}
                </Text>

                <View style={styles.grid}>
                    {TOOL_REGISTRY.map(tool => (
                        <ToolTile key={tool.slug} tool={tool} />
                    ))}
                </View>
            </ScrollView>
        </Screen>
    );
}

function ToolTile({tool}: {tool: ToolDefinition}) {
    const t = useT(`Tools.tools.${tool.slug}`);
    const router = useRouter();

    return (
        <Card
            padding="md"
            style={styles.tile}
            onPress={() => router.push(`/tools/${tool.slug}`)}
            accessibilityLabel={t('title')}
        >
            <View style={styles.tileIcon}>
                <IconSymbol name={toolIcon(tool.icon)} size={20} color="brand" />
            </View>

            <Text variant="bodyStrong" numberOfLines={2}>
                {t('title')}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={3} style={styles.tileBody}>
                {t('description')}
            </Text>

            <View style={styles.features}>
                {tool.featureKeys.slice(0, 2).map(key => (
                    <Badge key={key} tone="neutral">
                        {t(`features.${key}`)}
                    </Badge>
                ))}
            </View>
        </Card>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.lg,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.md,
    },
    tile: {
        // Two columns with one gutter between them. `48%` rather than a
        // computed pixel width so it survives rotation and split view.
        width: '48%',
        flexGrow: 1,
        gap: theme.spacing.xs,
    },
    tileIcon: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.brandMuted,
        marginBottom: theme.spacing.xs,
    },
    tileBody: {flexGrow: 1},
    features: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.xs,
        paddingTop: theme.spacing.xs,
    },
}));
