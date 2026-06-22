import { Component, ChangeDetectionStrategy, input, output, inject, OnInit, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { ValuePickerComponent } from './value-picker';
import { UNIFIED_OPERATORS, requiresValue } from '../constants/operators';

export interface RowFilterRule {
  tableName: string;
  columnName: string;
  operator: string;
  value: string[];
  requiresValueField?: boolean; // Optional cached layout check flag
}

export interface RowFilterGroup {
  id: string;
  logicalOperator: 'AND' | 'OR'; // Toggles the logical operator inside this specific group box
  rules: RowFilterRule[];        // Flat condition rules belonging directly to this group level
  childGroups: RowFilterGroup[]; // Sub-groups nested recursively beneath this parent block
}

@Component({
  selector: 'app-row-condition-group',
  standalone: true,
  imports: [CommonModule, FormsModule, ValuePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './row-condition-group.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .gp-rule-trigger {
      font-size: 11px;
      font-weight: 500;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 10px;
      min-width: 160px;
      max-width: 220px;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      color: var(--color-apple-text);
      cursor: pointer;
      transition: all 0.15s ease;
      box-sizing: border-box;
    }

    .gp-rule-trigger:hover:not(:disabled) {
      border-color: var(--color-apple-blue);
      box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.15);
    }

    .gp-rule-trigger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .gp-rule-popover {
      position: absolute;
      left: 0;
      top: 100%;
      margin-top: 4px;
      width: 280px;
      background: var(--color-apple-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: var(--shadow-md);
      z-index: 100;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 300px;
      box-sizing: border-box;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .gp-rule-search-input {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 5px 8px;
      color: var(--color-apple-text);
      outline: none;
      font-size: 11px;
      box-sizing: border-box;
    }

    .gp-rule-search-input:focus {
      border-color: var(--color-apple-blue);
    }

    .gp-rule-options-list {
      overflow-y: auto;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 220px;
    }

    .gp-rule-no-results {
      font-size: 11px;
      color: var(--color-apple-grey);
      font-style: italic;
      text-align: center;
      padding: 12px;
    }

    .gp-rule-group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 6px;
      background: var(--input-bg);
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px;
      font-weight: 700;
      color: var(--color-apple-grey);
      user-select: none;
      transition: all 0.15s ease;
    }

    .gp-rule-group-header:hover {
      background: rgba(0, 118, 223, 0.08);
      color: var(--color-apple-text);
    }

    .gp-rule-table-badge {
      font-size: 9px;
      font-family: monospace;
      background: var(--border-color);
      color: var(--color-apple-text);
      padding: 0px 4px;
      border-radius: 3px;
    }

    .gp-rule-fields-container {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding-left: 8px;
      border-left: 1px dashed var(--border-color);
      margin: 2px 0 2px 6px;
    }

    .gp-rule-option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 11px;
      font-family: monospace;
      color: var(--color-apple-text);
      border-radius: 4px;
      gap: 8px;
      transition: all 0.15s ease;
    }

    .gp-rule-option-item:hover {
      background: var(--color-apple-blue);
      color: white;
    }

    .gp-rule-option-item.selected {
      background: rgba(0, 118, 223, 0.15);
      color: var(--color-apple-blue);
      font-weight: 600;
    }

    .gp-rule-option-name {
      flex-grow: 1;
      word-break: break-all;
    }

    .gp-rule-option-type {
      font-size: 9px;
      color: var(--color-apple-grey);
      font-family: sans-serif;
    }

    .gp-rule-option-item:hover .gp-rule-option-type {
      color: rgba(255, 255, 255, 0.7);
    }

    :host-context(html.light) .gp-rule-group-header {
      background: #F8FAFC;
      color: #475569;
    }
    :host-context(html.light) .gp-rule-option-item {
      color: #334155;
    }
    :host-context(html.light) .gp-rule-option-item:hover {
      background: #4F46E5;
      color: #FFFFFF;
    }
    :host-context(html.light) .gp-rule-option-item.selected {
      background: #E0E7FF;
      color: #4338CA;
    }
    :host-context(html.light) .gp-rule-option-item.selected .gp-rule-option-name {
      color: #4338CA;
    }

    /* Mock Tailwind classes for single-line horizontal track layout */
    .w-\\[200px\\] { width: 200px !important; }
    .w-\\[140px\\] { width: 140px !important; }
    .flex-shrink-0 { flex-shrink: 0 !important; }
    .flex-1 { flex: 1 1 0% !important; }
    .ml-auto { margin-left: auto !important; }
    .gap-3 { gap: 0.75rem !important; }
    .w-full { width: 100% !important; }
    .bg-slate-50\\/60 { background-color: rgba(248, 250, 252, 0.6) !important; }
    .p-2 { padding: 0.5rem !important; }
    .rounded-xl { border-radius: 0.75rem !important; }
    .border-slate-100\\/50 { border-color: rgba(241, 245, 249, 0.5) !important; }
    
    .form-select {
      display: block;
      width: 100%;
      padding: 0.375rem 1.75rem 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 400;
      line-height: 1.5;
      color: var(--color-apple-text);
      background-color: var(--input-bg);
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 16px 12px;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
      appearance: none;
      box-sizing: border-box;
    }
    :host-context(html.light) .form-select {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23475569' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e");
    }
    .form-select:focus {
      border-color: #6366f1;
      outline: 0;
      box-shadow: 0 0 0 0.2rem rgba(99, 102, 241, 0.25);
    }
  `]
})
export class RowConditionGroupComponent implements OnInit {
  group = input.required<RowFilterGroup>();
  parentGroup = input<RowFilterGroup | null>(null);
  depth = input<number>(0);
  activeMeasureTable = input<string>('');
  dwhCatalog = input<any[]>([]);
  linkedDimensions = input<string[]>([]);
  columnTypes = input<{ [tableName: string]: { [columnName: string]: string } }>({});
  disabled = input<boolean>(false);

  removeGroup = output<string>();
  groupChanged = output<void>();

  private elementRef = inject(ElementRef);
  openRuleIndex = signal<number | null>(null);
  ruleSearchText = signal<string>('');
  ruleExpandedGroups = signal<Set<string>>(new Set());

  getDepthColorClass(depth: number): string {
    const classes = [
      'text-indigo-600',
      'text-emerald-600',
      'text-amber-500',
      'text-rose-500'
    ];
    return classes[depth % classes.length];
  }

  private reportService = inject(ReportService);
  distinctValuesCache: { [key: string]: string[] } = {};
  operators = UNIFIED_OPERATORS;

  requiresValueField(operator: string): boolean {
    return requiresValue(operator);
  }

  ngOnInit() {
    this.preloadValues();
  }

  preloadValues() {
    const rules = this.group().rules || [];
    rules.forEach(rule => {
      rule.requiresValueField = this.requiresValueField(rule.operator);
      if (rule.columnName) {
        this.loadDistinctValues(rule);
      }
    });
  }

  setOperator(op: 'AND' | 'OR') {
    this.group().logicalOperator = op;
    this.groupChanged.emit();
  }

  addCondition() {
    const rules = this.group().rules || [];
    rules.push({
      tableName: '',
      columnName: '',
      operator: 'is',
      value: [],
      requiresValueField: true
    });
    this.groupChanged.emit();
  }

  addSubGroup() {
    const childGroups = this.group().childGroups || [];
    childGroups.push({
      id: this.generateId(),
      logicalOperator: 'AND',
      rules: [],
      childGroups: []
    });
    this.groupChanged.emit();
  }

  removeSelf() {
    this.removeGroup.emit(this.group().id);
  }

  removeRule(index: number) {
    const rules = this.group().rules || [];
    rules.splice(index, 1);
    this.groupChanged.emit();
  }

  onTableChange(rule: RowFilterRule) {
    rule.columnName = '';
    rule.value = [];
    this.groupChanged.emit();
  }

  onColumnChange(rule: RowFilterRule) {
    rule.value = [];
    this.groupChanged.emit();
    if (rule.columnName) {
      this.loadDistinctValues(rule);
    }
  }

  onRuleValuesChange(rule: RowFilterRule, vals: string[]) {
    rule.value = vals;
    this.groupChanged.emit();
  }

  onRuleChange() {
    this.groupChanged.emit();
  }

  onOperatorChange(rule: RowFilterRule) {
    rule.requiresValueField = this.requiresValueField(rule.operator);
    if (!rule.requiresValueField) {
      rule.value = [];
    }
    this.groupChanged.emit();
  }

  onRemoveChildGroup(childId: string) {
    const childGroups = this.group().childGroups || [];
    const index = childGroups.findIndex(c => c.id === childId);
    if (index !== -1) {
      childGroups.splice(index, 1);
      this.groupChanged.emit();
    }
  }

  onChildGroupChanged() {
    this.groupChanged.emit();
  }

  getAvailableColumns(tableName: string): string[] {
    const table = tableName || this.activeMeasureTable();
    if (!table) return [];
    const catalog = this.dwhCatalog();
    const normTable = table.replace(/^analytics\./, '');
    const group = catalog.find((g: any) => g.sourceTable.replace(/^analytics\./, '') === normTable);
    return group ? group.fields.map((f: any) => f.name) : [];
  }

  getRuleDistinctValues(rule: RowFilterRule): string[] {
    const table = rule.tableName || this.activeMeasureTable();
    const attr = rule.columnName;
    if (!table || !attr) return [];
    const key = `${table.replace(/^analytics\./, '')}.${attr}`;
    return this.distinctValuesCache[key] || [];
  }

  loadDistinctValues(rule: RowFilterRule) {
    const table = rule.tableName || this.activeMeasureTable();
    const attr = rule.columnName;
    if (!table || !attr) return;
    const normTable = table.replace(/^analytics\./, '');
    const key = `${normTable}.${attr}`;
    if (this.distinctValuesCache[key]) return;

    const catalog = this.dwhCatalog();
    const matchedGroup = catalog.find((g: any) => g.sourceTable.replace(/^analytics\./, '') === normTable);
    const apiTable = matchedGroup ? matchedGroup.sourceTable : table;

    this.reportService.getDistinctValues(apiTable, attr).subscribe({
      next: (vals) => {
        this.distinctValuesCache[key] = vals;
        this.distinctValuesCache = { ...this.distinctValuesCache };
      },
      error: () => {
        this.distinctValuesCache[key] = [];
      }
    });
  }

  generateId(): string {
    return 'group_' + Math.random().toString(36).substring(2, 9);
  }

  toggleRulePicker(index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openRuleIndex() === index) {
      this.closeRulePicker();
    } else {
      this.openRuleIndex.set(index);
      this.ruleSearchText.set('');
      // Pre-expand active/conformed table groups
      const rule = this.group().rules[index];
      const activeTable = rule?.tableName || (this.activeMeasureTable() ? this.activeMeasureTable().replace(/^analytics\./, '') : '');
      const fullActiveTable = activeTable 
        ? (activeTable.includes('.') ? activeTable : `analytics.${activeTable}`)
        : '';
      const expandSet = new Set<string>();
      if (fullActiveTable) expandSet.add(fullActiveTable);
      if (this.activeMeasureTable()) expandSet.add(this.activeMeasureTable());
      this.ruleExpandedGroups.set(expandSet);
    }
  }

  closeRulePicker(): void {
    this.openRuleIndex.set(null);
    this.ruleSearchText.set('');
  }

  toggleRuleGroup(tableName: string, event: MouseEvent): void {
    event.stopPropagation();
    this.ruleExpandedGroups.update(set => {
      const next = new Set(set);
      next.has(tableName) ? next.delete(tableName) : next.add(tableName);
      return next;
    });
  }

  getRuleDisplayLabel(rule: RowFilterRule): string {
    if (!rule.columnName) return '-- Select Column --';
    const cleanTable = rule.tableName 
      ? rule.tableName.replace(/^analytics\./, '') 
      : this.activeMeasureTable().replace(/^analytics\./, '');
    return `${cleanTable}.${rule.columnName}`;
  }

  getGroupedCatalogOptions() {
    const catalog = this.dwhCatalog() || [];
    const factTable = this.activeMeasureTable();
    const dims = this.linkedDimensions() || [];
    
    // If no fact table is selected, fallback to show all tables in the DWH catalog
    const showAll = !factTable;
    
    const allowedTables = new Set<string>([
      factTable,
      ...dims,
      ...dims.map(d => `analytics.${d}`)
    ]);
    
    const groups: { tableName: string; cleanTableName: string; fields: any[] }[] = [];
    catalog.forEach((g: any) => {
      if (showAll || allowedTables.has(g.sourceTable)) {
        const isFact = g.sourceTable === factTable;
        groups.push({
          tableName: g.sourceTable,
          cleanTableName: isFact 
            ? `${g.sourceTable.replace(/^analytics\./, '')} (Fact)` 
            : g.sourceTable.replace(/^analytics\./, ''),
          fields: g.fields || []
        });
      }
    });
    return groups;
  }

  getFilteredGroups() {
    const groups = this.getGroupedCatalogOptions();
    const query = this.ruleSearchText().toLowerCase().trim();
    const expanded = this.ruleExpandedGroups();
    
    if (!query) {
      return groups.map(g => ({
        ...g,
        isExpanded: expanded.has(g.tableName)
      }));
    }
    
    const result: any[] = [];
    groups.forEach(g => {
      const filteredFields = g.fields.filter((f: any) =>
        f.name.toLowerCase().includes(query) ||
        g.cleanTableName.toLowerCase().includes(query)
      );
      if (filteredFields.length > 0) {
        result.push({
          ...g,
          fields: filteredFields,
          isExpanded: true
        });
      }
    });
    return result;
  }

  selectRuleField(rule: RowFilterRule, tableName: string, columnName: string, index: number) {
    const factShort = this.activeMeasureTable().replace(/^analytics\./, '');
    const selectedShort = tableName.replace(/^analytics\./, '');
    
    rule.tableName = selectedShort === factShort ? '' : selectedShort;
    rule.columnName = columnName;
    rule.value = [];
    this.closeRulePicker();
    this.groupChanged.emit();
    this.loadDistinctValues(rule);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.openRuleIndex() !== null && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeRulePicker();
    }
  }
}
