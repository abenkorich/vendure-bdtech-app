import type {ToolIconName} from '@/lib/tools/registry';
import type {IconName} from '@/components/ui';

/**
 * Registry icon *name* -> design-system icon.
 *
 * `TOOL_REGISTRY` carries lucide-flavoured names (the web storefront imported
 * the components directly); the app only has the semantic `IconSymbol` set, and
 * that set is owned by the design system, so the bridge lives here rather than
 * as new entries in `ICONS`. Kept free of React so it can be unit-tested and so
 * a missing mapping is a type error rather than a blank square on the hub.
 */
export const TOOL_ICON: Record<ToolIconName, IconName> = {
    /* color bands read as tags of colour on a body */
    palette: 'tag',
    /* no lightning glyph in the set; Ohm's law is the arithmetic tool */
    zap: 'calculator',
    /* git-compare is literally the same glyph family as git-branch */
    'git-branch': 'compare',
    /* stacked resistors -> a cube */
    layers: 'package',
    cpu: 'chip',
    /* a repeating cycle is the closest read for an oscillator */
    timer: 'refresh',
};

export function toolIcon(name: ToolIconName): IconName {
    return TOOL_ICON[name];
}
