// Deep import rather than `from '@expo/vector-icons'`: the barrel pulls every
// icon set into the bundle, which cost ~3MB of font files the app never uses.
import Ionicons from '@expo/vector-icons/Ionicons';
import {I18nManager} from 'react-native';
import {useUnistyles} from 'react-native-unistyles';
import type {AppColors} from '@/design/tokens';

/**
 * The single icon indirection.
 *
 * Every icon in the app goes through this component and names a *semantic*
 * icon, never a glyph in a particular set. That is what makes the set
 * swappable: replacing Ionicons with SF Symbols or a custom set is a change to
 * `ICONS` below and nothing else. Import `Ionicons` anywhere but here and that
 * property is lost.
 */

/** Ionicons glyphs, keyed by what the icon *means* in this app. */
const ICONS = {
    /* navigation */
    home: 'home-outline',
    homeFilled: 'home',
    shop: 'grid-outline',
    shopFilled: 'grid',
    search: 'search-outline',
    searchFilled: 'search',
    cart: 'cart-outline',
    cartFilled: 'cart',
    account: 'person-outline',
    accountFilled: 'person',

    /* direction — these flip in RTL, see DIRECTIONAL */
    chevronForward: 'chevron-forward',
    chevronBack: 'chevron-back',
    chevronDown: 'chevron-down',
    chevronUp: 'chevron-up',
    arrowForward: 'arrow-forward',
    arrowBack: 'arrow-back',
    share: 'share-outline',

    /* actions */
    close: 'close',
    add: 'add',
    remove: 'remove',
    trash: 'trash-outline',
    filter: 'options-outline',
    sort: 'swap-vertical-outline',
    heart: 'heart-outline',
    heartFilled: 'heart',
    compare: 'git-compare-outline',
    refresh: 'refresh',
    settings: 'settings-outline',
    logout: 'log-out-outline',
    copy: 'copy-outline',
    camera: 'camera-outline',
    edit: 'create-outline',

    /* state */
    check: 'checkmark',
    checkCircle: 'checkmark-circle',
    warning: 'warning-outline',
    error: 'alert-circle-outline',
    info: 'information-circle-outline',
    offline: 'cloud-offline-outline',
    empty: 'file-tray-outline',
    star: 'star',
    starOutline: 'star-outline',

    /* commerce */
    tag: 'pricetag-outline',
    truck: 'car-outline',
    package: 'cube-outline',
    receipt: 'receipt-outline',
    location: 'location-outline',
    creditCard: 'card-outline',
    cash: 'cash-outline',
    lock: 'lock-closed-outline',
    mail: 'mail-outline',
    phone: 'call-outline',
    calculator: 'calculator-outline',
    article: 'newspaper-outline',
    chip: 'hardware-chip-outline',
    globe: 'globe-outline',
    bell: 'notifications-outline',
} as const satisfies Record<string, React.ComponentProps<typeof Ionicons>['name']>;

export type IconName = keyof typeof ICONS;

/**
 * Icons whose meaning is tied to reading direction. In Arabic a "forward"
 * chevron must point left, so these are mirrored. Icons whose shape is not
 * directional (a cart, a trash can) must *not* be, which is why this is an
 * explicit list rather than a blanket transform on every icon.
 */
const DIRECTIONAL = new Set<IconName>([
    'chevronForward',
    'chevronBack',
    'arrowForward',
    'arrowBack',
    'logout',
]);

export interface IconSymbolProps {
    name: IconName;
    /** Point size. Defaults to 20, which sits on the 4pt grid at body size. */
    size?: number;
    /**
     * A theme color key, or any explicit color string. Defaults to `text`.
     */
    color?: keyof AppColors | (string & {});
    /** Escape hatch for opacity/transform; layout should come from the parent. */
    style?: React.ComponentProps<typeof Ionicons>['style'];
}

export function IconSymbol({name, size = 20, color = 'text', style}: IconSymbolProps) {
    const {theme} = useUnistyles();
    // `color` is either a theme key or a literal; the lookup decides which.
    const resolved = theme.colors[color as keyof AppColors] ?? (color as string);
    const flip = DIRECTIONAL.has(name) && I18nManager.isRTL;

    return (
        <Ionicons
            name={ICONS[name]}
            size={size}
            color={resolved}
            style={[flip && {transform: [{scaleX: -1}]}, style]}
        />
    );
}
