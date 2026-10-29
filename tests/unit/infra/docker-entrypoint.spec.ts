// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// The entrypoint writes the runtime configuration of the container (CSP,
// listen, API gateway) from environment variables. The script has fixed
// paths (/tmp/runtime, /usr/share/nginx/html); the test runs a copy with
// those pointed at a scratch directory.
//
// The scratch path is written into the script text, where both places are
// unquoted shell words. A Windows path (C:\Users\...) would lose its
// backslashes there (C:Users...), and a space would split it, so it goes in
// as a single-quoted POSIX path (forward slashes; Git for Windows' sh accepts
// C:/...).
const SCRIPT = resolve(__dirname, '../../../docker-entrypoint.sh')
const has = (tool: string, args: string[]) => spawnSync(tool, args).status === 0
const hasShellTools = has('sh', ['-c', 'exit 0']) && has('envsubst', ['--version'])
const RUNTIME_FILES = [
  'api-gateway.conf',
  'env-config.js',
  'listen.conf',
  'security-headers.conf',
  'silent-refresh-headers.conf',
]

function shQuote(path: string) {
  return `'${path.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`
}

// Without sh and envsubst the tests below cannot run. Locally that is a
// visible skip; in CI it must fail instead of silently dropping them.
it('has sh and envsubst in CI', () => {
  if (process.env.CI) expect(hasShellTools).toBe(true)
})

describe.skipIf(!hasShellTools && !process.env.CI)('docker-entrypoint.sh', () => {
  let dir: string

  beforeEach(() => {
    // a space in the name keeps the quoting honest on every platform
    dir = mkdtempSync(join(tmpdir(), 'entrypoint spaces-'))
    writeFileSync(join(dir, 'env-config.js'), "window.__ENV__ = { API: '${VITE_API_URL}' }\n")
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  function run(env: Record<string, string>) {
    const script = readFileSync(SCRIPT, 'utf8')
      .replaceAll('/tmp/runtime', shQuote(join(dir, 'runtime')))
      .replaceAll('/usr/share/nginx/html', shQuote(dir))
    const path = join(dir, 'entrypoint.sh')
    writeFileSync(path, script)
    // cwd in the scratch directory: a stray relative path lands there and is
    // removed with it, not in the repository
    return spawnSync('sh', [path], { cwd: dir, env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' })
  }
  // A run that has to succeed: exit 0, no complaint, all five files written
  // and nothing else left behind in the scratch directory.
  function runOk(env: Record<string, string>) {
    const result = run(env)
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(readdirSync(dir).sort()).toEqual(['entrypoint.sh', 'env-config.js', 'runtime'])
    expect(readdirSync(join(dir, 'runtime')).sort()).toEqual(RUNTIME_FILES)
    return result
  }
  const read = (name: string) => readFileSync(join(dir, 'runtime', name), 'utf8')

  it.each([
    ['a quote', "https://a'b"],
    ['a semicolon', 'https://a;b'],
    ['a dollar sign', 'https://a$b'],
    ['an angle bracket', 'https://a<b'],
    ['a backslash', 'https://a\\b'],
  ])('refuses a setting with %s and stops', (_label, value) => {
    const result = run({ VITE_API_URL: value })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('VITE_API_URL contains a character that is not allowed')
  })

  it('refuses FRAME_ANCESTORS with a semicolon', () => {
    const result = run({ FRAME_ANCESTORS: "https://moodle.example.org; script-src *" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('FRAME_ANCESTORS contains a character that is not allowed')
  })

  it('refuses an API_UPSTREAM that is not host:port', () => {
    const result = run({ API_UPSTREAM: 'api:8000/evil;' })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('API_UPSTREAM must be host:port')
  })

  it('writes env-config.js with the substituted settings', () => {
    runOk({ VITE_API_URL: 'https://api.example.org' })

    expect(read('env-config.js')).toContain("API: 'https://api.example.org'")
  })

  it('allows only its own origin plus the API and Keycloak in the CSP, and denies framing by default', () => {
    runOk({ VITE_API_URL: 'https://api.example.org/v1', VITE_KEYCLOAK_URL: 'https://sso.example.org/' })

    const headers = read('security-headers.conf')
    expect(headers).toContain("script-src 'self';")
    expect(headers).toContain("connect-src 'self' https://api.example.org https://sso.example.org;")
    expect(headers).toContain("frame-ancestors 'none'")
    expect(headers).toContain('X-Frame-Options "DENY"')
  })

  it('lets the configured origin frame the app and drops X-Frame-Options', () => {
    runOk({ FRAME_ANCESTORS: 'https://moodle.example.org' })

    const headers = read('security-headers.conf')
    expect(headers).toContain('frame-ancestors https://moodle.example.org')
    expect(headers).not.toContain('X-Frame-Options')
  })

  describe('silent-refresh.html (framed by the app itself)', () => {
    it('may be framed by its own origin only, even when nobody may frame the app', () => {
      runOk({ VITE_KEYCLOAK_URL: 'https://sso.example.org/' })

      const silent = read('silent-refresh-headers.conf')
      expect(silent).toContain("frame-ancestors 'self'")
      expect(silent).toContain('X-Frame-Options "SAMEORIGIN"')
      expect(silent).not.toContain("frame-ancestors 'none'")
      expect(silent).not.toContain('"DENY"')
      // the app pages keep refusing to be framed
      expect(read('security-headers.conf')).toContain("frame-ancestors 'none'")
    })

    it('keeps the same script, connect and frame sources as the app', () => {
      runOk({ VITE_API_URL: 'https://api.example.org', VITE_KEYCLOAK_URL: 'https://sso.example.org/' })

      const silent = read('silent-refresh-headers.conf')
      expect(silent).toContain("script-src 'self';")
      expect(silent).toContain("connect-src 'self' https://api.example.org https://sso.example.org;")
      expect(silent).toContain("frame-src 'self' https://sso.example.org;")
    })

    it('is not opened to Moodle when only the app is', () => {
      runOk({ FRAME_ANCESTORS: 'https://moodle.example.org' })

      expect(read('silent-refresh-headers.conf')).not.toContain('moodle.example.org')
    })
  })

  it('routes /api to the upstream and never /api/internal', () => {
    runOk({ API_UPSTREAM: 'appstore-api:8000' })

    const gateway = read('api-gateway.conf')
    expect(gateway).toContain('proxy_pass http://appstore-api:8000/;')
    expect(gateway).toContain('location ^~ /api/internal/ { return 404; }')
  })

  it('caps the request body at 16m: 10 MiB of files as base64 plus the rest of the request', () => {
    runOk({ API_UPSTREAM: 'appstore-api:8000' })

    expect(read('api-gateway.conf')).toContain('client_max_body_size 16m;')
  })

  it('leaves the gateway file empty without API_UPSTREAM', () => {
    runOk({})

    expect(read('api-gateway.conf')).toBe('')
  })

  it('listens on 8080', () => {
    runOk({})

    expect(read('listen.conf')).toContain('listen 8080;')
  })
})

