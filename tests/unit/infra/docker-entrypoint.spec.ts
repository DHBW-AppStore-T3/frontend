// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// The entrypoint writes the runtime configuration of the container (CSP,
// listen, API gateway) from environment variables. The script has fixed
// paths (/tmp/runtime, /usr/share/nginx/html); the test runs a copy with
// those pointed at a scratch directory.
const SCRIPT = resolve(__dirname, '../../../docker-entrypoint.sh')
const hasEnvsubst = spawnSync('envsubst', ['--version']).status === 0

describe.skipIf(!hasEnvsubst)('docker-entrypoint.sh', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'entrypoint-'))
    writeFileSync(join(dir, 'env-config.js'), "window.__ENV__ = { API: '${VITE_API_URL}' }\n")
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  function run(env: Record<string, string>) {
    const script = readFileSync(SCRIPT, 'utf8')
      .replaceAll('/tmp/runtime', join(dir, 'runtime'))
      .replaceAll('/usr/share/nginx/html', dir)
    const path = join(dir, 'entrypoint.sh')
    writeFileSync(path, script)
    return spawnSync('sh', [path], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' })
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
    expect(run({ FRAME_ANCESTORS: "https://moodle.example.org; script-src *" }).status).toBe(1)
  })

  it('refuses an API_UPSTREAM that is not host:port', () => {
    expect(run({ API_UPSTREAM: 'api:8000/evil;' }).status).toBe(1)
  })

  it('writes env-config.js with the substituted settings', () => {
    run({ VITE_API_URL: 'https://api.example.org' })

    expect(read('env-config.js')).toContain("API: 'https://api.example.org'")
  })

  it('allows only its own origin plus the API and Keycloak in the CSP, and denies framing by default', () => {
    run({ VITE_API_URL: 'https://api.example.org/v1', VITE_KEYCLOAK_URL: 'https://sso.example.org/' })

    const headers = read('security-headers.conf')
    expect(headers).toContain("script-src 'self';")
    expect(headers).toContain("connect-src 'self' https://api.example.org https://sso.example.org;")
    expect(headers).toContain("frame-ancestors 'none'")
    expect(headers).toContain('X-Frame-Options "DENY"')
  })

  it('lets the configured origin frame the app and drops X-Frame-Options', () => {
    run({ FRAME_ANCESTORS: 'https://moodle.example.org' })

    const headers = read('security-headers.conf')
    expect(headers).toContain('frame-ancestors https://moodle.example.org')
    expect(headers).not.toContain('X-Frame-Options')
  })

  describe('silent-refresh.html (framed by the app itself)', () => {
    it('may be framed by its own origin only, even when nobody may frame the app', () => {
      run({ VITE_KEYCLOAK_URL: 'https://sso.example.org/' })

      const silent = read('silent-refresh-headers.conf')
      expect(silent).toContain("frame-ancestors 'self'")
      expect(silent).toContain('X-Frame-Options "SAMEORIGIN"')
      expect(silent).not.toContain("frame-ancestors 'none'")
      expect(silent).not.toContain('"DENY"')
      // the app pages keep refusing to be framed
      expect(read('security-headers.conf')).toContain("frame-ancestors 'none'")
    })

    it('keeps the same script, connect and frame sources as the app', () => {
      run({ VITE_API_URL: 'https://api.example.org', VITE_KEYCLOAK_URL: 'https://sso.example.org/' })

      const silent = read('silent-refresh-headers.conf')
      expect(silent).toContain("script-src 'self';")
      expect(silent).toContain("connect-src 'self' https://api.example.org https://sso.example.org;")
      expect(silent).toContain("frame-src 'self' https://sso.example.org;")
    })

    it('is not opened to Moodle when only the app is', () => {
      run({ FRAME_ANCESTORS: 'https://moodle.example.org' })

      expect(read('silent-refresh-headers.conf')).not.toContain('moodle.example.org')
    })
  })

  it('routes /api to the upstream and never /api/internal', () => {
    run({ API_UPSTREAM: 'appstore-api:8000' })

    const gateway = read('api-gateway.conf')
    expect(gateway).toContain('proxy_pass http://appstore-api:8000/;')
    expect(gateway).toContain('location ^~ /api/internal/ { return 404; }')
  })

  it('leaves the gateway file empty without API_UPSTREAM', () => {
    run({})

    expect(read('api-gateway.conf')).toBe('')
  })

  it('listens on 8080', () => {
    run({})

    expect(read('listen.conf')).toContain('listen 8080;')
  })
})

