import type {ImageProps} from 'expo-image';
import {absoluteAsset} from './schema';

/**
 * Customizer images the app ships with.
 *
 * The bundled site-config snapshot (`fallback.json`) names its logo and hero
 * banners by web-root-relative path. Those paths only mean something if the
 * storefront that serves them is deployed, and today it is not: production
 * runs the Next storefront, which answers every `/customizer/banners/*`
 * request with a generic "no image available" PNG and a 200. So the app
 * cannot tell a missing banner from a real one, and the first screen anyone
 * sees showed a grey placeholder for the logo and the whole hero.
 *
 * Shipping the four files the snapshot refers to closes that gap: home renders
 * a designed storefront with no network at all, and when the storefront is
 * deployed the same paths simply stop needing the network. Anything the
 * merchant uploads later is not here, and resolves over the network as before.
 *
 * Keep this table in step with `fallback.json`; `tests/site-config.test.ts`
 * checks that every image the snapshot names is either bundled here or
 * knowingly left to the network.
 */
const BUNDLED: Record<string, number> = {
    '/customizer/banners/1205f3f9-7909-45d3-8fc6-4440c5ba1c91.png': require('../../../assets/customizer/1205f3f9-7909-45d3-8fc6-4440c5ba1c91.png'),
    '/customizer/banners/0c44dbc3-d3dc-4e7c-bbc1-53cddfadaa93.jpg': require('../../../assets/customizer/0c44dbc3-d3dc-4e7c-bbc1-53cddfadaa93.jpg'),
    '/customizer/banners/a714db07-834f-4377-b111-07f0b6569fa4.jpg': require('../../../assets/customizer/a714db07-834f-4377-b111-07f0b6569fa4.jpg'),
    '/customizer/banners/18f5a136-72d1-47fc-91d7-dc9572c2e6aa.jpg': require('../../../assets/customizer/18f5a136-72d1-47fc-91d7-dc9572c2e6aa.jpg'),
};

/** The paths this build carries a copy of. */
export const BUNDLED_SITE_ASSET_PATHS: readonly string[] = Object.keys(BUNDLED);

/** What `expo-image` accepts as `source`: a bundled asset id or a `{uri}`. */
export type SiteImageSource = ImageProps['source'];

/**
 * An `expo-image` source for a customizer image path: the bundled copy when
 * there is one, otherwise the path resolved against the storefront origin.
 * Undefined for no path, so callers keep their own fallback branch.
 */
export function siteImageSource(path: string | undefined, base: string): SiteImageSource {
    if (!path) return undefined;
    const bundled = BUNDLED[path];
    if (bundled !== undefined) return bundled;
    const uri = absoluteAsset(path, base);
    return uri ? {uri} : undefined;
}
