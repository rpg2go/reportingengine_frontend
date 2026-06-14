import { Component, ChangeDetectionStrategy, input, output, signal, ElementRef, inject, OnInit, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RowConditionGroupComponent, RowFilterGroup, RowFilterRule } from './row-condition-group';

@Component({
  selector: 'app-row-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, RowConditionGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '[class.is-open]': 'isOpen()',
  },
  templateUrl: './row-filter.html',
  styles: [`
    :host {
      display: block;
      position: relative;
      overflow: visible !important;
    }

    .row-filter-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }

    .filter-chips-mini {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      min-height: 20px;
    }

    .filter-tag-mini {
      display: inline-flex;
      align-items: center;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 10px;
      color: var(--color-apple-text);
      gap: 4px;
      transition: all 0.15s ease;
    }

    .ft-remove {
      background: transparent;
      border: none;
      color: var(--color-apple-grey);
      cursor: pointer;
      font-size: 9px;
      padding: 0 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
    }

    .ft-remove:hover {
      background: var(--border-color);
      color: var(--color-apple-text);
    }

    .add-row-filter-btn {
      background: rgba(0, 118, 223, 0.1);
      border: 1px dashed rgba(0, 118, 223, 0.3);
      color: var(--color-apple-blue);
      font-size: 11px;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: fit-content;
    }

    .add-row-filter-btn:hover:not(:disabled) {
      background: rgba(0, 118, 223, 0.2);
      border-color: var(--color-apple-blue);
      color: var(--color-apple-text);
    }

    .add-row-filter-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Floating Panel Overlay (Query Builder Tree Size) */
    .row-filter-builder {
      position: absolute;
      right: 0;
      top: 100%;
      margin-top: 8px;
      width: 550px;
      max-width: 90vw;
      background: var(--color-apple-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      box-shadow: var(--shadow-md);
      z-index: 50 !important;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      animation: fadeInPopover 0.15s ease-out;
    }

    @keyframes fadeInPopover {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .form-input {
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 10px;
      color: var(--color-apple-text);
      font-size: 12px;
      outline: none;
      transition: all 0.15s ease;
      width: 100%;
    }

    .form-input:focus {
      border-color: var(--color-apple-blue);
      box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.25);
    }

    .rfb-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid var(--border-color);
      padding-top: 10px;
      margin-top: 4px;
    }

    .rfb-confirm-btn {
      background: var(--color-apple-blue);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .rfb-confirm-btn:hover:not(:disabled) {
      background: var(--color-apple-blue);
      filter: brightness(1.1);
    }

    /* Light Theme overrides for row-filter component */
    :host-context(html.light) .add-row-filter-btn {
      background: rgba(79, 70, 229, 0.08) !important;
      border: 1px dashed rgba(79, 70, 229, 0.4) !important;
      color: #4F46E5 !important;
      font-weight: 600;
    }
    :host-context(html.light) .add-row-filter-btn:hover:not(:disabled) {
      background: rgba(79, 70, 229, 0.15) !important;
      border-color: #4338CA !important;
      color: #4338CA !important;
    }
    :host-context(html.light) .filter-tag-mini {
      background: #F8FAFC;
      border-color: #E2E8F0;
      color: #0F172A;
    }
    :host-context(html.light) .row-filter-builder {
      background: #FFFFFF;
      border-color: #CBD5E1;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    :host-context(html.light) .form-input {
      background: #FFFFFF;
      border-color: #CBD5E1;
      color: #0F172A;
    }
    :host-context(html.light) .form-input:focus {
      border-color: #6366F1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }
    :host-context(html.light) .rfb-actions {
      border-top-color: #E2E8F0;
    }
    :host-context(html.light) .rfb-confirm-btn {
      background: #4F46E5;
      color: #FFFFFF;
    }
    :host-context(html.light) .rfb-confirm-btn:hover:not(:disabled) {
      background: #4338CA;
    }

    .raw-expression-display {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
    }
    .raw-expression-badge {
      background: var(--color-apple-grey);
      color: white;
      font-size: 8px;
      font-weight: bold;
      padding: 2px 4px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .raw-expression-input {
      flex: 1;
      min-width: 150px;
      font-family: monospace;
      font-size: 11px;
    }
    .switch-mode-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--color-apple-grey);
      font-size: 9px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .switch-mode-btn:hover {
      background: var(--border-color);
      color: var(--color-apple-text);
    }
    :host-context(html.light) .raw-expression-badge {
      background: #64748B;
    }
    :host-context(html.light) .switch-mode-btn {
      border-color: #E2E8F0;
      color: #64748B;
    }
    :host-context(html.light) .switch-mode-btn:hover {
      background: #F1F5F9;
      color: #0F172A;
    }
  `]
})
export class RowFilterComponent implements OnInit {
  activeMeasureTable = input<string>('');
  dwhCatalog = input<any[]>([]);
  linkedDimensions = input<string[]>([]);
  columnTypes = input<{ [tableName: string]: { [columnName: string]: string } }>({});
  rowFilters = model<any>(null);
  legacyFilterExpr = model<string>('');
  isRawMode = model<boolean>(false);
  
  onChange = output<any>();

  private elementRef = inject(ElementRef);
  isOpen = signal(false);

  ngOnInit() {
    if (this.legacyFilterExpr() && !this.rowFilters()) {
      this.isRawMode.set(true);
    }
  }

  switchToRawMode() {
    this.isRawMode.set(true);
    if (this.rowFilters()) {
      const sql = this.compileRowFiltersToSqlString(this.rowFilters());
      this.legacyFilterExpr.set(sql);
    }
  }

  switchToStructuredMode() {
    this.isRawMode.set(false);
  }

  onRawExpressionChange(val: string) {
    this.legacyFilterExpr.set(val);
  }

  compileRowFiltersToSqlString(group: RowFilterGroup | null | any): string {
    if (!group) return '';
    if (Array.isArray(group)) {
      return group.map(f => {
        const col = f.dimTable ? `${f.dimTable}.${f.attribute}` : f.attribute;
        const val = f.value;
        const op = f.operator || '=';
        return `(${col} ${op} '${val}')`;
      }).join(' AND ');
    }
    
    const parts: string[] = [];
    if (group.rules) {
      for (const rule of group.rules) {
        if (!rule.columnName) continue;
        const col = rule.tableName ? `${rule.tableName}.${rule.columnName}` : rule.columnName;
        const op = rule.operator || 'is';
        const vals = rule.value || [];
        const firstVal = vals[0] || '';
        const escapedVal = firstVal.replace(/'/g, "''");
        
        let sql = '';
        switch (op) {
          case 'is':
          case '=':
            sql = `${col} = '${escapedVal}'`;
            break;
          case 'is not':
          case '!=':
          case '<>':
          case 'is different from':
            sql = `(${col} <> '${escapedVal}' OR ${col} IS NULL)`;
            break;
          case 'contains':
          case 'like':
            sql = `${col} LIKE '%${escapedVal}%'`;
            break;
          case 'does not contains':
          case 'not like':
            sql = `(${col} NOT LIKE '%${escapedVal}%' OR ${col} IS NULL)`;
            break;
          case 'start with':
          case 'starts with':
            sql = `${col} LIKE '${escapedVal}%'`;
            break;
          case 'end with':
          case 'ends with':
            sql = `${col} LIKE '%${escapedVal}'`;
            break;
          case 'is blank':
            sql = `(${col} IS NULL OR TRIM(CAST(${col} AS TEXT)) = '')`;
            break;
          case 'is not blank':
            sql = `(${col} IS NOT NULL AND TRIM(CAST(${col} AS TEXT)) <> '')`;
            break;
          case 'is null':
            sql = `${col} IS NULL`;
            break;
          case 'is not null':
            sql = `${col} IS NOT NULL`;
            break;
          case 'in':
          case 'in list': {
            const quotedVals = vals.map((v: string) => `'${v.replace(/'/g, "''")}'`);
            sql = `${col} IN ${quotedVals.length > 0 ? `(${quotedVals.join(', ')})` : '(NULL)'}`;
            break;
          }
          case 'not in':
          case 'not in list': {
            const quotedVals = vals.map((v: string) => `'${v.replace(/'/g, "''")}'`);
            sql = `${col} NOT IN ${quotedVals.length > 0 ? `(${quotedVals.join(', ')})` : '(NULL)'}`;
            break;
          }
          case '>':
          case 'greater_than':
          case 'is greater then':
            sql = `${col} > '${escapedVal}'`;
            break;
          case '>=':
          case 'greater_equal':
          case 'is greater or equal':
            sql = `${col} >= '${escapedVal}'`;
            break;
          case '<':
          case 'less_than':
          case 'is less then':
            sql = `${col} < '${escapedVal}'`;
            break;
          case '<=':
          case 'less_equal':
          case 'is less or equal':
            sql = `${col} <= '${escapedVal}'`;
            break;
          default:
            sql = `${col} = '${escapedVal}'`;
        }
        parts.push(`(${sql})`);
      }
    }
    if (group.childGroups) {
      for (const child of group.childGroups) {
        const compiledChild = this.compileRowFiltersToSqlString(child);
        if (compiledChild) {
          parts.push(compiledChild);
        }
      }
    }
    if (parts.length === 0) return '';
    const conj = ` ${group.logicalOperator || 'AND'} `;
    return parts.length === 1 ? parts[0] : `(${parts.join(conj)})`;
  }

  getFilterStringSummary(group: any): string {
    if (!group) return '—';
    if (Array.isArray(group)) {
      return group.map(f => `${f.dimTable ? f.dimTable + '.' : ''}${f.attribute} ${f.operator} ${f.value}`).join(' AND ');
    }
    
    const parts: string[] = [];
    if (group.rules) {
      for (const rule of group.rules) {
        if (!rule.columnName) continue;
        const col = rule.tableName ? `${rule.tableName}.${rule.columnName}` : rule.columnName;
        const op = rule.operator || 'is';
        const vals = rule.value || [];
        
        let summary = '';
        if (op === 'is blank' || op === 'is not blank' || op === 'is null' || op === 'is not null') {
          summary = `${col} ${op}`;
        } else {
          const displayOp = op === 'is' ? '=' : op;
          const valStr = vals.length > 0 ? (vals.length === 1 ? `'${vals[0]}'` : `('${vals.join("', '")}')`) : 'NULL';
          summary = `${col} ${displayOp} ${valStr}`;
        }
        parts.push(summary);
      }
    }
    if (group.childGroups) {
      for (const child of group.childGroups) {
        const childStr = this.getFilterStringSummary(child);
        if (childStr && childStr !== '—') {
          parts.push(childStr);
        }
      }
    }
    if (parts.length === 0) return '—';
    const conj = ` ${group.logicalOperator || 'AND'} `;
    return parts.length === 1 && group.id === 'root' ? parts[0] : `(${parts.join(conj)})`;
  }

  openBuilder() {
    if (!this.activeMeasureTable()) return;
    this.isOpen.set(true);
    if (!this.rowFilters()) {
      const emptyRoot = {
        id: 'root',
        logicalOperator: 'AND',
        rules: [],
        childGroups: []
      };
      this.rowFilters.set(emptyRoot);
      this.onChange.emit(emptyRoot);
    }
  }

  close() {
    this.isOpen.set(false);
  }

  onGroupChanged() {
    if (this.rowFilters()) {
      this.onChange.emit(this.rowFilters());
    }
  }

  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target && !target.ownerDocument?.contains(target)) {
      return;
    }
    if (target && (target.closest('.add-row-filter-btn') || target.closest('.value-picker-dropdown') || target.closest('.value-picker-input'))) {
      return;
    }
    const clickedInside = this.elementRef.nativeElement.contains(target);
    if (!clickedInside) {
      this.close();
    }
  }
}
