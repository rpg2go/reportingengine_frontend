import { Component, ChangeDetectionStrategy, input, output, computed, signal, ElementRef, inject, OnInit } from '@angular/core';
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
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 10px;
      color: #cbd5e1;
      gap: 4px;
      transition: all 0.15s ease;
    }

    .filter-tag-mini.invalid-filter-tag {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      color: #fca5a5;
    }

    .ft-dim {
      color: #64748b;
      font-weight: 500;
    }

    .ft-attr {
      color: #e2e8f0;
      font-weight: 600;
    }

    .ft-op {
      color: #f59e0b;
      font-family: monospace;
    }

    .ft-val {
      color: #38bdf8;
      font-weight: 500;
    }

    .ft-remove {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 9px;
      padding: 0 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
    }

    .ft-remove:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #f8fafc;
    }

    .add-row-filter-btn {
      background: rgba(99, 102, 241, 0.1);
      border: 1px dashed rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
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
      background: rgba(99, 102, 241, 0.2);
      border-color: #818cf8;
      color: white;
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
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6);
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
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-select, .form-input {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 6px 10px;
      color: #e2e8f0;
      font-size: 12px;
      outline: none;
      transition: all 0.15s ease;
      width: 100%;
    }

    .form-select:focus, .form-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
    }

    .form-input.invalid-input {
      border-color: #ef4444;
      color: #fca5a5;
    }

    .rfb-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 10px;
      margin-top: 4px;
    }

    .rfb-confirm-btn {
      background: #2563eb;
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
      background: #1d4ed8;
    }

    .rfb-confirm-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .rfb-cancel-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .rfb-cancel-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: white;
    }
  `]
})
export class RowFilterComponent implements OnInit {
  activeMeasureTable = input<string>('');
  dwhCatalog = input<any[]>([]);
  linkedDimensions = input<string[]>([]);
  columnTypes = input<{ [tableName: string]: { [columnName: string]: string } }>({});
  rowFilters = input<any[]>([]);
  
  onChange = output<any[]>();

  private elementRef = inject(ElementRef);
  private reportService = inject(ReportService);

  isOpen = signal(false);
  pendingFilter = signal<any>({ dimTable: '', attribute: '', operator: '=', value: '' });
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

  ngOnInit() {}

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
