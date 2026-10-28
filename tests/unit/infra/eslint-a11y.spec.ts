// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { ESLint } from 'eslint'

// eslint-plugin-jsx-a11y does not list ESLint 10 as a peer (package.json
// "overrides"). A plugin that loads but silently stops reporting would leave
// the lint gate green, so these specs lint small fixtures with the project
// config and expect the rules to fire.

let eslint: ESLint

// Loading the config and the TypeScript parser takes seconds; do it once.
beforeAll(async () => {
  eslint = new ESLint({ cwd: process.cwd() })
  await rulesFor('export const Warm = () => <div />')
}, 60_000)

async function rulesFor(code: string, filePath = 'src/__fixture__/Fixture.tsx') {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.map((m) => m.ruleId)
}

describe('jsx-a11y rules run under the project ESLint', () => {
  it.each([
    ['alt-text', '<img src="/a.png" />'],
    ['aria-role', '<div role="banana" />'],
    ['aria-props', '<div aria-labeled="x" />'],
    ['tabindex-no-positive', '<div tabIndex={2} />'],
    ['anchor-is-valid', '<a href="#">x</a>'],
    ['autocomplete-valid', '<input autoComplete="nope" aria-label="x" />'],
    ['role-has-required-aria-props', '<div role="checkbox" />'],
    ['no-autofocus', '<input autoFocus aria-label="x" />'],
    ['interactive-supports-focus', '<div role="button" onKeyDown={() => {}} />'],
    ['label-has-associated-control', '<label>Name</label>'],
  ])('reports %s', async (rule, jsx) => {
    const rules = await rulesFor(`export const X = () => <div>${jsx}</div>\n`)
    expect(rules).toContain(`jsx-a11y/${rule}`)
  })

  it('sees a custom control component named in controlComponents', async () => {
    const rules = await rulesFor(
      'export const X = () => <label>Name<BaseInput value="" /></label>\n',
    )
    expect(rules).not.toContain('jsx-a11y/label-has-associated-control')
  })

  it('accepts a label wired by htmlFor and id', async () => {
    const rules = await rulesFor(
      'export const X = () => <><label htmlFor="n">Name</label><input id="n" /></>\n',
    )
    expect(rules.filter((r) => r?.startsWith('jsx-a11y/'))).toEqual([])
  })
})

describe('known limits and staged rules', () => {
  // Documented in eslint.config.js: an expression as label text is not seen.
  // If this starts failing the rule got smarter; drop the comment there.
  it('label-has-associated-control does not see <label>{t("key")}</label>', async () => {
    const rules = await rulesFor(
      'declare const t: (k: string) => string\nexport const X = () => <><label>{t("a")}</label><input /></>\n',
    )
    expect(rules).not.toContain('jsx-a11y/label-has-associated-control')
  })

  it.each([
    'click-events-have-key-events',
    'no-static-element-interactions',
    'no-noninteractive-element-interactions',
  ])('keeps %s off until the keyboard design lands (#139)', async (rule) => {
    const rules = await rulesFor(
      'export const X = () => <><div onClick={() => {}} /><p onClick={() => {}} /></>\n',
    )
    expect(rules).not.toContain(`jsx-a11y/${rule}`)
  })

  it('applies to src only, not to specs', async () => {
    const rules = await rulesFor('export const X = () => <img src="/a.png" />\n', 'tests/unit/Fixture.tsx')
    expect(rules).not.toContain('jsx-a11y/alt-text')
  })
})
