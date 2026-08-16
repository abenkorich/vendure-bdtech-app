import type {ToolSlug} from '@/lib/tools/registry';

/**
 * Message namespace per tool slug.
 *
 * Not derivable from the slug: `555-timer` maps to `timer555`, since a message
 * key cannot start with a digit. Lives outside the page body so route
 * frontmatter can build titles without importing React components.
 */
export const TOOL_NAMESPACE: Record<ToolSlug, string> = {
    'resistor-color-code': 'resistorColorCode',
    'ohms-law': 'ohmsLaw',
    'voltage-divider': 'voltageDivider',
    'series-parallel': 'seriesParallel',
    'smd-code': 'smdCode',
    '555-timer': 'timer555',
};
