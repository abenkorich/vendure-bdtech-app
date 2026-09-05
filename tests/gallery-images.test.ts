import {galleryImages} from '@/features/product/gallery-images';
import {check, eq, done} from './harness';

/**
 * Product pages must show the featured photo even when `assets` is empty,
 * which is the shape a third of this catalogue actually has.
 */
export async function run(): Promise<void> {
    const featured = {id: '1', preview: 'https://cdn/1.webp'};

    eq(
        'a featured asset with no asset list still yields one image',
        galleryImages({featuredAsset: featured, assets: []}).length,
        1,
    );

    const both = galleryImages({
        featuredAsset: featured,
        assets: [
            {id: '2', preview: 'https://cdn/2.webp'},
            {id: '1', preview: 'https://cdn/1.webp'},
        ],
    });
    eq('the featured asset leads', both[0]?.id, '1');
    eq('a featured asset also listed in assets is not repeated', both.length, 2);

    eq(
        'no featured asset falls back to the asset list order',
        galleryImages({featuredAsset: null, assets: [{id: '3', preview: 'https://cdn/3.webp'}]})[0]?.id,
        '3',
    );

    check(
        'nothing at all yields an empty gallery, not a crash',
        galleryImages({assets: []}).length === 0,
    );

    done();
}
