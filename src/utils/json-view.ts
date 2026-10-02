/**
 * Rendering helpers for the raw JSON panes (task logs, Terraform state and
 * outputs) on the deployment detail page.
 *
 * Extracted from DeploymentDetailView.vue. Both are pure string functions, so
 * they are testable on their own rather than only through a mounted 2000-line
 * view.
 */

/**
 * Lightweight JSON syntax highlighting, returned as HTML.
 *
 * HTML-escapes its input first, so the result is safe to render with `v-html`
 * -- that escaping is the only thing standing between a Terraform output and
 * an injected `<script>`, and must stay ahead of the span-wrapping below.
 */
export function highlightJson(jsonString: string): string {
    if (!jsonString) return ''

    const safeStr = jsonString
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

    return safeStr.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
            let cls: string

            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'text-blue-500 font-medium' // keys
                } else {
                    cls = 'text-emerald-500' // string values
                }
            } else if (/true|false/.test(match)) {
                cls = 'text-purple-500 font-bold' // booleans
            } else if (/null/.test(match)) {
                cls = 'text-gray-500 italic' // null
            } else {
                cls = 'text-cyan-500' // numbers
            }

            return `<span class="${cls}">${match}</span>`
        }
    )
}


/**
 * Best-effort pretty-printing for a value that may be an object, a JSON
 * string, or ordinary log text. Anything that does not parse is returned
 * unchanged rather than replaced with an error.
 */
export function prettyJson(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2)
        } catch {
            return String(value)
        }
    }
    if (typeof value === 'string') {
        const trimmed = value.trim()
        // Cheap pre-check: only attempt JSON.parse on strings that look
        // like JSON. Saves a try/catch round-trip for ordinary log
        // text and avoids accidentally parsing a bare number or "null"
        // string into something the consumer didn't expect.
        if (
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
            try {
                return JSON.stringify(JSON.parse(trimmed), null, 2)
            } catch {
                return value
            }
        }
        return value
    }
    return String(value)
}
