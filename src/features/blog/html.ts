/**
 * A tiny HTML -> block parser for blog bodies.
 *
 * **Why not `react-native-webview`?** The body is a handful of block tags
 * (`h2/h3/p/ul/ol/li/img/blockquote/pre`) with inline `strong/em/u/a/code`,
 * emitted by the Console's rich-text editor — see the ESP32-Cam post, which is
 * the entire published corpus today. A WebView to render that costs a ~2MB
 * native dependency, a second rendering engine that does not follow the app's
 * theme (the body would stay light while the app is dark, exactly the
 * `SafeAreaView` failure mode AGENTS.md warns about), broken text selection and
 * accessibility, and a scroll view inside a scroll view. Native rendering keeps
 * the type scale, the theme and RTL, and it is testable in Node, which a WebView
 * is not.
 *
 * The trade: unknown tags degrade to their text content rather than rendering
 * faithfully. That is the right failure — text always shows up, and this module
 * is pure so a new tag is one case plus a test, not a device round trip.
 */

export type InlineMark = 'strong' | 'em' | 'underline' | 'code';

export interface InlineSpan {
    text: string;
    marks: InlineMark[];
    /** Present on `<a href>`; the UI turns it into a link. */
    href?: string;
}

export type HtmlBlock =
    | {type: 'heading'; level: 2 | 3; spans: InlineSpan[]}
    | {type: 'paragraph'; spans: InlineSpan[]}
    | {type: 'quote'; spans: InlineSpan[]}
    | {type: 'code'; text: string}
    | {type: 'list'; ordered: boolean; items: InlineSpan[][]}
    | {type: 'image'; src: string; alt?: string}
    | {type: 'rule'};

const ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00a0',
    hellip: '…',
    mdash: '—',
    ndash: '–',
    rsquo: '’',
    lsquo: '‘',
    ldquo: '“',
    rdquo: '”',
    deg: '°',
    times: '×',
    micro: 'µ',
    ohm: 'Ω',
};

export function decodeEntities(input: string): string {
    return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
        if (body.startsWith('#')) {
            const code = body[1] === 'x' || body[1] === 'X'
                ? Number.parseInt(body.slice(2), 16)
                : Number.parseInt(body.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return ENTITIES[body.toLowerCase()] ?? match;
    });
}

/** `<img src="x" alt='y'>` -> {src:'x', alt:'y'} */
function parseAttributes(tag: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const re = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(tag)) !== null) {
        attrs[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? '');
    }
    return attrs;
}

const MARK_BY_TAG: Record<string, InlineMark> = {
    strong: 'strong',
    b: 'strong',
    em: 'em',
    i: 'em',
    u: 'underline',
    code: 'code',
};

/**
 * Inline HTML -> spans. `<br>` becomes a newline rather than a block break:
 * the CMS emits `<br>` inside a paragraph for soft wrapping, and promoting each
 * to its own paragraph is what makes a post render as a ragged column.
 */
export function parseInline(html: string): InlineSpan[] {
    const spans: InlineSpan[] = [];
    const markStack: InlineMark[] = [];
    const hrefStack: string[] = [];
    let buffer = '';

    const flush = () => {
        if (!buffer) return;
        spans.push({
            text: decodeEntities(buffer),
            marks: [...markStack],
            ...(hrefStack.length > 0 ? {href: hrefStack[hrefStack.length - 1]} : {}),
        });
        buffer = '';
    };

    const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(html)) !== null) {
        buffer += html.slice(cursor, match.index);
        cursor = match.index + match[0].length;

        const tag = match[1].toLowerCase();
        const closing = match[0][1] === '/';
        const selfClosing = match[2].trimEnd().endsWith('/');

        if (tag === 'br') {
            buffer += '\n';
            continue;
        }
        if (tag === 'a') {
            flush();
            if (closing) hrefStack.pop();
            else if (!selfClosing) hrefStack.push(parseAttributes(match[2]).href ?? '');
            continue;
        }

        const mark = MARK_BY_TAG[tag];
        if (!mark) continue;

        flush();
        if (closing) {
            const index = markStack.lastIndexOf(mark);
            if (index !== -1) markStack.splice(index, 1);
        } else if (!selfClosing) {
            markStack.push(mark);
        }
    }

    buffer += html.slice(cursor);
    flush();

    return spans.filter(span => span.text.length > 0);
}

export function spansToText(spans: InlineSpan[]): string {
    return spans.map(span => span.text).join('');
}

const BLOCK_RE =
    /<(h1|h2|h3|h4|h5|h6|p|ul|ol|blockquote|pre|img|hr)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<(img|hr|br)\b([^>]*?)\/?>/gi;

const LI_RE = /<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi;

/**
 * Parse a blog body into blocks.
 *
 * Deliberately not a real DOM: a regex over top-level block tags handles the
 * editor's output (which never nests a block inside a paragraph) and cannot
 * blow the stack on a malformed document. Text outside any block tag is kept as
 * a paragraph so nothing is silently dropped.
 */
export function parseHtmlBlocks(html: string | null | undefined): HtmlBlock[] {
    if (!html) return [];

    const source = html.replace(/<!--[\s\S]*?-->/g, '');
    const blocks: HtmlBlock[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;

    const pushLoose = (text: string) => {
        const spans = parseInline(text);
        if (spansToText(spans).trim().length > 0) blocks.push({type: 'paragraph', spans});
    };

    BLOCK_RE.lastIndex = 0;
    while ((match = BLOCK_RE.exec(source)) !== null) {
        if (match.index > cursor) pushLoose(source.slice(cursor, match.index));
        cursor = match.index + match[0].length;

        const tag = (match[1] ?? match[4]).toLowerCase();
        const attrs = parseAttributes(match[2] ?? match[5] ?? '');
        const inner = match[3] ?? '';

        if (tag === 'img') {
            if (attrs.src) blocks.push({type: 'image', src: attrs.src, alt: attrs.alt || undefined});
            continue;
        }
        if (tag === 'hr') {
            blocks.push({type: 'rule'});
            continue;
        }
        if (tag === 'br') continue;

        if (tag === 'ul' || tag === 'ol') {
            const items: InlineSpan[][] = [];
            LI_RE.lastIndex = 0;
            let li: RegExpExecArray | null;
            while ((li = LI_RE.exec(inner)) !== null) {
                // `<li><p>text</p></li>` is what the editor emits; strip the
                // wrapper rather than emitting an empty bullet.
                const spans = parseInline(li[1].replace(/<\/?p\b[^>]*>/gi, ''));
                if (spansToText(spans).trim().length > 0) items.push(spans);
            }
            if (items.length > 0) blocks.push({type: 'list', ordered: tag === 'ol', items});
            continue;
        }

        if (tag === 'pre') {
            const text = decodeEntities(inner.replace(/<[^>]+>/g, '')).replace(/^\n+|\n+$/g, '');
            if (text) blocks.push({type: 'code', text});
            continue;
        }

        // A paragraph whose only content is an image is how the editor wraps
        // figures; unwrap it so the image is not squeezed into a text block.
        if (tag === 'p') {
            const imgOnly = /^\s*(<img\b[^>]*>)\s*$/i.exec(inner);
            if (imgOnly) {
                const imgAttrs = parseAttributes(imgOnly[1]);
                if (imgAttrs.src) {
                    blocks.push({type: 'image', src: imgAttrs.src, alt: imgAttrs.alt || undefined});
                }
                continue;
            }
        }

        const spans = parseInline(inner);
        if (spansToText(spans).trim().length === 0) continue;

        if (tag === 'blockquote') {
            blocks.push({type: 'quote', spans});
        } else if (tag === 'p') {
            blocks.push({type: 'paragraph', spans});
        } else {
            // h1 has no place inside a body — the screen already renders the
            // title as the h1 — so it is demoted to the top body level.
            blocks.push({type: 'heading', level: tag === 'h1' || tag === 'h2' ? 2 : 3, spans});
        }
    }

    if (cursor < source.length) pushLoose(source.slice(cursor));

    return blocks;
}

/** Plain-text preview, for an excerpt fallback when the API sends none. */
export function htmlToPlainText(html: string | null | undefined, limit = 200): string {
    const text = parseHtmlBlocks(html)
        .flatMap(block =>
            block.type === 'image' || block.type === 'rule'
                ? []
                : block.type === 'list'
                  ? block.items.map(spansToText)
                  : block.type === 'code'
                    ? [block.text]
                    : [spansToText(block.spans)],
        )
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}
