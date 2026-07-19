import { Component, input, model, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ValidationError } from './report-builder';

@Component({
  selector: 'app-columns-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  styles: [`
    .info-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 4px;
      font-size: 11px;
      color: #94A3B8;
      cursor: help;
      position: relative;
      user-select: none;
      vertical-align: middle;
    }
    
    .info-icon:hover {
      color: #6366F1;
    }

    .tooltip-container {
      position: relative;
    }

    .tooltip-text {
      visibility: hidden;
      width: 320px;
      background-color: #1E293B;
      color: #F8FAFC;
      text-align: left;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 8px 12px;
      position: absolute;
      z-index: 1000;
      top: 125%; /* Position below the icon */
      left: 50%;
      transform: translateX(-50%);
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
      font-size: 11px;
      font-weight: normal;
      text-transform: none;
      white-space: normal;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      letter-spacing: normal;
      line-height: 1.4;
    }

    .tooltip-container:hover .tooltip-text {
      visibility: visible;
      opacity: 1;
    }
  `],
  template: `
    <section class="columns-section card">
      <div class="flex-header">
        <div>
          <h3 class="section-title">Columns Setup (Step 2)</h3>
          <p class="section-desc">
            Define column headers, level layouts, timeframe types, rolling offsets, and formulas.
          </p>
        </div>
        <div class="table-actions">
          <button (click)="addColumn()" [disabled]="isLocked()" class="action-btn-sm add">+ Add Col</button>
          <button (click)="deleteSelectedCols()" [disabled]="isLocked()" class="action-btn-sm delete-selected">
            🗑️ Delete Selected
          </button>
          <button (click)="resetColumns()" [disabled]="isLocked()" class="action-btn-sm reset">↻ Reset</button>
          <button (click)="duplicateSelectedColumn()" [disabled]="isLocked()" class="action-btn-sm duplicate">
            📄 Duplicate
          </button>
          <button (click)="reorderColumns()" [disabled]="isLocked()" class="action-btn-sm reorder">➔ Reorder</button>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="grid-table">
          <thead>
            <tr>
              <th style="width:40px">
                <input type="checkbox" (change)="toggleAllColsSelect($event)" />
              </th>
              <th style="width:70px">Col ID</th>
              <th>Column Name / Header Label*</th>
              <th style="width:110px">Tier Level</th>
              <th style="width:170px">Parent L1</th>
              <th style="width:130px">Formula / Expression</th>
              <th style="width:100px">Header Style</th>
              <th style="width:105px">
                Period Offset
                <span class="info-icon tooltip-container">
                  ℹ️
                  <span class="tooltip-text">
                  Shift the report date backward (-) or forward (+) in native grain units.
                  <br/><br/>
                  <strong>YoY Examples (e.g., 1 year shift):</strong>
                  <br/>• Weekly: Enter -52 (52 weeks ago)
                  <br/>• Monthly: Enter -12 (12 months ago)
                  <br/>• Quarterly: Enter -4 (4 quarters ago)
                  <br/>• Yearly: Enter -1 (1 year ago)
                  <br/><em>Multiply for multi-year shifts (e.g., -104 for 2 years ago, -24 for 2 years ago).</em>
                  <br/><br/>
                  <strong>Previous Period Examples:</strong>
                  <br/>• Weekly: Enter -1 (1 week ago)
                  <br/>• Monthly: Enter -2 (2 month ago)
                  <br/>• Quarterly: Enter -3 (3 quarter ago)
                  <br/>• Yearly: Enter -1 (1 year ago)
                  </span>
                </span>
              </th>
              <th style="width:150px">Timeframe Length</th>
              <th style="width:130px">Math Formula / Calc Expression</th>
              <th style="width:60px;text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (col of columns(); track col.colId; let idx = $index) {
              <tr
                [class.selected]="col.selected"
                [class.has-critical]="hasError(col.colId, 'CRITICAL')"
                [class.has-warning]="hasError(col.colId, 'WARNING')"
                [title]="hasError(col.colId) ? getErrorMessage(col.colId) : ''"
                [style.background]="col.tierLevel === 'L2' ? 'rgba(99, 102, 241, 0.08)' : ''"
              >
                <td><input type="checkbox" [(ngModel)]="col.selected" [disabled]="isLocked()" /></td>
                <td>
                  <div class="row-id-cell">
                    <input
                      type="text"
                      [(ngModel)]="col.colId"
                      [disabled]="isLocked()"
                      (ngModelChange)="onModelChange()"
                      placeholder="C1"
                      class="cell-input center"
                    />
                    @if (hasError(col.colId, 'CRITICAL')) {
                      <span class="error-badge" [title]="getErrorMessage(col.colId)">🛑</span>
                    }
                    @if (hasError(col.colId, 'WARNING')) {
                      <span class="error-badge" [title]="getErrorMessage(col.colId)">⚠️</span>
                    }
                  </div>
                </td>
                <td>
                  <div style="position: relative; display: flex; align-items: center; width: 100%;">
                    @if (col.tierLevel === 'L2') {
                      <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #818CF8; font-family: monospace; pointer-events: none; font-weight: bold; font-size: 14px;">└──</span>
                    }
                    <input
                      type="text"
                      [(ngModel)]="col.label"
                      [disabled]="isLocked()"
                      (ngModelChange)="onModelChange()"
                      placeholder="Column Header Label"
                      class="cell-input"
                      [style.padding-left]="col.tierLevel === 'L2' ? '32px' : '8px'"
                    />
                  </div>
                </td>
                <td>
                  <select
                    [(ngModel)]="col.tierLevel"
                    [disabled]="isLocked()"
                    (ngModelChange)="onTierLevelChange(col); onModelChange()"
                    class="cell-select"
                  >
                    <option value="L1">L1 Parent</option>
                    <option value="L2">L2 Child</option>
                  </select>
                </td>
                <td>
                  <select
                    [(ngModel)]="col.parentId"
                    [disabled]="col.tierLevel !== 'L2' || isLocked()"
                    (ngModelChange)="onModelChange()"
                    class="cell-select"
                  >
                    <option value="">-- Select L1 --</option>
                    @for (pCol of getL1Parents(col); track pCol.colId) {
                      <option [value]="pCol.colId">{{ pCol.colId }} - {{ pCol.label }}</option>
                    }
                  </select>
                </td>
                <td>
                  <select
                    [(ngModel)]="col.colType"
                    [disabled]="isLocked()"
                    (ngModelChange)="onColTypeChange(col); onModelChange()"
                    class="cell-select"
                  >
                    <option value="WTD">WTD</option>
                    <option value="MTD">MTD</option>
                    <option value="QTD">QTD</option>
                    <option value="YTD">YTD</option>
                    <option value="ROLLING">ROLLING</option>
                    <option value="CALC">CALC</option>
                    <option value="HEADER">HEADER</option>
                  </select>
                </td>
                <td>
                  <select
                    [(ngModel)]="col.headerLayout"
                    [disabled]="isLocked()"
                    (ngModelChange)="onModelChange()"
                    class="cell-select"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold, Center</option>
                    <option value="border">Bold, Border</option>
                  </select>
                </td>
                <td>
                  @if (col.colType !== 'CALC' && col.colType !== 'HEADER') {
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                      <input
                        type="number"
                        [(ngModel)]="col.periodOffset"
                        (ngModelChange)="onModelChange()"
                        [disabled]="isLocked()"
                        class="cell-input center"
                        style="width: 100%; box-sizing: border-box;"
                      />
                      <span class="offset-unit-helper" style="font-size: 9px; color: #94A3B8; font-style: italic; line-height: 1;">
                        {{ getOffsetUnitHelper(col) }}
                      </span>
                    </div>
                  } @else {
                    <span style="color: #64748B; font-size: 11px; display: block; text-align: center;">-</span>
                  }
                </td>
                <td>
                  @if (col.colType !== 'CALC' && col.colType !== 'HEADER') {
                    <div class="rolling-cell" style="display: flex; align-items: center; gap: 4px;">
                      <input
                        type="number"
                        [(ngModel)]="col.rollingN"
                        (ngModelChange)="onModelChange()"
                        [disabled]="isLocked()"
                        placeholder="1"
                        class="cell-input center rolling-n-input"
                        style="width: 55px;"
                        title="Timeframe length count"
                      />
                      @if (col.colType === 'WTD') {
                        <span style="font-size: 11px; color: #94A3B8;">wks</span>
                      } @else if (col.colType === 'MTD') {
                        <span style="font-size: 11px; color: #94A3B8;">mos</span>
                      } @else if (col.colType === 'QTD') {
                        <span style="font-size: 11px; color: #94A3B8;">qtrs</span>
                      } @else if (col.colType === 'YTD') {
                        <span style="font-size: 11px; color: #94A3B8;">yrs</span>
                      } @else if (col.colType === 'ROLLING') {
                        <select
                          [(ngModel)]="col.rollingGrain"
                          (ngModelChange)="onModelChange()"
                          class="cell-select rolling-grain-select"
                          title="Time grain for this rolling window"
                          [disabled]="isLocked()"
                          style="width: 65px; font-size: 11px; padding: 2px;"
                        >
                          <option value="DAY">Days</option>
                          <option value="WEEK">Weeks</option>
                          <option value="MONTH">Months</option>
                          <option value="QUARTER">Quarters</option>
                          <option value="YEAR">Years</option>
                        </select>
                      }
                    </div>
                  } @else {
                    <span style="color: #64748B; font-size: 11px; display: block; text-align: center;">-</span>
                  }
                </td>
                <td>
                  <input
                    type="text"
                    [(ngModel)]="col.formulaExpr"
                    (ngModelChange)="onModelChange()"
                    [placeholder]="col.colType === 'CALC' ? 'e.g. (C1-C2)/C2' : '-'"
                    [disabled]="col.tierLevel === 'L1' || col.colType !== 'CALC' || isLocked()"
                    class="cell-input code"
                  />
                </td>
                <td style="text-align:center">
                  <button (click)="deleteColumn(idx)" [disabled]="isLocked()" class="remove-btn" title="Delete Column">
                    🗑️
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
/**
 * ColumnsSetupComponent
 *
 * Step 2 (columns) panel of the Report Builder, providing an inline table editor
 * for defining the time-axis column structure of a report.
 *
 * Purpose:
 *  Renders a horizontally-scrollable grid with one column per `ColumnDef`, allowing
 *  the user to configure column IDs, labels, tier levels (L1 / L2), parent references,
 *  timeframe types, rolling periods, period offsets, period types, and formula expressions.
 *
 * Column tracks (cell editors in the grid):
 *  - **Col ID**        — Unique identifier (e.g. `C1`, `C2`).
 *  - **Column Name**   — Human-readable header label.
 *  - **Tier Level**    — `L1` (parent) or `L2` (child / sub-column).
 *  - **Parent L1**     — `colId` of the parent L1 column (only for L2 columns).
 *  - **Formula / Expr** — Column-level expression (e.g. `C1-C2` for diff columns).
 *  - **Header Style**  — Visual formatting preset (`border`, `transparent`, etc.).
 *  - **Period Offset** — Integer offset applied to the base reporting date.
 *  - **Timeframe Length (Rolling N)** — Number of periods in a rolling window.
 *  - **Period Type**   — `CURRENT_YEAR`, `PREVIOUS_YEAR`, or blank.
 *  - **Math Formula**  — Column-level calc formula (e.g. `C1/C2*100`).
 *
 * Usage:
 *   <app-columns-setup
 *     [(columns)]="columns"
 *     [(rows)]="rows"
 *     [isLocked]="isLocked()"
 *     [validationErrors]="validationErrors()"
 *     (triggerValidation)="onTriggerValidation()"
 *   />
 *
 * Used by:
 *  - ReportBuilderComponent — rendered as the Columns Setup (Step 2) section.
 *
 * Models:
 *  - `columns` — Two-way model; mutated directly by add/delete/reorder/duplicate actions.
 *  - `rows`    — Two-way model; updated when column-activation toggles change.
 *
 * Outputs:
 *  - `triggerValidation` — Emits after every column change to re-run backend validation.
 */
export class ColumnsSetupComponent {
  columns = model.required<any[]>();
  rows = model.required<any[]>();
  isLocked = input<boolean>(false);
  validationErrors = input<ValidationError[]>([]);

  triggerValidation = output<void>();

  onModelChange() {
    this.triggerValidation.emit();
  }

  addColumn(): void {
    const currentCols = this.columns();
    const n = currentCols.length + 1;
    const newCol = {
      colId: `C${n}`,
      label: `Column ${n}`,
      colType: 'WTD',
      headerLayout: 'border',
      periodOffset: 0,
      rollingN: null,
      rollingGrain: null,
      formulaExpr: '',
      tierLevel: 'L1',
      parentId: '',
      selected: false,
    };
    this.columns.set([...currentCols, newCol]);
  }

  resetColumns(): void {
    if (confirm('Reset all columns?')) {
      this.columns.set([]);
    }
  }

  deleteColumn(index: number): void {
    const currentCols = [...this.columns()];
    const c = currentCols[index];
    if (confirm(`Delete column "${c.label || c.colId}"?`)) {
      const cid = c.colId.toUpperCase();
      currentCols.splice(index, 1);
      this.columns.set(currentCols);

      // Clean active columns in rows
      const currentRows = this.rows().map((row) => {
        if (row.activeCols) {
          return {
            ...row,
            activeCols: row.activeCols.filter((id: string) => id.toUpperCase() !== cid)
          };
        }
        return row;
      });
      this.rows.set(currentRows);
      this.onModelChange();
    }
  }

  onColTypeChange(col: any): void {
    if (col.colType === 'ROLLING') {
      if (!col.rollingN) col.rollingN = 3;
      if (!col.rollingGrain) col.rollingGrain = 'MONTH';
    } else {
      col.rollingN = null;
      col.rollingGrain = null;
    }
    if (col.colType !== 'CALC') {
      col.formulaExpr = '';
    }
    if (col.colType === 'HEADER') {
      col.periodOffset = 0;
    }
  }

  deleteSelectedCols(): void {
    const currentCols = this.columns();
    const sel = currentCols.filter((c) => c.selected);
    if (!sel.length) {
      alert('Select at least one column to delete.');
      return;
    }
    if (confirm(`Delete ${sel.length} selected column(s)?`)) {
      const ids = sel.map((c) => c.colId.toUpperCase());
      const remainingCols = currentCols.filter((c) => !c.selected);
      this.columns.set(remainingCols);

      // Clean active columns in rows
      const currentRows = this.rows().map((row) => {
        if (row.activeCols) {
          return {
            ...row,
            activeCols: row.activeCols.filter((id: string) => !ids.includes(id.toUpperCase()))
          };
        }
        return row;
      });
      this.rows.set(currentRows);
      this.onModelChange();
    }
  }

  getL1Parents(col: any): any[] {
    return this.columns().filter((c) => c.tierLevel === 'L1' && c.colId !== col.colId);
  }

  onTierLevelChange(col: any): void {
    if (col.tierLevel === 'L1') {
      col.parentId = '';
      col.formulaExpr = '';
    }
  }

  duplicateSelectedColumn(): void {
    const currentCols = this.columns();
    const sel = currentCols.filter((c) => c.selected);
    if (!sel.length) {
      alert('Select at least one column to duplicate.');
      return;
    }
    const newCols = [...currentCols];
    sel.forEach((sc) => {
      newCols.push({
        ...sc,
        colId: `C${newCols.length + 1}`,
        label: `${sc.label} (Copy)`,
        selected: false,
      });
    });
    this.columns.set(newCols);
    this.onModelChange();
  }

  reorderColumns(): void {
    const sorted = [...this.columns()].sort((a, b) => {
      const an = parseInt(a.colId.replace(/\D/g, '')) || 0;
      const bn = parseInt(b.colId.replace(/\D/g, '')) || 0;
      return an - bn;
    });
    this.columns.set(sorted);
    this.onModelChange();
  }

  toggleAllColsSelect(event: any): void {
    const checked = event.target.checked;
    const updated = this.columns().map((c) => ({
      ...c,
      selected: checked
    }));
    this.columns.set(updated);
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

  getOffsetUnitHelper(col: any): string {
    const type = col.colType;
    const offset = col.periodOffset || 0;
    const suffix = offset > 0 ? 'ahead' : 'ago';

    if (type === 'WTD') {
      return `weeks ${suffix}`;
    }
    if (type === 'MTD') {
      return `months ${suffix}`;
    }
    if (type === 'QTD') {
      return `quarters ${suffix}`;
    }
    if (type === 'YTD') {
      return `years ${suffix}`;
    }
    if (type === 'ROLLING') {
      const grain = (col.rollingGrain || 'WEEK').toUpperCase();
      switch (grain) {
        case 'DAY': return `days ${suffix}`;
        case 'WEEK': return `weeks ${suffix}`;
        case 'MONTH': return `months ${suffix}`;
        case 'QUARTER': return `quarters ${suffix}`;
        case 'YEAR': return `years ${suffix}`;
        default: return `weeks ${suffix}`;
      }
    }
    return '';
  }
}
