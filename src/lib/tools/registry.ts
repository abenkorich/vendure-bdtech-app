/**
 * Tool metadata, ported from the web storefront.
 *
 * The web version imported `LucideIcon` components directly. React Native has
 * no lucide-react, so tools carry an icon *name* and the UI layer maps it to a
 * native icon component. That keeps this module free of any rendering
 * dependency, which is also what lets it be unit-tested.
 */
export type ToolIconName =
    | 'palette'
    | 'zap'
    | 'git-branch'
    | 'layers'
    | 'cpu'
    | 'timer';

export type ToolPhase = 1 | 2 | 3;

export interface ToolDefinition {
    slug: string;
    icon: ToolIconName;
    phase: ToolPhase;
    collectionSlug?: string;
    featureKeys: readonly string[];
}

export const TOOL_REGISTRY: readonly ToolDefinition[] = [
    {
        slug: 'resistor-color-code',
        icon: 'palette',
        phase: 1,
        collectionSlug: 'resistors',
        featureKeys: ['decode', 'reverseLookup', 'referenceTable'],
    },
    {
        slug: 'ohms-law',
        icon: 'zap',
        phase: 1,
        collectionSlug: 'electronics-development',
        featureKeys: ['voltage', 'current', 'power'],
    },
    {
        slug: 'voltage-divider',
        icon: 'git-branch',
        phase: 1,
        collectionSlug: 'resistors',
        featureKeys: ['divider', 'units', 'current'],
    },
    {
        slug: 'series-parallel',
        icon: 'layers',
        phase: 2,
        collectionSlug: 'resistors',
        featureKeys: ['series', 'parallel', 'upTo10'],
    },
    {
        slug: 'smd-code',
        icon: 'cpu',
        phase: 2,
        collectionSlug: 'resistors',
        featureKeys: ['3digit', '4digit', 'bidirectional'],
    },
    {
        slug: '555-timer',
        icon: 'timer',
        phase: 2,
        collectionSlug: 'electronics-development',
        featureKeys: ['astable', 'monostable', 'units'],
    },
] as const;

export type ToolSlug = (typeof TOOL_REGISTRY)[number]['slug'];

export function getToolsByPhase(phase: ToolPhase): ToolDefinition[] {
    return TOOL_REGISTRY.filter((tool) => tool.phase === phase);
}

export function getPhase1Tools(): ToolDefinition[] {
    return getToolsByPhase(1);
}

export function getAllTools(): ToolDefinition[] {
    return [...TOOL_REGISTRY];
}

const DEFAULT_TOOL_COLLECTION_SLUG = 'electronics-development';

export function getToolBySlug(slug: string): ToolDefinition | undefined {
    return TOOL_REGISTRY.find((tool) => tool.slug === slug);
}

/** Collection slug for related-product rails on a tool page. */
export function getToolRelatedCollectionSlug(slug: string): string {
    return getToolBySlug(slug)?.collectionSlug ?? DEFAULT_TOOL_COLLECTION_SLUG;
}
