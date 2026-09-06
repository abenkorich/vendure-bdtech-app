import {recordVisit, rankVisited, parseHistory, HISTORY_LIMIT, COUNT_CAP} from '@/features/explore/history-core';
import {pageWindows, hasMorePages, interleave, perCollection} from '@/features/explore/feed-core';
import {check, eq, done} from './harness';

/**
 * Explore more is device-local personalisation with no backend behind it, so
 * the two rules that make it feel right — what counts as "into it now", and
 * how a mixed feed pages newest-first — are the whole feature. Pinned here.
 */
export async function run(): Promise<void> {
    const DAY = 24 * 60 * 60 * 1000;
    const now = 1_800_000_000_000;

    /* ---------------------------------------------------------- history */

    let history = recordVisit([], 'sensors', now - 30 * DAY);
    for (let i = 0; i < 9; i += 1) history = recordVisit(history, 'sensors', now - 30 * DAY);
    history = recordVisit(history, 'robotics', now - DAY);
    history = recordVisit(history, 'robotics', now - DAY);

    eq('a visit moves the collection to the front', history[0]?.slug, 'robotics');
    eq('repeat visits accumulate', history.find(e => e.slug === 'sensors')?.count, 10);
    eq(
        'two visits yesterday outrank ten visits a month ago',
        rankVisited(history, 4, now).join(','),
        'robotics,sensors',
    );

    let capped: ReturnType<typeof recordVisit> = [];
    for (let i = 0; i < COUNT_CAP + 10; i += 1) capped = recordVisit(capped, 'x', now);
    eq('the visit count is capped', capped[0]?.count, COUNT_CAP);

    let many: ReturnType<typeof recordVisit> = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) many = recordVisit(many, `c${i}`, now + i);
    eq('the history keeps only the most recent collections', many.length, HISTORY_LIMIT);
    eq('the newest survives the trim', many[0]?.slug, `c${HISTORY_LIMIT + 4}`);

    eq('a blank slug is ignored', recordVisit(history, '  ', now).length, history.length);
    eq(
        'a corrupt blob yields an empty history, not a crash',
        parseHistory([{slug: 'ok', count: 1, lastVisit: 1}, 'junk', {slug: 3}]).length,
        1,
    );

    /* -------------------------------------------------------------- feed */

    eq('two collections split a 12-product page evenly', perCollection(2), 6);
    eq('one collection fills the page alone', perCollection(1), 12);
    eq('more than four collections still split as four', perCollection(9), 3);

    const totals = [
        {slug: 'big', total: 20},
        {slug: 'small', total: 5},
    ];
    const page0 = pageWindows(totals, 0, 6);
    check(
        'page 0 reads the last six of the big collection (newest first)',
        page0[0]?.skip === 14 && page0[0]?.take === 6,
        JSON.stringify(page0),
    );
    check(
        'page 0 reads all five of the small collection',
        page0[1]?.skip === 0 && page0[1]?.take === 5,
        JSON.stringify(page0),
    );
    const page1 = pageWindows(totals, 1, 6);
    eq('page 1 no longer reads the exhausted small collection', page1.length, 1);
    check('page 1 walks back six more in the big one', page1[0]?.skip === 8 && page1[0]?.take === 6, JSON.stringify(page1));
    const page3 = pageWindows(totals, 3, 6);
    check('the last page clamps at the start rather than going negative', page3[0]?.skip === 0 && page3[0]?.take === 2, JSON.stringify(page3));
    eq('there is a next page while any collection has more', hasMorePages(totals, 0, 6), true);
    eq('and none once every collection is read', hasMorePages(totals, 3, 6), false);

    const merged = interleave(
        [
            [{id: 'a1'}, {id: 'shared'}, {id: 'a3'}],
            [{id: 'b1'}, {id: 'shared'}],
        ],
        item => item.id,
    );
    eq('collections interleave round-robin', merged.map(i => i.id).join(','), 'a1,b1,shared,a3');

    done();
}
