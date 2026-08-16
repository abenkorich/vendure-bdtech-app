import {useState} from 'react';
import {I18nManager, ScrollView, View} from 'react-native';
import {StyleSheet, UnistylesRuntime, useUnistyles} from 'react-native-unistyles';
import {
    Badge,
    Button,
    Card,
    Divider,
    EmptyState,
    IconSymbol,
    Price,
    ProductCard,
    ProductCardSkeleton,
    Sheet,
    Skeleton,
    SkeletonText,
    Stepper,
    Text,
    Screen,
    type ProductCardData,
} from '@/components/ui';

/**
 * Design-system showcase — every primitive, every variant, on one screen.
 *
 * Not a test: it is the thing a human looks at. Type checks and unit tests
 * cannot tell you that a badge is misaligned, that Arabic put a chevron on the
 * wrong side, or that a price is 100x too large — all of which are obvious
 * here in five seconds.
 *
 * Reachable at `/_showcase`. The leading underscore keeps it out of any
 * user-facing navigation while leaving it a real route in a dev build.
 */

const SAMPLE: ProductCardData = {
    productId: '1',
    productName: 'Arduino Uno R3 Development Board with USB Cable',
    slug: 'arduino-uno-r3',
    inStock: true,
    productAsset: null,
    priceWithTax: {__typename: 'SinglePrice', value: 480000},
    currencyCode: 'DZD',
};

const RANGE_SAMPLE: ProductCardData = {
    ...SAMPLE,
    productId: '2',
    productName: 'Resistor Assortment Kit',
    inStock: false,
    priceWithTax: {__typename: 'PriceRange', min: 45000, max: 120000},
};

function Section({title, children}: {title: string; children: React.ReactNode}) {
    return (
        <View style={styles.section}>
            <Text variant="micro" color="textMuted" uppercase>
                {title}
            </Text>
            <Divider />
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

export default function Showcase() {
    const {theme} = useUnistyles();
    const [qty, setQty] = useState(1);
    const [sheetOpen, setSheetOpen] = useState(false);

    return (
        // `Screen`, not `SafeAreaView`: the first version of this file used
        // SafeAreaView and rendered a white background under white-on-dark
        // text, because Unistyles cannot process a native spec component.
        <Screen>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <View style={styles.headerText}>
                        <Text variant="title">Design system</Text>
                        <Text variant="caption" color="textMuted" tabular>
                            {`${theme.isDark ? 'dark' : 'light'} · ${
                                I18nManager.isRTL ? 'RTL' : 'LTR'
                            }`}
                        </Text>
                    </View>
                    <Button
                        size="sm"
                        variant="secondary"
                        icon="refresh"
                        onPress={() => {
                            // Toggling here rather than in the OS settings is
                            // the only practical way to eyeball both themes.
                            UnistylesRuntime.setAdaptiveThemes(false);
                            UnistylesRuntime.setTheme(theme.isDark ? 'light' : 'dark');
                        }}
                    >
                        Theme
                    </Button>
                </View>

                <Section title="Type scale">
                    <Text variant="display">Display 32</Text>
                    <Text variant="title">Title 24</Text>
                    <Text variant="heading">Heading 19</Text>
                    <Text variant="body">Body 15 — the default for prose and labels.</Text>
                    <Text variant="bodyStrong">Body strong 15</Text>
                    <Text variant="caption" color="textMuted">
                        Caption 13 — metadata and secondary detail.
                    </Text>
                    <Text variant="micro" uppercase>
                        Micro 11 uppercase
                    </Text>
                    <Text variant="body" tabular>
                        Tabular 0123456789 · SKU DZ-1010-A
                    </Text>
                    <Text variant="body">Non-tabular 0123456789 (digits drift)</Text>
                </Section>

                <Section title="Price — Vendure minor units">
                    <Text variant="caption" color="textMuted">
                        Every value below is centimes. 480000 must read 4,800 DZD.
                    </Text>
                    <Price value={480000} currencyCode="DZD" size="lg" />
                    <Price value={480000} currencyCode="DZD" size="md" />
                    <Price value={480000} currencyCode="DZD" size="sm" />
                    <Price value={49999} currencyCode="DZD" />
                    <Price value={0} currencyCode="DZD" />
                    <Price value={360000} currencyCode="DZD" compareAt={480000} />
                    <Price value={360000} currencyCode="DZD" tone="text" compareAt={480000} showDiscount={false} />
                </Section>

                <Section title="Buttons">
                    <View style={styles.row}>
                        <Button variant="primary">Add to cart</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="danger">Delete</Button>
                    </View>
                    <View style={styles.row}>
                        <Button size="sm">Small</Button>
                        <Button size="md">Medium</Button>
                        <Button size="lg">Large</Button>
                    </View>
                    <View style={styles.row}>
                        <Button icon="cart">With icon</Button>
                        <Button variant="secondary" iconEnd="chevronForward">
                            Continue
                        </Button>
                        <Button variant="ghost" icon="heart" />
                    </View>
                    <View style={styles.row}>
                        <Button loading>Loading</Button>
                        <Button disabled>Disabled</Button>
                    </View>
                    <Button fullWidth size="lg" icon="lock">
                        Checkout
                    </Button>
                </Section>

                <Section title="Badges">
                    <View style={styles.row}>
                        <Badge tone="brand">New</Badge>
                        <Badge tone="sale" solid>
                            -25%
                        </Badge>
                        <Badge tone="success" icon="check">
                            In stock
                        </Badge>
                        <Badge tone="danger" icon="warning">
                            Low stock
                        </Badge>
                        <Badge tone="neutral">Out of stock</Badge>
                    </View>
                </Section>

                <Section title="Cards and elevation">
                    <Card>
                        <Text variant="bodyStrong">Flat card</Text>
                        <Text variant="caption" color="textMuted">
                            Surface + hairline border. No shadow anywhere in this app.
                        </Text>
                    </Card>
                    <Card variant="raised">
                        <Text variant="bodyStrong">Raised card</Text>
                        <Text variant="caption" color="textMuted">
                            One step up the tint ladder.
                        </Text>
                    </Card>
                    <Card selected onPress={() => {}}>
                        <Text variant="bodyStrong">Selected + pressable</Text>
                        <Text variant="caption" color="textMuted">
                            Selection is a brand hairline, never a brand fill.
                        </Text>
                    </Card>
                </Section>

                <Section title="Stepper">
                    <Stepper value={qty} onChange={setQty} max={5} />
                    <Stepper value={qty} onChange={setQty} max={5} size="sm" />
                    <Stepper value={1} onChange={() => {}} disabled />
                    <Text variant="caption" color="textMuted" tabular>
                        {`value ${qty} · max 5`}
                    </Text>
                </Section>

                <Section title="Product cards">
                    <View style={styles.grid}>
                        <ProductCard product={SAMPLE} onPress={() => {}} />
                        <ProductCard product={RANGE_SAMPLE} onPress={() => {}} />
                    </View>
                    <View style={styles.grid}>
                        <ProductCardSkeleton />
                        <ProductCardSkeleton />
                    </View>
                </Section>

                <Section title="Skeletons">
                    <Skeleton height={44} radius="md" />
                    <SkeletonText lines={3} />
                    <View style={styles.row}>
                        <Skeleton width={56} height={56} radius="full" />
                        <Skeleton width={120} height={20} radius="sm" />
                    </View>
                </Section>

                <Section title="Icons">
                    <View style={styles.row}>
                        {(
                            [
                                'home',
                                'cart',
                                'search',
                                'heart',
                                'chevronForward',
                                'arrowBack',
                                'truck',
                                'tag',
                                'warning',
                                'checkCircle',
                            ] as const
                        ).map(name => (
                            <IconSymbol key={name} name={name} size={22} color="textMuted" />
                        ))}
                    </View>
                    <Text variant="caption" color="textMuted">
                        Chevrons and arrows mirror in RTL; carts and tags do not.
                    </Text>
                </Section>

                <Section title="Sheet">
                    <Button variant="secondary" icon="filter" onPress={() => setSheetOpen(true)}>
                        Open sheet
                    </Button>
                </Section>

                <Section title="Empty states">
                    <EmptyState
                        icon="cart"
                        title="Your cart is empty"
                        message="Browse the catalogue and add something to get started."
                        action={{label: 'Shop now', onPress: () => {}}}
                    />
                    <Divider />
                    <EmptyState
                        tone="error"
                        title="Could not reach the store"
                        message="Check your connection and try again."
                        action={{label: 'Retry', onPress: () => {}}}
                        secondaryAction={{label: 'Go home', onPress: () => {}}}
                    />
                </Section>
            </ScrollView>

            <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters">
                <View style={styles.sectionBody}>
                    <Text variant="body" color="textMuted">
                        Drag down to dismiss, or tap the backdrop.
                    </Text>
                    <Badge tone="brand">In stock only</Badge>
                    <Price value={1250000} currencyCode="DZD" size="lg" />
                    <Button fullWidth onPress={() => setSheetOpen(false)}>
                        Apply
                    </Button>
                </View>
            </Sheet>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        padding: theme.spacing.lg,
        gap: theme.spacing.xl,
        paddingBottom: theme.spacing['3xl'],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    headerText: {
        flex: 1,
        gap: theme.spacing.xs,
    },
    section: {
        gap: theme.spacing.sm,
    },
    sectionBody: {
        gap: theme.spacing.md,
        paddingTop: theme.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
    },
    grid: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
}));
