import { describe, it, expectTypeOf } from 'vitest'
import type { AppVariable } from '@/types'
import {
  buildDraftValues,
  initialFromFetch,
  normalizeValue,
  restoreFromDraft,
  seedScopedDefault,
  type FormValues,
  type ScalarValue,
  type SlotMap,
  type SlotValue,
  type StoredValue,
  type StoredValues,
  type VariableValue,
} from '../variableForm'

/**
 * Compile-time checks (``tsc -b`` is the proof) for the value types of the
 * variables step (frontend#88): they replace ``any`` and must keep accepting
 * everything an ``AppVariable`` default can be.
 */
describe('variable value types', () => {
  it('covers every default an AppVariable can carry', () => {
    type Default = NonNullable<AppVariable['default']>
    expectTypeOf<Default>().toExtend<VariableValue>()
  })

  it('a scalar is a string, number or boolean', () => {
    expectTypeOf<ScalarValue>().toEqualTypeOf<string | number | boolean>()
    expectTypeOf<ScalarValue>().toExtend<VariableValue>()
  })

  it('a slot map is a valid form value and slots may be empty', () => {
    expectTypeOf<SlotMap>().toExtend<VariableValue>()
    expectTypeOf<null>().toExtend<SlotValue>()
    expectTypeOf<undefined>().toExtend<SlotValue>()
  })

  it('form values and stored values both hold the whole range', () => {
    expectTypeOf<FormValues[string]>().toEqualTypeOf<SlotValue>()
    expectTypeOf<StoredValues[string]>().toEqualTypeOf<StoredValue>()
    expectTypeOf<VariableValue>().toExtend<StoredValue>()
  })

  it('the functions return typed values, not any', () => {
    expectTypeOf(restoreFromDraft).returns.toEqualTypeOf<FormValues>()
    expectTypeOf(initialFromFetch).returns.toEqualTypeOf<FormValues>()
    expectTypeOf(seedScopedDefault).returns.toEqualTypeOf<SlotMap>()
    expectTypeOf(buildDraftValues).returns.toEqualTypeOf<{ changed: StoredValues; all: StoredValues }>()
    expectTypeOf(normalizeValue).parameter(0).toBeUnknown()
    expectTypeOf(normalizeValue).returns.not.toBeAny()
  })
})
