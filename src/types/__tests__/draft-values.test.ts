import { describe, it, expectTypeOf } from 'vitest'
import type { ComponentProps } from 'react'
import type { DeploymentDraft, ScalarValue, SlotValue, StoredValues, VariableValue } from '..'
import type VariableInput from '@/components/VariableInput'
import type { VariableCardProps } from '@/views/new-deployment/VariableCard'
import type { FormValues } from '@/views/new-deployment/variableForm'
import { useVariableForm } from '@/views/new-deployment/useVariableForm'

/**
 * Compile-time checks (``tsc -b`` is the proof) for the variable values in the
 * draft and the wizard's variable UI (frontend#89).
 */
describe('draft variable values and variable UI types', () => {
  it('the draft keeps variables as stored values and userInputVar as JSON text or a parsed object', () => {
    expectTypeOf<DeploymentDraft['variables']>().toEqualTypeOf<StoredValues>()
    expectTypeOf<DeploymentDraft['userInputVar']>().toEqualTypeOf<StoredValues | string>()
    expectTypeOf<string>().toExtend<DeploymentDraft['userInputVar']>()
    expectTypeOf<{ a: number }>().toExtend<DeploymentDraft['userInputVar']>()
  })

  it('the form values can be saved as the draft variables', () => {
    expectTypeOf<FormValues>().toExtend<StoredValues>()
  })

  it('the input takes any form value and emits only scalars', () => {
    type Props = ComponentProps<typeof VariableInput>
    expectTypeOf<Props['value']>().toEqualTypeOf<SlotValue>()
    expectTypeOf<Props['onChange']>().toEqualTypeOf<(value: ScalarValue) => void>()
  })

  it('the card passes the same value types through', () => {
    expectTypeOf<VariableCardProps['value']>().toEqualTypeOf<SlotValue>()
    expectTypeOf<VariableCardProps['getScopedValue']>().toEqualTypeOf<(slot: string) => VariableValue>()
    expectTypeOf<VariableCardProps['onChange']>().toEqualTypeOf<(value: ScalarValue) => void>()
    expectTypeOf<VariableCardProps['onScopedChange']>().toEqualTypeOf<(slot: string, value: ScalarValue) => void>()
  })

  it('the form hook sets slot values and reads variable values', () => {
    type Form = ReturnType<typeof useVariableForm>
    expectTypeOf<Form['setValue']>().toEqualTypeOf<(key: string, value: SlotValue) => void>()
    expectTypeOf<Form['setScopedValue']>().toEqualTypeOf<(key: string, slot: string, value: SlotValue) => void>()
    expectTypeOf<Form['getScopedValue']>().toEqualTypeOf<(key: string, slot: string) => VariableValue>()
    expectTypeOf<Form['formValues']>().toEqualTypeOf<FormValues>()
  })
})
