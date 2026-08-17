import {Linking, View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {Text} from '@/components/ui';
import {parseHtmlBlocks, type HtmlBlock, type InlineSpan} from '@/features/blog/html';

/**
 * Blog body renderer.
 *
 * Natively rendered from parsed blocks rather than through a WebView; the
 * reasoning for that choice is in `html.ts`. The payoff is visible here: every
 * block uses the app's own type scale and theme colors, so a post follows a
 * light/dark switch like the rest of the app, and RTL alignment comes free.
 */
export function PostBody({html}: {html: string | null | undefined}) {
    const blocks = parseHtmlBlocks(html);

    if (blocks.length === 0) return null;

    return (
        <View style={styles.body}>
            {blocks.map((block, index) => (
                <BlockView key={index} block={block} />
            ))}
        </View>
    );
}

function BlockView({block}: {block: HtmlBlock}) {
    switch (block.type) {
        case 'heading':
            return (
                <Text variant={block.level === 2 ? 'title' : 'heading'} style={styles.heading}>
                    <Spans spans={block.spans} />
                </Text>
            );

        case 'paragraph':
            return (
                <Text variant="body" color="text">
                    <Spans spans={block.spans} />
                </Text>
            );

        case 'quote':
            return (
                <View style={styles.quote}>
                    <Text variant="body" color="textMuted">
                        <Spans spans={block.spans} />
                    </Text>
                </View>
            );

        case 'code':
            return (
                <View style={styles.code}>
                    <Text variant="caption" tabular>
                        {block.text}
                    </Text>
                </View>
            );

        case 'list':
            return (
                <View style={styles.list}>
                    {block.items.map((item, index) => (
                        <View key={index} style={styles.listItem}>
                            {/* A text bullet rather than a drawn dot: it sits on
                                the text baseline and follows the font size. */}
                            <Text variant="body" color="textMuted" tabular style={styles.bullet}>
                                {block.ordered ? `${index + 1}.` : '•'}
                            </Text>
                            <Text variant="body" style={styles.listText}>
                                <Spans spans={item} />
                            </Text>
                        </View>
                    ))}
                </View>
            );

        case 'image':
            return (
                <Image
                    source={{uri: block.src}}
                    style={styles.image}
                    contentFit="contain"
                    transition={160}
                    accessibilityLabel={block.alt}
                    accessibilityIgnoresInvertColors
                />
            );

        case 'rule':
            return <View style={styles.rule} />;
    }
}

function Spans({spans}: {spans: readonly InlineSpan[]}) {
    return (
        <>
            {spans.map((span, index) => (
                <Text
                    key={index}
                    variant={span.marks.includes('strong') ? 'bodyStrong' : 'body'}
                    color={span.href ? 'brand' : 'text'}
                    tabular={span.marks.includes('code')}
                    style={[
                        span.marks.includes('em') && styles.italic,
                        (span.marks.includes('underline') || span.href) && styles.underline,
                    ]}
                    onPress={span.href ? () => void Linking.openURL(span.href as string) : undefined}
                >
                    {span.text}
                </Text>
            ))}
        </>
    );
}

const styles = StyleSheet.create(theme => ({
    body: {gap: theme.spacing.md},
    heading: {paddingTop: theme.spacing.md},
    italic: {fontStyle: 'italic'},
    underline: {textDecorationLine: 'underline'},
    quote: {
        // Logical border so the rule sits on the reading edge in Arabic.
        borderStartWidth: 3,
        borderStartColor: theme.colors.brand,
        paddingStart: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
    },
    code: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
    },
    list: {gap: theme.spacing.sm},
    listItem: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        alignItems: 'flex-start',
    },
    bullet: {minWidth: 20},
    listText: {flex: 1},
    image: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
    },
    rule: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: theme.spacing.sm,
    },
}));
