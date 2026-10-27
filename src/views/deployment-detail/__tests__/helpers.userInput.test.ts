import { describe, it, expect } from 'vitest'
import { parseGroups, parseVariables } from '../helpers'

// The API returns ``userInputVar`` as an object (OpenAPI: DeploymentResponse),
// older data as a JSON string; both are read the same way.
describe('parseGroups / parseVariables with an already parsed userInputVar', () => {
  const uiv = {
    groupNames: ['A', 'B'],
    assignments: { 0: ['s1'], 1: ['s2', 's3'] },
    variables: { image: 'ubuntu' },
    terraform: { region: 'eu' },
  }

  it('builds groups from an object', () => {
    expect(parseGroups(uiv)).toEqual([
      { index: 0, name: 'A', students: ['s1'] },
      { index: 1, name: 'B', students: ['s2', 's3'] },
    ])
  })

  it('extracts the variables from an object', () => {
    expect(parseVariables(uiv)).toEqual({ image: 'ubuntu' })
  })

  it('gives the same result for the object and for its JSON string', () => {
    expect(parseGroups(uiv)).toEqual(parseGroups(JSON.stringify(uiv)))
    expect(parseVariables(uiv)).toEqual(parseVariables(JSON.stringify(uiv)))
  })

  it('returns empty results for an object without the stored keys', () => {
    expect(parseGroups({ terraform: {} })).toEqual([])
    expect(parseVariables({ terraform: {} })).toEqual({})
  })
})
