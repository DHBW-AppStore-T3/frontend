import type { AppVariable } from '@/types'

type VariablesMap = Record<string, any> | null | undefined

const DEFAULT_TEMPLATE_KEY = 'default'

const isPlainObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Multi-image Packer apps store their Packer values nested under
 * ``variables.packer[<template_key>][<name>]`` instead of flat under
 * ``variables[<name>]``. Detection: ``packer`` is a non-empty object whose
 * every entry is itself an object (a template-key bucket). A false positive
 * would at worst render one skewed summary line.
 */
export function isMultiImagePackerLayout(variables: VariablesMap): boolean {
  const packer = variables?.packer
  if (!isPlainObject(packer)) return false
  const keys = Object.keys(packer)
  return keys.length > 0 && keys.every((k) => isPlainObject(packer[k]))
}

/** Current value of a Packer variable in either layout (``undefined`` when unset). */
export function packerValueFor(def: AppVariable, variables: VariablesMap): unknown {
  if (isMultiImagePackerLayout(variables)) {
    const nested = variables?.packer?.[def.template_key ?? DEFAULT_TEMPLATE_KEY]?.[def.name]
    if (nested !== undefined) return nested
  }
  return variables?.[def.name]
}
