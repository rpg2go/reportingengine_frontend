import { Component, input, model, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FieldPickerComponent } from './field-picker';
import { RowFilterComponent } from './row-filter';
import { ValidationError, DwhField, FieldGroup, RowFilterCondition } from './report-builder';

@Component({
  selector: 'app-rows-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, FieldPickerComponent, RowFilterComponent],
  template: `
    <section class="rows-section card">
      <div class="flex-header">
        <div>
          <h3 class="section-title">Rows Setup (Step 1)</h3>
          <p class="section-desc">
            Define rows, labels, visual measure builders, and row-level filter conditions.
          </p>
        </div>
        <div class="table-actions">
          <button (click)="addRow()" [disabled]="isLocked()" class="action-btn-sm add">+ Add Row</button>
          <button (click)="deleteSelectedRows()" [disabled]="isLocked()" class="action-btn-sm delete-selected">
            🗑️ Delete Selected
          </button>
          <button (click)="resetRows()" [disabled]="isLocked()" class="action-btn-sm reset">↻ Reset</button>
          <button (click)="duplicateSelectedRow()" [disabled]="isLocked()" class="action-btn-sm duplicate">
            📄 Duplicate
          </button>
          <button (click)="reorderRows()" [disabled]="isLocked()" class="action-btn-sm reorder">➔ Reorder</button>
        </div>
      </div>

      <div class="rows-container-layout" [class.picker-closed]="!isFieldPickerOpen()">
        <!-- Left Side Placeholder to reserve space in flow -->
        <div
          class="catalog-panel-placeholder"
          [class.collapsed]="!isFieldPickerOpen()"
        ></div>

        <!-- Left Side: Searchable DWH Catalog Tree -->
        <div
          class="catalog-panel"
          [class.collapsed]="!isFieldPickerOpen()"
        >
          <div class="catalog-search-box">
            <input
              type="text"
              class="form-input search-input"
              placeholder="🔍 Search fields..."
              [ngModel]="fieldsSearchQuery()"
              (ngModelChange)="fieldsSearchQuery.set($event)"
            />
          </div>

          <div class="catalog-tree">
            @for (group of filteredSchemaTree(); track group.sourceTable) {
              <div class="category-group">
                <div class="category-title" (click)="toggleCategoryExpanded(group.sourceTable)">
                  <span class="folder-icon">{{
                    isCategoryExpanded(group.sourceTable) ? '📂' : '📁'
                  }}</span>
                  <span class="cat-name">{{ group.category }}</span>
                  <span class="table-badge">{{
                    group.sourceTable.replace('analytics.', '')
                  }}</span>
                </div>

                @if (isCategoryExpanded(group.sourceTable)) {
                  <div class="fields-list-mini">
                    @for (field of group.fields; track field.name) {
                      <div
                        class="field-item-draggable"
                        draggable="true"
                        (dragstart)="onFieldDragStart($event, field)"
                        (click)="onFieldClick(field)"
                        title="Drag to row or click to apply to selected row"
                      >
                        <span class="field-icon">📊</span>
                        <span class="field-name">{{ field.displayName }}</span>
                        <span class="field-type">{{ field.type }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            }
            @if (filteredSchemaTree().length === 0) {
              <div class="catalog-empty">No matching fields found.</div>
            }
          </div>
        </div>

        <!-- Drag & Collapse/Expand toggle handle on the dividing line -->
        <button
          type="button"
          class="picker-toggle-handle"
          (click)="toggleFieldPicker()"
          [title]="isFieldPickerOpen() ? 'Collapse Catalog' : 'Expand Catalog'"
          aria-label="Toggle schema catalog panel"
        >
          <span>{{ isFieldPickerOpen() ? '‹' : '›' }}</span>
        </button>

        <!-- Right Side: Grid Table Canvas -->
        <div
          class="w-full overflow-x-auto table-wrapper rows-table-wrapper"
          style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;"
        >
          <table class="grid-table rows-grid">
            <thead>
              <tr class="worksheet-fixed-row">
                <!-- Track 1: Checkbox -->
                <th class="col-checkbox sticky-col-1">
                  <div class="col-checkbox">
                    <input type="checkbox" (change)="toggleAllRowsSelect($event)" />
                  </div>
                </th>
                <!-- Track 2: Row ID -->
                <th class="col-row-id sticky-col-2">Row ID</th>
                <!-- Track 3: Hierarchy Spacer -->
                <th class="col-hierarchy">
                  <div class="col-hierarchy"></div>
                </th>
                <!-- Track 4: Row Name (Label)* -->
                <th class="col-row-name">Row Name (Label)*</th>
                <!-- Track 5: Style / Layout -->
                <th class="col-style-layout">Style / Layout</th>
                <!-- Track 6: Measure Definition -->
                <th class="col-measure-def">Measure Definition</th>
                <!-- Track 7: Row Conditions / Filters -->
                <th class="col-conditions">Row Conditions / Filters</th>
                <!-- Track 8: Active Columns -->
                <th class="col-active-cols">Active Columns</th>
                <!-- Track 9: Actions -->
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.rowId; let idx = $index) {
                <tr
                  class="worksheet-fixed-row"
                  [class.selected]="row.selected"
                  [class.has-critical]="hasError(row.rowId, 'CRITICAL')"
                  [class.has-warning]="hasError(row.rowId, 'WARNING')"
                  [title]="hasError(row.rowId) ? getErrorMessage(row.rowId) : ''"
                  (dragover)="onRowDragOver($event)"
                  (drop)="onRowDrop($event, row)"
                >
                  <!-- Track 1: Checkbox -->
                  <td class="col-checkbox sticky-col-1">
                    <input type="checkbox" [(ngModel)]="row.selected" [disabled]="isLocked()" />
                  </td>

                  <!-- Track 2: Row ID -->
                  <td class="col-row-id sticky-col-2">
                    <div class="row-id-cell">
                      <input
                        type="text"
                        [(ngModel)]="row.rowId"
                        [disabled]="isLocked()"
                        (ngModelChange)="onModelChange()"
                        placeholder="R1"
                        class="cell-input center"
                      />
                      @if (hasError(row.rowId, 'CRITICAL')) {
                        <span class="error-badge" [title]="getErrorMessage(row.rowId)">🛑</span>
                      }
                      @if (hasError(row.rowId, 'WARNING')) {
                        <span class="error-badge" [title]="getErrorMessage(row.rowId)">⚠️</span>
                      }
                    </div>
                  </td>

                  <!-- Track 3: Hierarchy/Indent -->
                  <td class="col-hierarchy">
                    <div class="indent-btns-cell">
                      <button
                        (click)="changeIndent(row, -1); onModelChange()"
                        [disabled]="isLocked()"
                        class="indent-btn"
                        title="Decrease indent"
                      >
                        «
                      </button>
                      <button
                        (click)="changeIndent(row, 1); onModelChange()"
                        [disabled]="isLocked()"
                        class="indent-btn"
                        title="Increase indent"
                      >
                        »
                      </button>
                    </div>
                  </td>

                  <!-- Track 4: Row Name (Label) -->
                  <td class="col-row-name">
                    <div
                      class="label-cell-inner"
                      [style.padding-left.px]="row.indentLevel * 12"
                    >
                      <input
                        type="text"
                        [(ngModel)]="row.label"
                        [disabled]="isLocked()"
                        (ngModelChange)="onModelChange()"
                        placeholder="Row Label"
                        class="cell-input"
                      />
                    </div>
                  </td>

                  <!-- Track 5: Style / Layout -->
                  <td class="col-style-layout">
                    <div class="style-cell">
                      <select
                        [(ngModel)]="row.rowType"
                        [disabled]="isLocked()"
                        (change)="onRowTypeChange(row); onModelChange()"
                        class="cell-select"
                      >
                        <option value="data">📊 data</option>
                        <option value="calc">🧮 calc</option>
                        <option value="section">📂 section</option>
                        <option value="blank">🫙 blank</option>
                      </select>
                      <select
                        [(ngModel)]="row.style"
                        [disabled]="isLocked()"
                        (ngModelChange)="onModelChange()"
                        class="cell-select"
                      >
                        <option value="normal">Normal</option>
                        <option value="header">Header</option>
                        <option value="section">Section</option>
                        <option value="total">Total</option>
                        <option value="highlight">Highlight</option>
                        <option value="blank">Blank</option>
                      </select>
                    </div>
                  </td>

                  <!-- Track 6: Measure Definition -->
                  <td class="col-measure-def measure-td">
                    @if (row.type === 'data') {
                      <div class="flex items-center gap-2 w-full" style="display: flex; align-items: center; gap: 8px;">
                        <select
                          [(ngModel)]="row.aggregation"
                          class="cell-select"
                          style="width: 140px;"
                          [disabled]="isLocked()"
                        >
                          @for (opt of aggregationOptions; track opt.value) {
                            <option [value]="opt.value">{{ opt.label }}</option>
                          }
                        </select>

                        <span class="text-xs text-slate-500">of</span>

                        <app-field-picker
                          [dwhCatalog]="dwhCatalog()"
                          [selectedValue]="getMeasureColPath(row)"
                          [disabled]="isLocked()"
                          (onSelect)="updateRowField(row.rowId, $event)"
                        >
                        </app-field-picker>
                      </div>
                    } @else if (row.type === 'calc') {
                      <input
                        type="text"
                        [(ngModel)]="row.formulaExpr"
                        class="cell-input code"
                        [disabled]="isLocked()"
                      />
                    } @else {
                      <span class="cell-na">—</span>
                    }
                  </td>

                  <!-- ── Row Conditions / Filters column ───────────── -->
                  <td class="col-conditions filter-td">
                    @if (row.rowType === 'data') {
                      <div class="row-filter-wrapper">
                        <app-row-filter
                          [activeMeasureTable]="row.measureDefinition.tableName"
                          [dwhCatalog]="dwhCatalog()"
                          [linkedDimensions]="linkedDimensions()"
                          [columnTypes]="columnTypes()"
                          [schemaCatalogMap]="schemaCatalogMap()"
                          [rowFilters]="row.rowFilters"
                          [(legacyFilterExpr)]="row.legacyFilterExpr"
                          [(isRawMode)]="row.isFilterRawMode"
                          [disabled]="isLocked()"
                          (onChange)="row.rowFilters = $event; onModelChange()"
                          (legacyFilterExprChange)="onModelChange()"
                        >
                        </app-row-filter>
                      </div>
                    } @else if (row.rowType === 'calc') {
                      <span class="cell-na">n/a for calc rows</span>
                    } @else {
                      <span class="cell-na">—</span>
                    }
                  </td>

                  <!-- Active Columns toggles -->
                  <td class="col-active-cols">
                    <div class="col-enable-toggles" [style.pointer-events]="isLocked() ? 'none' : 'auto'">
                      @for (col of columns(); track col.colId) {
                        <span
                          class="col-badge"
                          [class.active]="row.activeCols.includes(col.colId.toUpperCase())"
                          [style.opacity]="isLocked() ? '0.7' : '1'"
                          (click)="!isLocked() && toggleColForRow(row, col.colId)"
                          >{{ col.colId }}</span>
                      }
                    </div>
                  </td>

                  <!-- Actions -->
                  <td class="col-actions" style="text-align:center">
                    <button (click)="deleteRow(idx)" [disabled]="isLocked()" class="remove-btn" title="Delete Row">
                      🗑️
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
})
/**
 * RowsSetupComponent
 *
 * Step 1 (rows) panel of the Report Builder, providing a spreadsheet-like table
 * editor for defining all report rows — their labels, types, indent levels,
 * measure definitions, and per-row filter conditions.
 *
 * Purpose:
 *  Renders a two-pane layout:
 *  - **Left pane** — A searchable DWH catalog tree of dimension/fact columns,
 *    supporting click-to-apply and drag-and-drop onto rows to set measure fields.
 *  - **Right pane** — A horizontal-scroll grid table with one row per `ReportRow`,
 *    showing inline-editable cells for each track.
 *
 * Row tracks (columns in the grid):
 *  1. Checkbox for selection
 *  2. Row ID (e.g. `R1`, `R2`)
 *  3. Indent level (+ / - buttons)
 *  4. Row Label
 *  5. Row Type (data / calc / section / blank) + Row Style
 *  6. Measure Definition (aggregation + field picker + custom SQL toggle)
 *  7. Row Conditions / Filters (`RowFilterComponent`)
 *  8. Active Columns (which column IDs are active for this row)
 *  9. Actions (delete row button)
 *
 * Usage:
 *   <app-rows-setup
 *     [(rows)]="rows"
 *     [columns]="columns()"
 *     [isLocked]="isLocked()"
 *     [dwhCatalog]="dwhCatalog()"
 *     [linkedDimensions]="linkedDimensions()"
 *     [columnTypes]="columnTypes()"
 *     [schemaCatalogMap]="schemaCatalogMap()"
 *     [validationErrors]="validationErrors()"
 *     (modelChange)="onModelChange()"
 *   />
 *
 * Used by:
 *  - ReportBuilderComponent — rendered as the Rows Setup (Step 1) section.
 *
 * Outputs:
 *  - `modelChange` — Emits whenever any row value changes; triggers save-state sync.
 *
 * Sub-components:
 *  - `FieldPickerComponent` — Inline combobox for picking the target measure column.
 *  - `RowFilterComponent`   — Inline filter builder for per-row WHERE conditions.
 */
export class RowsSetupComponent {
  rows = model.required<any[]>();
  columns = input.required<any[]>();
  isLocked = input<boolean>(false);
  
  dwhCatalog = input<any[]>([]);
  linkedDimensions = input<string[]>([]);
  columnTypes = input<any>({});
  schemaCatalogMap = input<any>({});
  
  validationErrors = input<ValidationError[]>([]);

  triggerValidation = output<void>();

  fieldsSearchQuery = signal<string>('');
  expandedCategories = signal<string[]>([]);
  isFieldPickerOpen = signal<boolean>(false);

  aggregationOptions = [
    { value: 'SUM', label: 'SUM (Total)' },
    { value: 'AVG', label: 'AVG (Average)' },
    { value: 'COUNT', label: 'COUNT (Total Rows)' },
    { value: 'COUNT_DISTINCT', label: 'COUNT DISTINCT (Unique)' },
    { value: 'MAX', label: 'MAX (Highest)' },
    { value: 'MIN', label: 'MIN (Lowest)' },
  ];

  filteredSchemaTree = computed(() => {
    const query = this.fieldsSearchQuery().trim();
    const tree = this.dwhCatalog() || [];
    if (!query) return tree;

    const normalize = (str: string) => {
      if (!str) return '';
      return str.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    };

    const normalizedQuery = normalize(query);

    return tree
      .map((group: any) => {
        const normalizedTable = normalize(group.sourceTable);
        const normalizedCategory = normalize(group.category);

        const tableMatches =
          normalizedTable.includes(normalizedQuery) || normalizedCategory.includes(normalizedQuery);

        if (tableMatches) {
          return { ...group, fields: group.fields };
        } else {
          const matchedFields = group.fields.filter((f: any) => {
            const normalizedFieldName = normalize(f.name);
            const normalizedDisplayName = normalize(f.displayName);
            return (
              normalizedFieldName.includes(normalizedQuery) ||
              normalizedDisplayName.includes(normalizedQuery)
            );
          });
          return { ...group, fields: matchedFields };
        }
      })
      .filter((group: any) => group.fields.length > 0);
  });

  toggleFieldPicker(): void {
    this.isFieldPickerOpen.set(!this.isFieldPickerOpen());
  }

  isCategoryExpanded(sourceTable: string): boolean {
    return this.expandedCategories().includes(sourceTable);
  }

  toggleCategoryExpanded(sourceTable: string): void {
    this.expandedCategories.update((cats) => {
      if (cats.includes(sourceTable)) {
        return cats.filter((c) => c !== sourceTable);
      } else {
        return [...cats, sourceTable];
      }
    });
  }

  onModelChange() {
    this.triggerValidation.emit();
  }

  addRow(): void {
    const currentRows = this.rows();
    const n = currentRows.length + 1;
    const newRow = this.makeDefaultRow(`R${n}`, `New Row ${n}`, 'data', 'normal', 0, {
      agg: 'SUM',
      col: '',
      table: '',
      filters: [],
    });
    this.rows.set([...currentRows, newRow]);
    this.onModelChange();
  }

  resetRows(): void {
    if (confirm('Are you sure you want to reset all rows?')) {
      this.rows.set([]);
      this.onModelChange();
    }
  }

  deleteRow(index: number): void {
    const currentRows = [...this.rows()];
    const r = currentRows[index];
    if (confirm(`Delete row "${r.label || r.rowId}"?`)) {
      currentRows.splice(index, 1);
      this.rows.set(currentRows);
      this.onModelChange();
    }
  }

  deleteSelectedRows(): void {
    const currentRows = this.rows();
    const selectedCount = currentRows.filter((r) => r.selected).length;
    if (!selectedCount) {
      alert('Select at least one row to delete.');
      return;
    }
    if (confirm(`Delete ${selectedCount} selected row(s)?`)) {
      const remainingRows = currentRows.filter((r) => !r.selected);
      this.rows.set(remainingRows);
      this.onModelChange();
    }
  }

  duplicateSelectedRow(): void {
    const currentRows = this.rows();
    const sel = currentRows.filter((r) => r.selected);
    if (!sel.length) {
      alert('Select at least one row to duplicate.');
      return;
    }
    const newRows = [...currentRows];
    sel.forEach((sr) => {
      const copied = {
        ...sr,
        rowId: `R${newRows.length + 1}`,
        label: `${sr.label} (Copy)`,
        selected: false,
        rowFilters: sr.rowFilters ? JSON.parse(JSON.stringify(sr.rowFilters)) : null,
      };
      newRows.push(this.initRowSignals(copied));
    });
    this.rows.set(newRows);
    this.onModelChange();
  }

  updateRowField(rowId: string, fieldPath: string): void {
    const currentRows = [...this.rows()];
    const row = currentRows.find((r) => r.rowId === rowId);
    if (row) {
      this.setMeasureColPath(row, fieldPath);
      this.rows.set(currentRows);
      this.onModelChange();
    }
  }

  reorderRows(): void {
    const sorted = [...this.rows()].sort((a, b) => {
      const an = parseInt(a.rowId.replace(/\D/g, '')) || 0;
      const bn = parseInt(b.rowId.replace(/\D/g, '')) || 0;
      return an - bn;
    });
    this.rows.set(sorted);
    this.onModelChange();
  }

  toggleAllRowsSelect(event: any): void {
    const checked = event.target.checked;
    const updated = this.rows().map((r) => ({
      ...r,
      selected: checked
    }));
    this.rows.set(updated);
  }

  changeIndent(row: any, diff: number): void {
    row.indentLevel = Math.max(0, (row.indentLevel || 0) + diff);
  }

  toggleColForRow(row: any, colId: string): void {
    const cid = colId.toUpperCase();
    const idx = row.activeCols.indexOf(cid);
    if (idx === -1) {
      row.activeCols.push(cid);
    } else {
      row.activeCols.splice(idx, 1);
    }
  }

  onRowTypeChange(row: any): void {
    if (row.rowType === 'data') {
      row.measureAgg = 'SUM';
      row.measureCol = '';
      row.sourceTable = '';
      row.customSqlMode = false;
      row.source = 'SUM()';
      row.rowFilters = [];
      row.legacyFilterExpr = '';
      row.isFilterRawMode = false;
    } else if (row.rowType === 'calc') {
      row.source = '';
      row.measureAgg = '';
      row.measureCol = '';
      row.sourceTable = '';
      row.customSqlMode = false;
      row.rowFilters = [];
      row.legacyFilterExpr = '';
      row.isFilterRawMode = false;
    } else {
      row.source = '';
      row.measureAgg = '';
      row.measureCol = '';
      row.sourceTable = '';
      row.customSqlMode = false;
      row.rowFilters = [];
      row.legacyFilterExpr = '';
      row.isFilterRawMode = false;
    }
  }

  onRowMeasureChange(row: any): void {
    row.source = `${row.measureAgg || 'SUM'}(${row.measureCol || ''})`;
  }

  getMeasureColPath(row: any): string {
    if (row.measureDefinition) {
      const tbl = row.measureDefinition.sourceTable();
      const col = row.measureDefinition.targetColumn();
      if (tbl && col) {
        return `${tbl}.${col}`;
      }
    } else if (row.sourceTable && row.measureCol) {
      return `${row.sourceTable}.${row.measureCol}`;
    }
    return '';
  }

  setMeasureColPath(row: any, path: string): void {
    if (path && path.includes('.')) {
      const idx = path.lastIndexOf('.');
      const tbl = path.substring(0, idx);
      const col = path.substring(idx + 1);
      if (row.measureDefinition) {
        row.measureDefinition.sourceTable.set(tbl);
        row.measureDefinition.targetColumn.set(col);
      } else {
        row.sourceTable = tbl;
        row.measureCol = col;
      }
    } else {
      if (row.measureDefinition) {
        row.measureDefinition.sourceTable.set('');
        row.measureDefinition.targetColumn.set('');
      } else {
        row.sourceTable = '';
        row.measureCol = '';
      }
    }
    row.customSqlMode = false;
    row.source = `${row.measureAgg || 'SUM'}(${row.measureCol || ''})`;
  }

  onFieldDragStart(event: DragEvent, field: DwhField): void {
    event.dataTransfer?.setData('application/json', JSON.stringify(field));
    event.dataTransfer!.effectAllowed = 'copy';
  }

  onRowDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onRowDrop(event: DragEvent, row: any): void {
    event.preventDefault();
    if (row.rowType !== 'data') return;
    const data = event.dataTransfer?.getData('application/json');
    if (data) {
      try {
        const field = JSON.parse(data);
        this.assignFieldToRow(row, field);
      } catch (e) {
        console.error('Failed to parse dropped field data', e);
      }
    }
  }

  onFieldClick(field: DwhField): void {
    const selectedRow = this.rows().find((r) => r.selected && r.rowType === 'data');
    if (selectedRow) {
      this.assignFieldToRow(selectedRow, field);
    } else {
      alert('Please select a data row in the canvas first, then click a field to assign.');
    }
  }

  assignFieldToRow(row: any, field: DwhField): void {
    if (row.measureDefinition) {
      row.measureDefinition.sourceTable.set(field.sourceTable);
      row.measureDefinition.targetColumn.set(field.name);
    } else {
      row.sourceTable = field.sourceTable;
      row.measureCol = field.name;
    }
    row.customSqlMode = false;
    row.source = `${row.measureAgg || 'SUM'}(${field.name})`;
    this.onModelChange();
  }

  private initRowSignals(row: any): any {
    const sourceTableSignal = signal<string>(row.sourceTable || '');
    const targetColumnSignal = signal<string>(row.measureCol || '');
    const aggregationSignal = signal<string>(row.measureAgg || 'SUM');
    const rawExpressionSignal = signal<string>(row.source || '');

    row.measureDefinition = {
      sourceTable: sourceTableSignal,
      targetColumn: targetColumnSignal,
      aggregation: aggregationSignal,
      rawExpression: rawExpressionSignal,
      get tableName() {
        return sourceTableSignal();
      },
    };

    Object.defineProperty(row, 'sourceTable', {
      get: () => sourceTableSignal(),
      set: (val: string) => {
        sourceTableSignal.set(val);
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(row, 'measureCol', {
      get: () => targetColumnSignal(),
      set: (val: string) => {
        targetColumnSignal.set(val);
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(row, 'measureAgg', {
      get: () => aggregationSignal(),
      set: (val: string) => {
        aggregationSignal.set(val);
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(row, 'type', {
      get: () => row.rowType,
      set: (val: string) => {
        row.rowType = val;
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(row, 'aggregation', {
      get: () => aggregationSignal(),
      set: (val: string) => {
        aggregationSignal.set(val);
        row.customSqlMode = false;
        this.onRowMeasureChange(row);
        this.onModelChange();
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(row, 'targetField', {
      get: () => this.getMeasureColPath(row),
      set: (val: string) => {
        this.setMeasureColPath(row, val);
        this.onModelChange();
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(row, 'formulaExpr', {
      get: () => row.source,
      set: (val: string) => {
        row.source = val;
        this.onModelChange();
      },
      configurable: true,
      enumerable: true,
    });

    return row;
  }

  private makeDefaultRow(
    rowId: string,
    label: string,
    rowType: string,
    style: string,
    indentLevel: number,
    measure?: { agg: string; col: string; table?: string; filters?: RowFilterCondition[] },
  ): any {
    const row = {
      rowId,
      label,
      rowType,
      source: measure ? `${measure.agg}(${measure.col})` : '',
      parentRowId: '',
      style,
      indentLevel,
      filterExpr: measure?.filters ? JSON.stringify(measure.filters) : '',
      activeCols: ['C1', 'C2', 'C3'],
      selected: false,
      measureAgg: measure?.agg || 'SUM',
      measureCol: measure?.col || '',
      sourceTable: measure?.table || '',
      customSqlMode: false,
      rowFilters: measure?.filters || [],
      legacyFilterExpr: '',
      isFilterRawMode: false,
    };
    return this.initRowSignals(row);
  }

  hasError(elementId: string, severity?: 'CRITICAL' | 'WARNING'): boolean {
    const cleanId = elementId.toUpperCase().replace(/^(COLUMN-|ROW-)/, '');
    return this.validationErrors().some(
      (e) => {
        const cleanErrId = e.elementId.toUpperCase().replace(/^(COLUMN-|ROW-)/, '');
        return cleanErrId === cleanId && (!severity || e.errorSeverity === severity);
      }
    );
  }

  getErrorMessage(elementId: string): string {
    const cleanId = elementId.toUpperCase().replace(/^(COLUMN-|ROW-)/, '');
    return this.validationErrors()
      .filter((e) => e.elementId.toUpperCase().replace(/^(COLUMN-|ROW-)/, '') === cleanId)
      .map((e) => `[${e.errorSeverity}] ${e.displayMessage}`)
      .join('\n');
  }
}
