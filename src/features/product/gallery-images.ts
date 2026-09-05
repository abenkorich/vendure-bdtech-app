/**
 * The images a product page should page through.
 *
 * `product.assets` is not the whole story in this catalogue: a large share of
 * products were imported with a `featuredAsset` and an empty `assets` list
 * (109 of the 300 newest, measured live on 2026-09-05). The card grid reads
 * `featuredAsset`, so those products showed a photo in the grid and a
 * placeholder on their own page, which reads as the page being broken.
 *
 * Featured first, because that is the photo the shopper tapped on; the rest
 * follow in catalogue order, minus the featured one if it is also listed.
 */
export interface GalleryAsset {
    id: string;
    preview: string;
}

export interface GallerySource {
    featuredAsset?: GalleryAsset | null;
    assets: readonly GalleryAsset[];
}

export function galleryImages(product: GallerySource): GalleryAsset[] {
    const images: GalleryAsset[] = [];
    const seen = new Set<string>();

    const push = (asset: GalleryAsset | null | undefined) => {
        if (!asset || !asset.preview || seen.has(asset.id)) return;
        seen.add(asset.id);
        images.push({id: asset.id, preview: asset.preview});
    };

    push(product.featuredAsset);
    for (const asset of product.assets) push(asset);

    return images;
}
