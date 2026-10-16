// @vitest-environment jsdom
// DOMPurify does not work on happy-dom (see markdown-html.ts), so these
// tests run on jsdom.
import { describe, expect, it } from 'vitest'
import { Window } from 'happy-dom'
import type { WindowLike } from 'dompurify'
import { createMarkdownSanitizer, sanitizeMarkdownHtml } from '../markdown-html'

const ATTACKS = [
    '<img src="x" onerror="alert(1)">',
    '<script>alert(2)</script>',
    '<a href="javascript:alert(3)">x</a>',
    '<svg><a xlink:href="javascript:alert(4)"><text>x</text></a></svg>',
    '<iframe src="https://evil.example/"></iframe>',
]

describe('sanitizeMarkdownHtml', () => {
    it('keeps what Markdown renders', () => {
        const html = '<h1>Titel</h1><p><a href="https://docs.example.org/">Doku</a> <code>x</code></p>'
            + '<table><thead><tr><th align="center">a</th></tr></thead></table>'
            + '<ul><li><input checked="" disabled="" type="checkbox"> fertig</li></ul>'
            + '<details><summary>Mehr</summary><img src="https://img.example.org/a.png" alt="a" width="200"></details>'

        expect(sanitizeMarkdownHtml(html, '')).toBe(html)
    })

    it.each(ATTACKS)('removes script from %s', (attack) => {
        expect(sanitizeMarkdownHtml(attack, '')).not.toMatch(/onerror|<script|javascript:|<iframe/i)
    })

    it('opens links with a target in a new tab without a handle on this window', () => {
        expect(sanitizeMarkdownHtml('<a href="https://evil.example/" target="_top" rel="opener">x</a>', ''))
            .toBe('<a href="https://evil.example/" target="_blank" rel="noopener noreferrer">x</a>')
        expect(sanitizeMarkdownHtml('<a href="https://docs.example.org/">x</a>', ''))
            .toBe('<a href="https://docs.example.org/">x</a>')
    })

    it('drops style sheets, style attributes and forms (their text stays)', () => {
        expect(sanitizeMarkdownHtml(
            '<style>body { display: none }</style><div style="position: fixed; inset: 0">Sitzung abgelaufen</div>'
            + '<form action="/api/auth"><input type="password" name="p"><textarea></textarea><select></select>'
            + '<button>Anmelden</button></form>',
            '',
        )).toBe('<div>Sitzung abgelaufen</div><input type="password" name="p">Anmelden')
    })
})

describe('createMarkdownSanitizer', () => {
    it('shows the plain text where DOMPurify cannot run', () => {
        const sanitize = createMarkdownSanitizer({} as WindowLike)

        expect(sanitize('<img src="x" onerror="alert(1)">', '# A <img src=x onerror=alert(1)>'))
            .toBe('# A &lt;img src=x onerror=alert(1)&gt;')
    })

    it('lets no script through on a DOM that breaks DOMPurify', () => {
        const sanitize = createMarkdownSanitizer(new Window() as unknown as WindowLike)

        for (const attack of ATTACKS) {
            expect(sanitize(attack, attack)).not.toMatch(/<script|<img[^>]*onerror|<a[^>]*javascript:|<iframe/i)
        }
    })
})
