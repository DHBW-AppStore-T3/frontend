/**
 * Links whose target comes from data, not from the app's own code: the
 * access URLs a deployment's outputs publish (for VM apps the app author's
 * OpenTofu code decides them), repository links. Only absolute http(s) URLs
 * become links; anything else (``javascript:``, ``data:``, relative paths)
 * is not linked, so a crafted output cannot run script in the AppStore's
 * origin when someone clicks it.
 */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined
    try {
        const parsed = new URL(url)
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined
    } catch {
        return undefined
    }
}
