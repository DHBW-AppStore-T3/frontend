/** HCL type predicates shared by the wizard's variable widgets and form logic. */

export const isBool = (type: string): boolean => ['bool', 'boolean'].includes(type.toLowerCase())

export const isNumber = (type: string): boolean => ['number', 'int', 'integer'].includes(type.toLowerCase())

export const isList = (type: string): boolean => /^(list|set|array)/i.test(type)
