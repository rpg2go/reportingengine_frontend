import { Component, ChangeDetectionStrategy, input, output, computed, signal, ElementRef, inject, OnInit, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { ValuePickerComponent } from './value-picker';

@Component({
  selector: 'app-row-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, ValuePickerComponent],
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

    .filter-tag-mini.invalid-filter-tag {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      color: #fca5a5;
    }

    .ft-dim {
      color: var(--color-apple-grey);
      font-weight: 500;
    }

    .ft-attr {
      color: var(--color-apple-text);
      font-weight: 600;
    }

    .ft-op {
      color: var(--color-apple-blue);
      font-family: monospace;
    }

    .ft-val {
      color: var(--color-apple-blue);
      font-weight: 500;
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

    /* Floating Panel Overlay */
    .row-filter-builder {
      position: absolute;
      right: 0;
      top: 100%;
      margin-top: 8px;
      width: 320px;
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

    .rfb-fields-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .rfb-label-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .rfb-label-row label {
      font-size: 10px;
      font-weight: 600;
      color: var(--color-apple-grey);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-select, .form-input {
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

    .form-select:focus, .form-input:focus {
      border-color: var(--color-apple-blue);
      box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.25);
    }

    .form-input.invalid-input {
      border-color: #ef4444;
      color: #fca5a5;
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

    .rfb-confirm-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .rfb-cancel-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--color-apple-text);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .rfb-cancel-btn:hover {
      background: var(--border-color);
      color: var(--color-apple-text);
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
    :host-context(html.light) .ft-dim {
      color: #64748B;
    }
    :host-context(html.light) .ft-attr {
      color: #0F172A;
    }
    :host-context(html.light) .ft-op {
      color: #4F46E5;
    }
    :host-context(html.light) .ft-val {
      color: #4F46E5;
    }
    :host-context(html.light) .ft-remove {
      color: #64748B;
    }
    :host-context(html.light) .ft-remove:hover {
      background: #E2E8F0;
      color: #EF4444;
    }
    :host-context(html.light) .row-filter-builder {
      background: #FFFFFF;
      border-color: #CBD5E1;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    :host-context(html.light) .row-filter-builder label {
      color: #475569;
    }
    :host-context(html.light) .form-select,
    :host-context(html.light) .form-input {
      background: #FFFFFF;
      border-color: #CBD5E1;
      color: #0F172A;
    }
    :host-context(html.light) .form-select:focus,
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
    :host-context(html.light) .rfb-cancel-btn {
      border-color: #CBD5E1;
      color: #475569;
    }
    :host-context(html.light) .rfb-cancel-btn:hover {
      background: #F8FAFC;
      color: #0F172A;
    }

    .conjunction-select {
      background: var(--color-apple-blue);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 2px 4px;
      font-size: 9px;
      font-weight: 700;
      cursor: pointer;
      outline: none;
      text-transform: uppercase;
    }
    .conjunction-select:hover {
      filter: brightness(1.1);
    }
    .conjunction-badge {
      display: inline-flex;
      align-items: center;
      margin: 0 2px;
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
  rowFilters = input<any[]>([]);
  legacyFilterExpr = model<string>('');
  
  onChange = output<any[]>();

  private elementRef = inject(ElementRef);
  private reportService = inject(ReportService);

  isOpen = signal(false);
  isRawMode = model<boolean>(false);
  pendingFilter = signal<any>({ dimTable: '', attribute: '', operator: '=', value: '', conjunction: 'AND' });
  pendingFilterValues = signal<string[]>([]);
  pendingFilterValuesSelected = signal<string[]>([]);

  operators = [
    { value: '=', label: '=' },
    { value: '!=', label: '≠' },
    { value: '>', label: '>' },
    { value: '<', label: '<' },
    { value: '>=', label: '≥' },
    { value: '<=', label: '≤' },
    { value: 'LIKE', label: 'contains' },
    { value: 'IN', label: 'in list' }
  ];

  ngOnInit() {
    if (this.legacyFilterExpr() && (!this.rowFilters() || this.rowFilters().length === 0)) {
      this.isRawMode.set(true);
    }
  }

  switchToRawMode() {
    this.isRawMode.set(true);
    if (this.rowFilters() && this.rowFilters().length > 0) {
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

  onConjunctionChange(index: number, val: 'AND' | 'OR') {
    const current = this.rowFilters().map((f, i) => {
      if (i === index) {
        return { ...f, conjunction: val };
      }
      return f;
    });
    this.onChange.emit(current);
  }

  compileRowFiltersToSqlString(filters: any[]): string {
    return filters.map((f, i) => {
      const col = f.dimTable ? `${f.dimTable}.${f.attribute}` : f.attribute;
      const val = f.value;
      const table = f.dimTable || this.activeMeasureTable();
      const colTypes = this.columnTypes()[table];
      const type = colTypes ? colTypes[f.attribute] : '';
      const isNumeric = type && (type.includes('int') || type.includes('decimal') || type.includes('numeric') || type.includes('double') || type.includes('float'));
      
      const op = f.operator || '=';
      let formattedVal = val;
      if (op === 'IN') {
        const parts = val ? val.toString().split(',').map((p: string) => p.trim()) : [];
        const formattedParts = parts.map((part: string) => {
          if (isNumeric) {
            return part;
          } else {
            let q = part;
            if (!q.startsWith("'") && !q.endsWith("'")) {
              q = `'${q}'`;
            }
            return q;
          }
        });
        formattedVal = `(${formattedParts.join(', ')})`;
      } else {
        if (!isNumeric && val && !val.toString().startsWith("'") && !val.toString().endsWith("'")) {
          formattedVal = `'${val}'`;
        }
      }
      const conj = (i < filters.length - 1) ? ` ${f.conjunction || 'AND'} ` : '';
      return `(${col} ${op} ${formattedVal})${conj}`;
    }).join('');
  }

  selectedTable = computed(() => {
    return this.pendingFilter().dimTable || this.activeMeasureTable();
  });

  availableColumns = computed(() => {
    const table = this.selectedTable();
    if (!table) return [];
    const catalog = this.dwhCatalog();
    const group = catalog.find((g: any) => g.sourceTable === table);
    return group ? group.fields.map((f: any) => f.name) : [];
  });

  onTableChange() {
    this.pendingFilter.update(f => ({ ...f, attribute: '', value: '' }));
    this.pendingFilterValues.set([]);
    this.pendingFilterValuesSelected.set([]);
  }

  onAttrChange() {
    this.pendingFilter.update(f => ({ ...f, value: '' }));
    this.pendingFilterValuesSelected.set([]);
    
    const table = this.selectedTable();
    const attr = this.pendingFilter().attribute;
    if (!table || !attr) {
      this.pendingFilterValues.set([]);
      return;
    }

    this.reportService.getDistinctValues(table, attr).subscribe({
      next: (vals) => {
        this.pendingFilterValues.set(vals);
      },
      error: () => {
        this.pendingFilterValues.set([]);
      }
    });
  }

  onSelectedValuesChange(vals: string[]) {
    this.pendingFilterValuesSelected.set(vals);
    this.pendingFilter.update(f => ({ ...f, value: vals.join(', ') }));
  }

  openBuilder() {
    if (!this.activeMeasureTable()) return;
    this.isOpen.set(true);
    this.pendingFilter.set({ dimTable: '', attribute: '', operator: '=', value: '' });
    this.pendingFilterValues.set([]);
    this.pendingFilterValuesSelected.set([]);
  }

  close() {
    this.isOpen.set(false);
  }

  confirmFilter() {
    if (!this.pendingFilter().attribute) return;
    
    const current = [...this.rowFilters()];
    if (current.length > 0 && !current[current.length - 1].conjunction) {
      current[current.length - 1] = { ...current[current.length - 1], conjunction: 'AND' };
    }
    current.push({ ...this.pendingFilter() });
    this.onChange.emit(current);
    this.close();
  }

  removeFilter(index: number, event: MouseEvent) {
    event.stopPropagation();
    const current = [...this.rowFilters()];
    current.splice(index, 1);
    this.onChange.emit(current);
  }

  isFilterValueInvalid(f: any): boolean {
    const table = f.dimTable || this.activeMeasureTable();
    if (!table || !f.attribute || !f.value) return false;
    const colTypes = this.columnTypes()[table];
    if (!colTypes) return false;
    const type = colTypes[f.attribute];
    if (!type) return false;
    
    const val = f.value.toString().trim();
    if (val === '') return false;
    
    const isNumericType = type.includes('int') || type.includes('decimal') || type.includes('numeric') || type.includes('double') || type.includes('float');
    if (isNumericType) {
      if (f.operator === 'IN' || val.includes(',')) {
        const parts = val.split(',');
        return parts.some((part: string) => isNaN(Number(part.trim())));
      }
      return isNaN(Number(val));
    }
    return false;
  }

  getOperatorLabel(opValue: string): string {
    const op = this.operators.find(o => o.value === opValue);
    return op ? op.label : opValue;
  }

  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target && !target.ownerDocument?.contains(target)) {
      return;
    }
    if (target && target.closest('.add-row-filter-btn')) {
      return;
    }
    const clickedInside = this.elementRef.nativeElement.contains(target);
    if (!clickedInside) {
      this.close();
    }
  }
}
