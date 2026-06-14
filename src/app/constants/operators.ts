export interface OperatorDefinition {
  value: string;
  label: string;
  requiresValueField: boolean;
}

export const UNIFIED_OPERATORS: OperatorDefinition[] = [
  { value: 'is', label: 'is', requiresValueField: true },
  { value: 'is not', label: 'is not', requiresValueField: true },
  { value: 'contains', label: 'contains', requiresValueField: true },
  { value: 'does not contains', label: 'does not contains', requiresValueField: true },
  { value: 'start with', label: 'start with', requiresValueField: true },
  { value: 'end with', label: 'end with', requiresValueField: true },
  { value: 'is blank', label: 'is blank', requiresValueField: false },
  { value: 'is not blank', label: 'is not blank', requiresValueField: false },
  { value: 'is null', label: 'is null', requiresValueField: false },
  { value: 'is not null', label: 'is not null', requiresValueField: false },
  { value: 'in list', label: 'in list', requiresValueField: true },
  { value: 'is different from', label: 'is different from', requiresValueField: true },
  { value: 'is greater then', label: 'is greater then', requiresValueField: true },
  { value: 'is greater or equal', label: 'is greater or equal', requiresValueField: true },
  { value: 'is less then', label: 'is less then', requiresValueField: true },
  { value: 'is less or equal', label: 'is less or equal', requiresValueField: true }
];

export function requiresValue(operator: string): boolean {
  const op = UNIFIED_OPERATORS.find(o => o.value === operator);
  return op ? op.requiresValueField : true;
}
