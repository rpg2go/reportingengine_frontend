/**
 * filter-help.constants.ts
 *
 * Single source of truth for all user-facing tooltip descriptions and help panel
 * entries used in both the Quick Filter (RowFilterComponent) and the General Filters
 * Workspace (GeneralFilterModalComponent).
 *
 * To update a description, edit it ONCE here — both modals pick it up automatically.
 */

/** One entry row inside the Quick Reference help panel. */
export interface FilterHelpEntry {
  term: string;
  description: string;
}

/** All entries shown in the ⓘ collapsible Quick Reference panel. */
export const FILTER_HELP_ENTRIES: FilterHelpEntry[] = [
  {
    term: '+ Condition',
    description:
      'Add a single filter rule. Choose a <strong>table</strong> → <strong>column</strong> → <strong>operator</strong> → <strong>value(s)</strong>.',
  },
  {
    term: '+ Sub-Group',
    description:
      'Nest a new group with its own AND / OR logic — great for <em>(A AND B) OR (C AND D)</em> patterns.',
  },
  {
    term: 'AND',
    description: 'Every condition in this group must be true (intersection / narrowing).',
  },
  {
    term: 'OR',
    description: 'At least one condition in this group must be true (union / broadening).',
  },
  {
    term: 'is / is not',
    description: 'Exact equality or inequality match against a single value.',
  },
  {
    term: 'in list',
    description:
      'Match any one of several values — equivalent to SQL <em>IN (…)</em>. Supports autocomplete.',
  },
  {
    term: 'contains',
    description:
      "Partial text match — equivalent to SQL <em>LIKE '%value%'</em>. Use for free-text columns.",
  },
  {
    term: 'Table Scopes',
    description:
      'Each scope builds an independent filter for one database table. Scopes are combined by the engine at query time.',
  },
  {
    term: 'Custom SQL',
    description:
      'Switch to a free-text SQL expression for advanced cases not covered by the builder.',
  },
];

/**
 * Tooltip strings for every interactive button that appears in both filter modals.
 * Use as [title]="FILTER_TOOLTIPS.addCondition" etc. in templates.
 */
export const FILTER_TOOLTIPS = {
  helpToggle:
    'Toggle quick reference — shows operators, AND/OR logic, and sub-group explanations',
  andOperator:  'AND — all conditions in this group must be true simultaneously',
  orOperator:   'OR — at least one condition in this group must be true',
  andOrGroup:   'Choose how conditions in this group are combined: AND = ALL must match, OR = ANY must match',
  addCondition: 'Add a single filter rule — choose a table column, operator and value to match',
  addSubGroup:
    'Add a nested sub-group with its own independent AND / OR logic — useful for complex (A AND B) OR (C AND D) patterns',
  removeGroup:  'Remove this entire nested group and all its conditions',
  removeRule:   'Remove this condition row',
  tableSelect:  'Source table that contains the column to filter on',
  columnSelect: 'Column / attribute to filter on',
  operatorSelect:
    "Comparison operator: 'is' = exact match, 'is not' = exclude, 'in list' = match any of several values, 'contains' = partial text match",
  valueInput:   "Value(s) to match against — for 'in list' you can pick multiple values",
  editFilters:
    'Open the visual filter builder — add conditions, sub-groups and AND/OR logic to filter this row\'s data',
  customSql:
    'Switch to a free-text SQL expression editor for advanced filter expressions',
  sqlMode:      'Convert the current filter to a Custom SQL expression for manual editing',
  switchToBuilder: 'Switch back to the visual builder mode',
  saveAndClose: 'Save and close — your filter changes are applied immediately',
} as const;
