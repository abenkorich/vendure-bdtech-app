import assert from 'node:assert/strict';
import {
    parseHtmlBlocks,
    parseInline,
    spansToText,
    htmlToPlainText,
    decodeEntities,
    type HtmlBlock,
} from '../src/features/blog/html';

/**
 * Blog body rendering.
 *
 * The body arrives as HTML from the Console CMS and is rendered natively
 * (no WebView — the reasoning is in `html.ts`), which makes this parser the one
 * place a post can silently come out blank. The fixture is a trimmed copy of
 * the real `esp32-cam` post, because that is the exact markup the editor emits:
 * `<h2><strong><u>…`, `<ol><li><p>…`, entity-escaped `&nbsp;`, bare `<img>`,
 * and `<br>` used for soft wrapping inside a paragraph.
 */

const FIXTURE = `<h2><strong><u>What is ESP32 CAM:</u></strong></h2>` +
    `<p>The ESP32-CAM is a small camera module that integrates an ESP32-S chip.</p>` +
    `<p>Processor:&nbsp;The core is an ESP32 chip,<br>which is dual-core.</p>` +
    `<img class="my-4 rounded-lg" src="https://example.com/pinout.png" alt="Pinout">` +
    `<p><strong>Available Pins:</strong></p>` +
    `<ol><li><p><strong>GPIO 0</strong> - flashing mode.</p></li>` +
    `<li><p><strong>GPIO 2</strong> - onboard LED.</p></li></ol>` +
    `<p></p>` +
    `<blockquote>Mind the 3.3V rail.</blockquote>` +
    `<p>See the <a href="https://example.com/docs">datasheet</a> for details.</p>`;

function ofType<T extends HtmlBlock['type']>(
    blocks: HtmlBlock[],
    type: T,
): Extract<HtmlBlock, {type: T}>[] {
    return blocks.filter(block => block.type === type) as Extract<HtmlBlock, {type: T}>[];
}

function checkFixture(): void {
    const blocks = parseHtmlBlocks(FIXTURE);

    // The single most important assertion: a real post is not empty.
    assert.ok(blocks.length >= 8, `expected the fixture to yield blocks, got ${blocks.length}`);

    const headings = ofType(blocks, 'heading');
    assert.equal(headings.length, 1);
    assert.equal(headings[0].level, 2);
    assert.equal(spansToText(headings[0].spans), 'What is ESP32 CAM:');
    // The nested <strong><u> must survive as marks, not be flattened away.
    assert.deepEqual(headings[0].spans[0].marks.sort(), ['strong', 'underline']);

    const images = ofType(blocks, 'image');
    assert.equal(images.length, 1);
    assert.equal(images[0].src, 'https://example.com/pinout.png');
    assert.equal(images[0].alt, 'Pinout');

    const lists = ofType(blocks, 'list');
    assert.equal(lists.length, 1);
    assert.equal(lists[0].ordered, true);
    assert.equal(lists[0].items.length, 2, '<li><p> wrappers must not swallow items');
    assert.equal(spansToText(lists[0].items[0]), 'GPIO 0 - flashing mode.');

    const quotes = ofType(blocks, 'quote');
    assert.equal(spansToText(quotes[0].spans), 'Mind the 3.3V rail.');

    // Empty <p></p> is layout noise from the editor and must not become a gap.
    for (const block of blocks) {
        if (block.type === 'paragraph') {
            assert.ok(spansToText(block.spans).trim().length > 0, 'empty paragraph leaked through');
        }
    }

    // <br> is a soft wrap inside one paragraph, not a new paragraph.
    const soft = ofType(blocks, 'paragraph').find(block =>
        spansToText(block.spans).includes('dual-core'),
    );
    assert.ok(soft);
    assert.ok(spansToText(soft.spans).includes('\n'));
    assert.ok(spansToText(soft.spans).includes('\u00a0'), '&nbsp; must decode');

    const link = ofType(blocks, 'paragraph').find(block =>
        block.spans.some(span => span.href),
    );
    assert.ok(link, 'the <a> must survive as a linked span');
    const anchor = link.spans.find(span => span.href);
    assert.equal(anchor?.href, 'https://example.com/docs');
    assert.equal(anchor?.text, 'datasheet');
}

function checkEntities(): void {
    assert.equal(decodeEntities('4.7&nbsp;k&ohm;'), '4.7\u00a0kΩ');
    assert.equal(decodeEntities('a &amp; b &lt;c&gt;'), 'a & b <c>');
    assert.equal(decodeEntities('&#8212;'), '—');
    assert.equal(decodeEntities('&#x2014;'), '—');
    // An unknown entity must be left alone, not turned into an empty string.
    assert.equal(decodeEntities('&notarealentity;'), '&notarealentity;');
}

function checkInline(): void {
    assert.deepEqual(parseInline('plain'), [{text: 'plain', marks: []}]);

    const mixed = parseInline('a <strong>b <em>c</em></strong> d');
    assert.equal(spansToText(mixed), 'a b c d');
    assert.deepEqual(mixed[1].marks, ['strong']);
    assert.deepEqual(mixed[2].marks, ['strong', 'em']);

    // Unclosed tags are common in hand-edited HTML and must not lose text.
    assert.equal(spansToText(parseInline('a <strong>b')), 'a b');
    // An unknown inline tag degrades to its text.
    assert.equal(spansToText(parseInline('x <span class="y">z</span>')), 'x z');
}

function checkEdgeCases(): void {
    assert.deepEqual(parseHtmlBlocks(null), []);
    assert.deepEqual(parseHtmlBlocks(undefined), []);
    assert.deepEqual(parseHtmlBlocks(''), []);
    assert.deepEqual(parseHtmlBlocks('   '), []);

    // Body with no tags at all still renders.
    const bare = parseHtmlBlocks('Just some text.');
    assert.equal(bare.length, 1);
    assert.equal(bare[0].type, 'paragraph');

    // Text outside any block tag is kept rather than dropped.
    const loose = parseHtmlBlocks('<p>one</p>orphan<p>two</p>');
    assert.equal(ofType(loose, 'paragraph').length, 3);

    // A comment must not eat the document.
    assert.equal(ofType(parseHtmlBlocks('<!-- hi --><p>kept</p>'), 'paragraph').length, 1);

    // A <p> wrapping only an image becomes a figure, not a text block.
    const figure = parseHtmlBlocks('<p><img src="a.png"></p>');
    assert.equal(figure.length, 1);
    assert.equal(figure[0].type, 'image');

    // <pre> keeps its whitespace.
    const code = ofType(parseHtmlBlocks('<pre><code>a\n  b</code></pre>'), 'code');
    assert.equal(code[0].text, 'a\n  b');

    assert.deepEqual(parseHtmlBlocks('<hr>'), [{type: 'rule'}]);
}

function checkPlainText(): void {
    const text = htmlToPlainText(FIXTURE, 60);
    assert.ok(text.startsWith('What is ESP32 CAM:'));
    assert.ok(text.length <= 60);
    assert.ok(text.endsWith('…'));
    assert.ok(!text.includes('<'), 'no tags may leak into an excerpt');
    assert.equal(htmlToPlainText(null), '');
}

export async function run(): Promise<void> {
    checkFixture();
    checkEntities();
    checkInline();
    checkEdgeCases();
    checkPlainText();
}
