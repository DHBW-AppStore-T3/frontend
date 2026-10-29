import { describe, expect, it } from 'vitest'
import { safeHttpUrl } from '../safe-url'

describe('safeHttpUrl', () => {
    it('keeps absolute http and https URLs', () => {
        expect(safeHttpUrl('https://ide-team-1-12345678.apps.example.org/')).toBe('https://ide-team-1-12345678.apps.example.org/')
        expect(safeHttpUrl('http://[2001:db8::1]:8080/pgadmin4')).toBe('http://[2001:db8::1]:8080/pgadmin4')
    })

    it.each([
        'javascript:alert(document.domain)',
        'JavaScript:alert(1)',
        ' javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        '//evil.example/x',
        '/relative/path',
        'not a url',
        '',
        null,
        undefined,
    ])('does not link %s', (url) => {
        expect(safeHttpUrl(url)).toBeUndefined()
    })
})
