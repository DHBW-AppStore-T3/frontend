import { describe, it, expect } from 'vitest'

import {
  bracketHost,
  sshCommandFor,
  rdpCommandFor,
  userUrlFor,
} from '@/utils/connection-commands'

// These lived at the top of DeploymentDetailView.vue and had no tests --
// reaching them meant mounting a ~2590-line component. They are pure string
// builders, so pulling them into a module made them directly testable.

describe('bracketHost', () => {
  it('brackets an IPv6 literal so it can carry a port', () => {
    expect(bracketHost('2001:db8::1')).toBe('[2001:db8::1]')
  })

  it('leaves IPv4 and hostnames alone', () => {
    expect(bracketHost('10.0.0.4')).toBe('10.0.0.4')
    expect(bracketHost('vm.example.org')).toBe('vm.example.org')
  })
})

describe('sshCommandFor', () => {
  it('omits the port flag for the default port', () => {
    expect(sshCommandFor({ username: 'ubuntu', ip: '10.0.0.4', port: 22 }))
      .toBe('ssh ubuntu@10.0.0.4')
  })

  it('omits the port flag when no port is given', () => {
    expect(sshCommandFor({ username: 'ubuntu', ip: '10.0.0.4' }))
      .toBe('ssh ubuntu@10.0.0.4')
  })

  it('includes the port flag for a non-default port', () => {
    expect(sshCommandFor({ username: 'ubuntu', ip: '10.0.0.4', port: 2222 }))
      .toBe('ssh -p 2222 ubuntu@10.0.0.4')
  })

  it('returns an empty string when the account is incomplete', () => {
    expect(sshCommandFor({ ip: '10.0.0.4' })).toBe('')
    expect(sshCommandFor({ username: 'ubuntu' })).toBe('')
    expect(sshCommandFor({})).toBe('')
  })
})

describe('rdpCommandFor', () => {
  it('defaults to the standard RDP port', () => {
    expect(rdpCommandFor({ ip: '10.0.0.4' })).toBe('mstsc /v:10.0.0.4:3389')
  })

  it('uses an explicit port when given', () => {
    expect(rdpCommandFor({ ip: '10.0.0.4', port: 3390 }))
      .toBe('mstsc /v:10.0.0.4:3390')
  })

  it('brackets an IPv6 address, which mstsc requires', () => {
    expect(rdpCommandFor({ ip: '2001:db8::1' }))
      .toBe('mstsc /v:[2001:db8::1]:3389')
  })

  it('returns an empty string without an address', () => {
    expect(rdpCommandFor({ username: 'admin' })).toBe('')
  })
})

describe('userUrlFor', () => {
  it('builds a url from the account address and port', () => {
    expect(userUrlFor({ ip: '10.0.0.4', port: 8080 }))
      .toBe('http://10.0.0.4:8080')
  })

  it("carries over the path from the team VM's url", () => {
    expect(userUrlFor({ ip: '10.0.0.4', port: 8080 }, 'http://team-vm:5050/pgadmin4'))
      .toBe('http://10.0.0.4:8080/pgadmin4')
  })

  it('strips a trailing slash from the carried path', () => {
    expect(userUrlFor({ ip: '10.0.0.4', port: 8080 }, 'http://team-vm:5050/lab/'))
      .toBe('http://10.0.0.4:8080/lab')
  })

  it('ignores a malformed team url rather than failing', () => {
    expect(userUrlFor({ ip: '10.0.0.4', port: 8080 }, 'not a url'))
      .toBe('http://10.0.0.4:8080')
  })

  it('returns null when the account has no reachable address', () => {
    expect(userUrlFor({ ip: '10.0.0.4' })).toBeNull()
    expect(userUrlFor({ port: 8080 })).toBeNull()
  })
})
