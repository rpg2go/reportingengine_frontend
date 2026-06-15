import { Component, ChangeDetectionStrategy, input, output, inject, OnInit } from '@angular/core';
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
    const group = catalog.find((g: any) => g.sourceTable === table);
    return group ? group.fields.map((f: any) => f.name) : [];
  }

  getRuleDistinctValues(rule: RowFilterRule): string[] {
    const table = rule.tableName || this.activeMeasureTable();
    const attr = rule.columnName;
    if (!table || !attr) return [];
    const key = `${table}.${attr}`;
    return this.distinctValuesCache[key] || [];
  }

  loadDistinctValues(rule: RowFilterRule) {
    const table = rule.tableName || this.activeMeasureTable();
    const attr = rule.columnName;
    if (!table || !attr) return;
    const key = `${table}.${attr}`;
    if (this.distinctValuesCache[key]) return;

    this.reportService.getDistinctValues(table, attr).subscribe({
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
}
