/**
 * Copy-paste connection strings for a deployment's per-user accounts.
 *
 * Pure string builders, extracted from DeploymentDetailView.vue. They have no
 * Vue dependency and no component state, which makes them directly testable --
 * they previously sat at the top of a ~2590-line SFC where the only way to
 * exercise them was to mount the whole detail page.
 */

/** One account's connection details, as published in the Terraform outputs. */
export interface ConnectionTarget {
    username?: string
    ip?: string
    port?: number
}

/**
 * Wrap a bare IPv6 literal in brackets so it can be embedded in a `host:port`
 * string. IPv4 addresses and hostnames pass through untouched.
 */
export function bracketHost(ip: string): string {
    return ip.includes(':') ? `[${ip}]` : ip
}

/**
 * Build an SSH command. The `-p` flag is omitted for the default port 22 so
 * the line stays short in the common case.
 */
export function sshCommandFor(data: ConnectionTarget): string {
    if (!data.username || !data.ip) return ''
    const portFlag = data.port && data.port !== 22 ? `-p ${data.port} ` : ''
    return `ssh ${portFlag}${data.username}@${data.ip}`
}

/**
 * Build an RDP command. Windows apps opt in by publishing
 * `authtype: "rdp"`, so apps that predate it keep their URL/SSH rendering.
 * `mstsc` needs an IPv6 literal bracketed.
 */
export function rdpCommandFor(data: ConnectionTarget): string {
    if (!data.ip) return ''
    return `mstsc /v:${bracketHost(data.ip)}:${data.port ?? 3389}`
}

/**
 * Build a per-user URL from an account's ip + port, preserving any path suffix
 * the team VM's URL carries (e.g. `/pgadmin4`). Returns null when the account
 * has no reachable address.
 */
export function userUrlFor(data: ConnectionTarget, teamVmUrl?: string): string | null {
    if (!data.ip || !data.port) return null
    let path = ''
    if (teamVmUrl) {
        try {
            path = new URL(teamVmUrl).pathname.replace(/\/$/, '')
        } catch { /* ignore malformed url */ }
    }
    return `http://${data.ip}:${data.port}${path}`
}
