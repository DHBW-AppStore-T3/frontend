/**
 * Sanitiser for the HTML of rendered Markdown: app descriptions and READMEs,
 * written by app owners and shown to everybody inside the AppStore's page.
 * On top of DOMPurify's defaults (no script, event handlers or `javascript:`
 * URLs):
 *  - no `<style>`, `style` attributes or forms, so a description can neither
 *    restyle nor cover the page around it, nor ask for a password in it
 *    (GitHub renders READMEs the same way, so they do not rely on these);
 *  - a link that opens elsewhere opens a new tab that gets no handle on the
 *    AppStore's window (`rel="opener"` would let it navigate this tab, e.g.
 *    to a fake login page).
 *
 * DOMPurify gives its input back unchanged where it cannot work, and some
 * DOM implementations break it without it noticing (happy-dom 20: every
 * element looks detached). So the sanitiser checks once that it really
 * removes what it must; if not, the caller's plain text is shown, escaped.
 */
import DOMPurify, { type Config, type WindowLike } from 'dompurify'

const CONFIG: Config = {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style'],
}

const PROBE = '<img src="x" onerror="alert(1)"><b style="color: red">ok</b><script>alert(2)</script>'
const PROBE_CLEAN = '<img src="x"><b>ok</b>'

export type MarkdownSanitizer = (html: string, plainText: string) => string

export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function createMarkdownSanitizer(win: WindowLike): MarkdownSanitizer {
    const plain: MarkdownSanitizer = (_html, plainText) => escapeHtml(plainText)
    // An own instance, so the hook stays out of any other use of DOMPurify.
    const purify = DOMPurify(win)
    if (!purify.isSupported) return plain
    // Only elements reach this hook.
    purify.addHook('afterSanitizeAttributes', (node) => {
        const element = node as Element
        if (element.hasAttribute('target')) {
            element.setAttribute('target', '_blank')
            element.setAttribute('rel', 'noopener noreferrer')
        }
    })
    if (purify.sanitize(PROBE, CONFIG) !== PROBE_CLEAN) return plain
    return (html) => purify.sanitize(html, CONFIG)
}

export const sanitizeMarkdownHtml: MarkdownSanitizer = createMarkdownSanitizer(window)
