import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { forkJoin } from 'rxjs';

/** Base quick/general filter condition (used on the report header scope). */
interface FilterCondition {
  attribute: string;    // column name (plain for fact, "dim.col" style not used here — dimTable is separate)
  operator: string;
  value: string;
  dimTable?: string;    // empty → fact table; set → dimension view name
}

/** Structured condition attached to a single row's measure definition. */
interface RowFilterCondition {
  dimTable: string;     // '' = fact table; otherwise the dim view name (e.g. 'dim_relationship_manager')
  attribute: string;    // column name within that table
  operator: string;
  value: string;
}

@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="builder-container">
      <!-- ══════════════════════════════════════════ SIDEBAR -->
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="brand-icon">🛠️</span>
          <span class="brand-text">Report Builder</span>
        </div>

        <nav class="sidebar-menu">
          <a routerLink="/dashboard" class="menu-item">
            <span class="menu-icon">📁</span>
            <span>Reports Catalog</span>
          </a>
          <a routerLink="/semantic" class="menu-item">
            <span class="menu-icon">🧠</span>
            <span>Semantic Layer</span>
          </a>
        </nav>

        <div class="sidebar-user">
          <button (click)="goBack()" class="back-btn">← Cancel &amp; Exit</button>
        </div>
      </aside>

      <!-- ══════════════════════════════════════════ MAIN CONTENT -->
      <main class="main-content animate-fade-in">

        <!-- Top sticky action bar -->
        <header class="detail-header">
          <div>
            <div class="breadcrumbs">
              <a routerLink="/dashboard">Reports</a> / <span>Builder</span>
            </div>
            <h1>{{ isNewReport ? 'Create New Report' : 'Update Existing Report' }}</h1>
            <p class="report-subtitle">Define structural configurations, formulas, and filter details.</p>
          </div>

          <div class="action-buttons">
            <button (click)="togglePreview()" class="preview-btn">
              👁️ {{ showPreview() ? 'Hide Preview' : 'Preview Layout' }}
            </button>
            <button (click)="saveConfig()" [disabled]="saving()" class="save-btn">
              @if (saving()) {
                <span class="spinner"></span> Saving...
              } @else {
                <span>💾 Save Definition</span>
              }
            </button>
          </div>
        </header>

        <!-- Status alerts -->
        @if (successMessage()) {
          <div class="alert success-alert">
            <span class="alert-icon">✓</span>
            <span>{{ successMessage() }}</span>
          </div>
        }
        @if (errorMessage()) {
          <div class="alert error-alert">
            <span class="alert-icon">⚠️</span>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <!-- ── Preview Modal ───────────────────────────────────── -->
        @if (showPreview()) {
          <section class="preview-section card animate-fade-in">
            <h3 class="section-title">📊 Live Layout Preview</h3>
            <p class="section-desc">Molded view of rows and active columns. Formula evaluations run during Phase 2.</p>
            <div class="table-wrapper">
              <table class="spreadsheet-table">
                <thead>
                  <tr>
                    <th class="sticky-col">Label</th>
                    <th>ID</th>
                    <th>Type</th>
                    @for (col of columns; track col.colId) {
                      <th class="col-flag-header">
                        <div><code>{{ col.colId }}</code></div>
                        <div class="preview-col-label">{{ col.label }}</div>
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows; track row.rowId) {
                    <tr [class]="'row-style-' + (row.style || 'normal').toLowerCase()">
                      <td class="sticky-col label-cell" [style.padding-left.px]="20 + row.indentLevel * 16">
                        @if (row.rowType === 'section') {
                          📂 <strong>{{ row.label }}</strong>
                        } @else if (row.rowType === 'calc') {
                          🧮 {{ row.label }}
                        } @else if (row.rowType === 'data') {
                          📊 {{ row.label }}
                        } @else {
                          &nbsp;
                        }
                      </td>
                      <td><code>{{ row.rowId }}</code></td>
                      <td><span class="row-type-badge" [class]="row.rowType">{{ row.rowType }}</span></td>
                      @for (col of columns; track col.colId) {
                        <td class="col-flag-cell">
                          @if (row.activeCols && row.activeCols.includes(col.colId.toUpperCase())) {
                            <span class="flag-dot">✓</span>
                          } @else {
                            <span class="flag-dash">-</span>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- ══════════════════════════════════════════════════════
             SECTION 1 — CORE REPORT DETAILS
        ═══════════════════════════════════════════════════════════ -->
        <section class="config-panel card">
          <h3 class="section-title">⚙️ Core Report Details</h3>

          <!-- Basic identity fields -->
          <div class="form-grid">
            <div class="form-group">
              <label for="report-id">Report ID* (unique)</label>
              <input
                type="text"
                id="report-id"
                [(ngModel)]="reportId"
                [disabled]="!isNewReport"
                placeholder="e.g. RPT_001"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="report-name">Report Title*</label>
              <input
                type="text"
                id="report-name"
                [(ngModel)]="reportName"
                placeholder="e.g. Sales Weekly Report"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="report-version">Version</label>
              <input type="number" id="report-version" [(ngModel)]="reportVersion" class="form-input" />
            </div>

            <div class="form-group">
              <label for="report-status">Report Status</label>
              <select id="report-status" [(ngModel)]="status" class="form-select">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <!-- Source Table (Fact) -->
            <div class="form-group">
              <label for="source-table">Source Table (Fact)*</label>
              <select id="source-table" [(ngModel)]="sourceTable" (change)="onTableChange()" class="form-select">
                <option value="">-- Select database table --</option>
                @for (tbl of dbTables; track tbl) {
                  <option [value]="tbl">{{ tbl }}</option>
                }
              </select>
            </div>

            <!-- Granularity -->
            <div class="form-group">
              <label for="granularity">Report Granularity*</label>
              <select id="granularity" [(ngModel)]="granularity" class="form-select">
                <option value="">-- Select grouping column --</option>
                @for (col of tableColumns; track col) {
                  <option [value]="col">{{ col }}</option>
                }
              </select>
            </div>

            <!-- Reporting Date (from dim_date.reporting_date) -->
            <div class="form-group">
              <label for="reporting-date">Reporting Date <span class="label-hint">(from dim_date)</span></label>
              <input
                type="text"
                id="reporting-date"
                [(ngModel)]="reportingDate"
                placeholder="Select or type a date…"
                list="reporting-date-list"
                class="form-input"
              />
              <datalist id="reporting-date-list">
                @for (d of availableReportingDates; track d) {
                  <option [value]="d">{{ d }}</option>
                }
              </datalist>
              @if (availableReportingDates.length === 0) {
                <span class="field-hint">Loading available dates from dim_date…</span>
              } @else {
                <span class="field-hint">{{ availableReportingDates.length }} dates available</span>
              }
            </div>

            <!-- Timeframe Limit (redesigned with mode buttons) -->
            <div class="form-group timeframe-group">
              <label>Timeframe Limit</label>
              <div class="timeframe-row">
                <input type="date" [(ngModel)]="timeframeStart" class="form-input tf-start" />
                <span class="tf-arrow">→</span>
                <div class="tf-end-group">
                  <div class="mode-btn-group" role="group">
                    <button
                      type="button"
                      class="mode-btn"
                      [class.active]="timeframeMode === 'today_minus_2'"
                      (click)="setTimeframeMode('today_minus_2')"
                      title="Default: today minus 2 calendar days"
                    >Today − 2</button>
                    <button
                      type="button"
                      class="mode-btn"
                      [class.active]="timeframeMode === 'today'"
                      (click)="setTimeframeMode('today')"
                    >Today</button>
                    <button
                      type="button"
                      class="mode-btn"
                      [class.active]="timeframeMode === 'custom'"
                      (click)="setTimeframeMode('custom')"
                    >Custom</button>
                  </div>
                  @if (timeframeMode === 'custom') {
                    <input type="date" [(ngModel)]="timeframeEnd" class="form-input tf-end" />
                  } @else {
                    <span class="computed-date-badge">{{ computedTimeframeEnd }}</span>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- ── Linked Dimensions (shown once a fact table is selected) ───── -->
          @if (sourceTable && dimensionJoins.length > 0) {
            <div class="form-group">
              <label>
                🔗 Linked Dimensions
                <span class="label-hint">— click to enable dimension columns in filters &amp; measure builders</span>
              </label>
              <div class="chip-container dim-chip-container">
                @for (join of dimensionJoins; track join.dimView) {
                  <span
                    class="dim-chip"
                    [class.active]="isDimensionLinked(join.dimView)"
                    (click)="toggleLinkedDimension(join.dimView)"
                    [title]="join.joinType + ': ' + join.joinSql"
                  >
                    <span class="dim-chip-icon">{{ isDimensionLinked(join.dimView) ? '✓' : '+' }}</span>
                    {{ join.dimView }}
                    <span class="dim-chip-join-badge">{{ join.joinType }}</span>
                  </span>
                }
              </div>
            </div>
          }
          @if (sourceTable && dimensionJoins.length === 0 && !loadingDimJoins) {
            <p class="empty-filters">No dimension joins configured for <code>{{ sourceTable }}</code> in the semantic layer.</p>
          }

          <!-- ── Quick Filters ─────────────────────────────────────────────── -->
          <div class="form-group filter-select-group">
            <label>Quick Filters <span class="label-hint">(columns exposed as runtime user filters)</span></label>
            <div class="chip-container">
              <!-- Fact table columns -->
              @if (tableColumns.length > 0) {
                <span class="chip-group-label">{{ sourceTable }}</span>
                @for (col of tableColumns; track col) {
                  <span
                    class="filter-chip"
                    [class.active]="isQuickFilter(col)"
                    (click)="toggleQuickFilter(col)"
                  >{{ col }}</span>
                }
              }
              <!-- Dimension columns -->
              @for (dim of linkedDimensions; track dim) {
                @if (getDimColumns(dim).length > 0) {
                  <span class="chip-group-label">{{ dim }}</span>
                  @for (col of getDimColumns(dim); track col) {
                    <span
                      class="filter-chip dim-filter-chip"
                      [class.active]="isQuickFilter(dim + '.' + col)"
                      (click)="toggleQuickFilter(dim + '.' + col)"
                    >{{ col }}</span>
                  }
                }
              }
            </div>
          </div>

          <!-- ── General Filters ───────────────────────────────────────────── -->
          <div class="form-group filters-builder">
            <div class="flex-header">
              <label>General Filters <span class="label-hint">(base scope constraints for entire report)</span></label>
              <button (click)="addGeneralFilter()" class="add-sub-btn">+ Add Filter Condition</button>
            </div>
            @if (generalFilters.length === 0) {
              <p class="empty-filters">No general filters configured. Applies to entire database table scope.</p>
            } @else {
              <div class="filters-list">
                @for (filter of generalFilters; track $index; let idx = $index) {
                  <div class="filter-row animate-fade-in">

                    <!-- Dimension table selector -->
                    <select
                      [(ngModel)]="filter.dimTable"
                      (change)="onGeneralFilterTableChange(filter)"
                      class="form-select sm dim-select"
                    >
                      <option value="">{{ sourceTable || 'Fact Table' }}</option>
                      @for (dim of linkedDimensions; track dim) {
                        <option [value]="dim">{{ dim }}</option>
                      }
                    </select>

                    <!-- Attribute column selector -->
                    <select [(ngModel)]="filter.attribute" (change)="loadGeneralFilterValues(filter)" class="form-select sm">
                      <option value="">-- Column --</option>
                      @for (col of getColumnsForFilterTable(filter.dimTable); track col) {
                        <option [value]="col">{{ col }}</option>
                      }
                    </select>

                    <!-- Operator -->
                    <select [(ngModel)]="filter.operator" class="form-select sm operator">
                      <option value="is">is</option>
                      <option value="is not">is not</option>
                      <option value="in">in</option>
                      <option value="like">contains</option>
                      <option value="=">=</option>
                      <option value="!=">!=</option>
                      <option value=">">&gt;</option>
                      <option value=">=">&gt;=</option>
                      <option value="<">&lt;</option>
                      <option value="<=">&lt;=</option>
                    </select>

                    <!-- Value with distinct datalist -->
                    <input
                      type="text"
                      [(ngModel)]="filter.value"
                      placeholder="Enter value…"
                      [attr.list]="'gf-val-' + idx"
                      class="form-input sm"
                    />
                    <datalist [attr.id]="'gf-val-' + idx">
                      @for (val of getGeneralFilterOptions(filter); track val) {
                        <option [value]="val">{{ val }}</option>
                      }
                    </datalist>

                    <button (click)="removeGeneralFilter(idx)" class="remove-btn" title="Remove condition">✕</button>
                  </div>
                }
              </div>
            }
          </div>
        </section>

        <!-- ══════════════════════════════════════════════════════
             SECTION 2 — ROWS SETUP (Step 1)
        ═══════════════════════════════════════════════════════════ -->
        <section class="rows-section card">
          <div class="flex-header">
            <div>
              <h3 class="section-title">Rows Setup (Step 1)</h3>
              <p class="section-desc">Define rows, labels, visual measure builders, and row-level filter conditions.</p>
            </div>
            <div class="table-actions">
              <button (click)="addRow()" class="action-btn-sm add">+ Add Row</button>
              <button (click)="deleteSelectedRows()" class="action-btn-sm delete-selected">🗑️ Delete Selected</button>
              <button (click)="resetRows()" class="action-btn-sm reset">↻ Reset</button>
              <button (click)="duplicateSelectedRow()" class="action-btn-sm duplicate">📄 Duplicate</button>
              <button (click)="reorderRows()" class="action-btn-sm reorder">➔ Reorder</button>
            </div>
          </div>

          <div class="table-wrapper rows-table-wrapper">
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width:40px"><input type="checkbox" (change)="toggleAllRowsSelect($event)" /></th>
                  <th style="width:70px">Row ID</th>
                  <th>Row Name (Label)*</th>
                  <th style="width:160px">Style / Layout</th>
                  <th style="width:260px">Measure Definition</th>
                  <th style="width:260px">Row Conditions / Filters</th>
                  <th style="width:140px">Active Columns</th>
                  <th style="width:60px;text-align:center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows; track row.rowId; let idx = $index) {
                  <tr [class.selected]="row.selected">
                    <td><input type="checkbox" [(ngModel)]="row.selected" /></td>

                    <!-- Row ID -->
                    <td>
                      <input type="text" [(ngModel)]="row.rowId" placeholder="R1" class="cell-input center" />
                    </td>

                    <!-- Row Label with indent controls -->
                    <td>
                      <div class="indent-wrapper" [style.padding-left.px]="row.indentLevel * 12">
                        <button (click)="changeIndent(row, -1)" class="indent-btn" title="Decrease indent">«</button>
                        <button (click)="changeIndent(row, 1)" class="indent-btn" title="Increase indent">»</button>
                        <input type="text" [(ngModel)]="row.label" placeholder="Row Label" class="cell-input" />
                      </div>
                    </td>

                    <!-- Style / Type -->
                    <td>
                      <div class="style-cell">
                        <select [(ngModel)]="row.rowType" (change)="onRowTypeChange(row)" class="cell-select">
                          <option value="data">📊 data</option>
                          <option value="calc">🧮 calc</option>
                          <option value="section">📂 section</option>
                          <option value="blank">🫙 blank</option>
                        </select>
                        <select [(ngModel)]="row.style" class="cell-select">
                          <option value="normal">Normal</option>
                          <option value="header">Header</option>
                          <option value="section">Section</option>
                          <option value="total">Total</option>
                          <option value="highlight">Highlight</option>
                          <option value="blank">Blank</option>
                        </select>
                      </div>
                    </td>

                    <!-- ── Measure Definition column ─────────────────── -->
                    <td class="measure-td">
                      @if (row.rowType === 'data') {
                        @if (row.customSqlMode) {
                          <!-- Custom SQL mode -->
                          <div class="measure-custom-row">
                            <input
                              type="text"
                              [(ngModel)]="row.source"
                              placeholder="e.g. SUM(amount)"
                              class="cell-input code"
                            />
                            <button
                              (click)="row.customSqlMode = false"
                              class="mode-toggle-btn visual"
                              title="Switch to visual builder"
                            >⬡ Visual</button>
                          </div>
                        } @else {
                          <!-- Visual measure builder -->
                          <div class="measure-builder-row">
                            <select [(ngModel)]="row.measureAgg" class="cell-select agg-select">
                              <option value="SUM">SUM</option>
                              <option value="COUNT">COUNT</option>
                              <option value="COUNT_DISTINCT">COUNT DIST</option>
                              <option value="AVG">AVG</option>
                              <option value="MIN">MIN</option>
                              <option value="MAX">MAX</option>
                            </select>
                            <span class="measure-of">of</span>
                            <select [(ngModel)]="row.measureCol" class="cell-select col-select">
                              <option value="">-- column --</option>
                              @for (col of tableColumns; track col) {
                                <option [value]="col">{{ col }}</option>
                              }
                            </select>
                            <button
                              (click)="row.customSqlMode = true"
                              class="mode-toggle-btn sql"
                              title="Switch to raw SQL mode"
                            >SQL</button>
                          </div>
                        }
                      } @else if (row.rowType === 'calc') {
                        <!-- Calc row: row-ID formula -->
                        <input
                          type="text"
                          [(ngModel)]="row.source"
                          placeholder="e.g. R2 / R3"
                          class="cell-input code"
                        />
                      } @else {
                        <span class="cell-na">—</span>
                      }
                    </td>

                    <!-- ── Row Conditions / Filters column ───────────── -->
                    <td class="filter-td">
                      @if (row.rowType === 'data') {
                        <div class="row-filter-wrapper">

                          <!-- Legacy filter badge (backward compat) -->
                          @if (row.legacyFilterExpr) {
                            <div class="legacy-filter-badge" title="Legacy SQL filter — add structured conditions above to replace">
                              <span class="legacy-icon">⚠️</span>
                              <code>{{ row.legacyFilterExpr }}</code>
                            </div>
                          }

                          <!-- Structured filter chips -->
                          <div class="filter-chips-mini">
                            @for (f of row.rowFilters; track $index; let fi = $index) {
                              <span class="filter-tag-mini">
                                @if (f.dimTable) {
                                  <span class="ft-dim">{{ f.dimTable }}.</span>
                                }
                                <span class="ft-attr">{{ f.attribute }}</span>
                                <span class="ft-op">{{ f.operator }}</span>
                                <span class="ft-val">{{ f.value }}</span>
                                <button (click)="removeRowFilter(row, fi)" class="ft-remove">✕</button>
                              </span>
                            }
                          </div>

                          <!-- Builder panel (active for this row) -->
                          @if (activeRowFilterId === row.rowId) {
                            <div class="row-filter-builder animate-fade-in">
                              <div class="rfb-row">
                                <!-- Table selector: fact or any linked dim -->
                                <select
                                  [(ngModel)]="pendingRowFilter.dimTable"
                                  (change)="onPendingFilterTableChange()"
                                  class="form-select sm rfb-table"
                                >
                                  <option value="">{{ sourceTable || 'Fact Table' }}</option>
                                  @for (dim of linkedDimensions; track dim) {
                                    <option [value]="dim">{{ dim }}</option>
                                  }
                                </select>

                                <!-- Column selector -->
                                <select
                                  [(ngModel)]="pendingRowFilter.attribute"
                                  (change)="onPendingFilterAttrChange()"
                                  class="form-select sm rfb-attr"
                                >
                                  <option value="">-- column --</option>
                                  @for (col of pendingFilterColumns; track col) {
                                    <option [value]="col">{{ col }}</option>
                                  }
                                </select>

                                <!-- Operator -->
                                <select [(ngModel)]="pendingRowFilter.operator" class="form-select sm rfb-op">
                                  <option value="=">=</option>
                                  <option value="!=">!=</option>
                                  <option value="is">is</option>
                                  <option value="is not">is not</option>
                                  <option value="in">in</option>
                                  <option value="like">contains</option>
                                  <option value=">">&gt;</option>
                                  <option value=">=">&gt;=</option>
                                  <option value="<">&lt;</option>
                                  <option value="<=">&lt;=</option>
                                </select>

                                <!-- Value with distinct suggestions -->
                                <input
                                  type="text"
                                  [(ngModel)]="pendingRowFilter.value"
                                  placeholder="value…"
                                  list="rfb-val-list"
                                  class="form-input sm rfb-val"
                                />
                                <datalist id="rfb-val-list">
                                  @for (v of pendingRowFilterValues; track v) {
                                    <option [value]="v">{{ v }}</option>
                                  }
                                </datalist>
                              </div>

                              <div class="rfb-actions">
                                <button (click)="confirmRowFilter(row)" class="rfb-confirm-btn">✓ Add Condition</button>
                                <button (click)="cancelRowFilter()" class="rfb-cancel-btn">Cancel</button>
                              </div>
                            </div>
                          } @else {
                            <button (click)="openRowFilterBuilder(row)" class="add-row-filter-btn">
                              + Add Condition
                            </button>
                          }
                        </div>
                      } @else if (row.rowType === 'calc') {
                        <span class="cell-na">n/a for calc rows</span>
                      } @else {
                        <span class="cell-na">—</span>
                      }
                    </td>

                    <!-- Active Columns toggles -->
                    <td>
                      <div class="col-enable-toggles">
                        @for (col of columns; track col.colId) {
                          <span
                            class="col-badge"
                            [class.active]="row.activeCols.includes(col.colId.toUpperCase())"
                            (click)="toggleColForRow(row, col.colId)"
                          >{{ col.colId }}</span>
                        }
                      </div>
                    </td>

                    <td style="text-align:center">
                      <button (click)="deleteRow(idx)" class="remove-btn" title="Delete Row">🗑️</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <!-- ══════════════════════════════════════════════════════
             SECTION 3 — COLUMNS SETUP (Step 2)  — unchanged
        ═══════════════════════════════════════════════════════════ -->
        <section class="columns-section card">
          <div class="flex-header">
            <div>
              <h3 class="section-title">Columns Setup (Step 2)</h3>
              <p class="section-desc">Define column headers, level layouts, timeframe types, rolling offsets, and formulas.</p>
            </div>
            <div class="table-actions">
              <button (click)="addColumn()" class="action-btn-sm add">+ Add Col</button>
              <button (click)="deleteSelectedCols()" class="action-btn-sm delete-selected">🗑️ Delete Selected</button>
              <button (click)="resetColumns()" class="action-btn-sm reset">↻ Reset</button>
              <button (click)="duplicateSelectedColumn()" class="action-btn-sm duplicate">📄 Duplicate</button>
              <button (click)="reorderColumns()" class="action-btn-sm reorder">➔ Reorder</button>
            </div>
          </div>

          <div class="table-wrapper">
            <table class="grid-table">
              <thead>
                <tr>
                  <th style="width:40px"><input type="checkbox" (change)="toggleAllColsSelect($event)" /></th>
                  <th style="width:70px">Col ID</th>
                  <th>Column Name / Header Label*</th>
                  <th style="width:140px">Col Type</th>
                  <th style="width:160px">Header Style</th>
                  <th style="width:100px">Period Offset</th>
                  <th style="width:100px">Rolling N</th>
                  <th style="width:200px">Formula / Expression</th>
                  <th style="width:60px;text-align:center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (col of columns; track col.colId; let idx = $index) {
                  <tr [class.selected]="col.selected">
                    <td><input type="checkbox" [(ngModel)]="col.selected" /></td>
                    <td>
                      <input type="text" [(ngModel)]="col.colId" placeholder="C1" class="cell-input center" />
                    </td>
                    <td>
                      <input type="text" [(ngModel)]="col.label" placeholder="Column Header Label" class="cell-input" />
                    </td>
                    <td>
                      <select [(ngModel)]="col.colType" class="cell-select">
                        <option value="WEEK">WEEK</option>
                        <option value="MTD">MTD</option>
                        <option value="YTD">YTD</option>
                        <option value="ROLLING">ROLLING</option>
                        <option value="CALC">CALC</option>
                      </select>
                    </td>
                    <td>
                      <select [(ngModel)]="col.headerLayout" class="cell-select">
                        <option value="normal">Normal</option>
                        <option value="bold">Bold, Center</option>
                        <option value="border">Bold, Border</option>
                      </select>
                    </td>
                    <td>
                      <input type="number" [(ngModel)]="col.periodOffset" [disabled]="col.colType === 'CALC'" class="cell-input center" />
                    </td>
                    <td>
                      <input type="number" [(ngModel)]="col.rollingN" [disabled]="col.colType !== 'ROLLING'" placeholder="e.g. 10" class="cell-input center" />
                    </td>
                    <td>
                      <input
                        type="text"
                        [(ngModel)]="col.formulaExpr"
                        [placeholder]="col.colType === 'CALC' ? 'e.g. (C1-C2)/C2' : '-'"
                        [disabled]="col.colType !== 'CALC'"
                        class="cell-input code"
                      />
                    </td>
                    <td style="text-align:center">
                      <button (click)="deleteColumn(idx)" class="remove-btn" title="Delete Column">🗑️</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  `,
  styles: [`
    .builder-container {
      display: flex;
      min-height: 100vh;
      background: #0f172a;
      color: #f8fafc;
      font-family: 'Outfit', 'Inter', sans-serif;
    }

    /* ── Sidebar ────────────────────────────────────── */
    .sidebar {
      width: 260px;
      background: rgba(30, 41, 59, 0.5);
      border-right: 1px solid rgba(255,255,255,0.05);
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      padding: 24px;
      gap: 32px;
      flex-shrink: 0;
    }

    .sidebar-brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { font-size: 28px; }
    .brand-text {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .sidebar-menu { display: flex; flex-direction: column; gap: 8px; flex-grow: 1; }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      color: #94a3b8;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .menu-item:hover { color: #f8fafc; background: rgba(255,255,255,0.05); }
    .menu-icon { font-size: 18px; }

    .back-btn {
      width: 100%;
      padding: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #f8fafc;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .back-btn:hover {
      background: rgba(239,68,68,0.15);
      border-color: rgba(239,68,68,0.3);
      color: #fca5a5;
    }

    /* ── Main Content ───────────────────────────────── */
    .main-content {
      flex-grow: 1;
      padding: 40px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 32px;
      max-width: calc(100vw - 260px);
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 24px;
    }

    .breadcrumbs { font-size: 13px; color: #64748b; margin-bottom: 8px; }
    .breadcrumbs a { color: #818cf8; text-decoration: none; }
    .breadcrumbs a:hover { text-decoration: underline; }

    h1 { font-size: 32px; font-weight: 800; margin: 0; letter-spacing: -1px; }
    .report-subtitle { font-size: 15px; color: #94a3b8; margin: 4px 0 0 0; }

    .action-buttons { display: flex; gap: 12px; }

    .preview-btn {
      padding: 12px 24px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .preview-btn:hover { background: rgba(255,255,255,0.1); border-color: #818cf8; }

    .save-btn {
      padding: 12px 24px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border: none;
      border-radius: 10px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(99,102,241,0.3);
      transition: all 0.2s ease;
    }
    .save-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      box-shadow: 0 6px 16px rgba(99,102,241,0.4);
    }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Cards ──────────────────────────────────────── */
    .card {
      background: rgba(30,41,59,0.4);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 20px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .section-title { font-size: 20px; font-weight: 700; margin: 0; color: #f8fafc; }
    .section-desc  { font-size: 14px; color: #94a3b8; margin: 4px 0 0 0; }

    /* ── Form elements ──────────────────────────────── */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }

    .form-group { display: flex; flex-direction: column; gap: 8px; }

    .form-group label {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
    }

    .label-hint {
      font-size: 11px;
      font-weight: 400;
      color: #475569;
      margin-left: 4px;
    }

    .field-hint {
      font-size: 11px;
      color: #475569;
      font-style: italic;
    }

    .form-input, .form-select {
      background: rgba(15,23,42,0.6);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 14px;
      color: white;
      outline: none;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s ease;
    }
    .form-input:focus, .form-select:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
    }
    .form-input:disabled, .form-select:disabled { opacity: 0.5; cursor: not-allowed; }

    .form-select.sm, .form-input.sm {
      padding: 6px 10px;
      font-size: 12px;
    }

    /* ── Timeframe redesign ─────────────────────────── */
    .timeframe-group { grid-column: 1 / -1; }

    .timeframe-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .tf-start { flex: 0 0 180px; }
    .tf-arrow  { color: #475569; font-size: 18px; }

    .tf-end-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .mode-btn-group {
      display: flex;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .mode-btn {
      padding: 8px 14px;
      background: rgba(15,23,42,0.5);
      border: none;
      border-right: 1px solid rgba(255,255,255,0.07);
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .mode-btn:last-child { border-right: none; }
    .mode-btn:hover { background: rgba(99,102,241,0.1); color: #c7d2fe; }
    .mode-btn.active {
      background: rgba(99,102,241,0.25);
      color: #a5b4fc;
      box-shadow: inset 0 1px 0 rgba(99,102,241,0.3);
    }

    .tf-end { flex: 0 0 160px; }

    .computed-date-badge {
      padding: 8px 14px;
      background: rgba(15,23,42,0.5);
      border: 1px solid rgba(99,102,241,0.2);
      border-radius: 8px;
      color: #a5b4fc;
      font-size: 13px;
      font-weight: 600;
      font-family: 'Fira Code', monospace;
      white-space: nowrap;
    }

    /* ── Linked Dimensions chips ────────────────────── */
    .dim-chip-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      background: rgba(15,23,42,0.3);
      padding: 14px;
      border-radius: 12px;
      border: 1px solid rgba(99,102,241,0.1);
    }

    .dim-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #94a3b8;
    }
    .dim-chip:hover {
      background: rgba(99,102,241,0.1);
      border-color: rgba(99,102,241,0.3);
      color: #c7d2fe;
    }
    .dim-chip.active {
      background: rgba(99,102,241,0.18);
      border-color: rgba(99,102,241,0.45);
      color: #a5b4fc;
    }
    .dim-chip-icon { font-size: 11px; font-weight: 800; }
    .dim-chip-join-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(168,85,247,0.15);
      color: #d8b4fe;
      text-transform: uppercase;
    }

    /* ── Chip containers (quick filters) ────────────── */
    .chip-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      background: rgba(15,23,42,0.3);
      padding: 12px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.05);
    }

    .chip-group-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      padding: 0 4px;
      align-self: center;
    }

    .filter-chip {
      padding: 5px 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #cbd5e1;
    }
    .filter-chip:hover { background: rgba(255,255,255,0.1); color: white; }
    .filter-chip.active {
      background: rgba(99,102,241,0.15);
      color: #a5b4fc;
      border-color: rgba(99,102,241,0.4);
    }
    .dim-filter-chip.active {
      background: rgba(168,85,247,0.15);
      color: #d8b4fe;
      border-color: rgba(168,85,247,0.4);
    }

    /* ── General Filters builder ────────────────────── */
    .flex-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .add-sub-btn {
      padding: 6px 14px;
      background: rgba(99,102,241,0.1);
      border: 1px dashed rgba(99,102,241,0.3);
      border-radius: 8px;
      color: #a5b4fc;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .add-sub-btn:hover { background: rgba(99,102,241,0.2); border-color: #6366f1; color: white; }

    .empty-filters { font-size: 13px; color: #64748b; margin: 4px 0; font-style: italic; }

    .filters-list { display: flex; flex-direction: column; gap: 10px; }

    .filter-row {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(15,23,42,0.4);
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.03);
      flex-wrap: wrap;
    }

    .dim-select { max-width: 160px; color: #d8b4fe; font-weight: 600; }
    .form-select.sm.operator { width: 90px; color: #a5b4fc; font-weight: 600; text-align: center; }

    .remove-btn {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 14px;
      padding: 5px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
    }
    .remove-btn:hover { background: rgba(239,68,68,0.1); }

    /* ── Grid tables (rows/columns) ─────────────────── */
    .table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.05);
      background: rgba(15,23,42,0.4);
    }

    .rows-table-wrapper { overflow-x: auto; }

    .grid-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }

    .grid-table th {
      background: rgba(15,23,42,0.8);
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
      padding: 12px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      white-space: nowrap;
    }

    .grid-table td {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      vertical-align: top;
    }

    .grid-table tr.selected { background: rgba(99,102,241,0.05); }

    .cell-input, .cell-select {
      width: 100%;
      background: rgba(15,23,42,0.4);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 6px;
      padding: 6px 10px;
      color: white;
      outline: none;
      font-size: 12px;
      font-family: inherit;
      box-sizing: border-box;
    }
    .cell-input:focus, .cell-select:focus {
      border-color: #6366f1;
      background: rgba(15,23,42,0.8);
    }
    .cell-input.center { text-align: center; }
    .cell-input.code   { font-family: 'Fira Code', monospace; color: #38bdf8; }

    .indent-wrapper { display: flex; align-items: center; gap: 5px; }
    .indent-btn {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 4px;
      color: #94a3b8;
      cursor: pointer;
      font-size: 10px;
      width: 20px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .indent-btn:hover { color: white; background: rgba(255,255,255,0.1); }

    .style-cell { display: flex; gap: 5px; }

    .cell-na { font-size: 12px; color: #334155; }

    /* ── Measure builder ────────────────────────────── */
    .measure-td { min-width: 230px; }

    .measure-builder-row {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }

    .measure-custom-row {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .agg-select {
      flex: 0 0 auto;
      width: 90px;
      font-weight: 700;
      color: #34d399;
      background: rgba(16,185,129,0.08);
      border-color: rgba(16,185,129,0.2);
    }

    .measure-of {
      font-size: 11px;
      color: #475569;
      font-style: italic;
      flex-shrink: 0;
    }

    .col-select {
      flex: 1 1 auto;
      min-width: 90px;
      color: #38bdf8;
    }

    .mode-toggle-btn {
      flex-shrink: 0;
      padding: 4px 8px;
      border-radius: 5px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid;
      font-family: inherit;
      transition: all 0.15s ease;
    }
    .mode-toggle-btn.sql {
      background: rgba(99,102,241,0.08);
      border-color: rgba(99,102,241,0.25);
      color: #818cf8;
    }
    .mode-toggle-btn.sql:hover { background: rgba(99,102,241,0.18); color: white; }
    .mode-toggle-btn.visual {
      background: rgba(16,185,129,0.08);
      border-color: rgba(16,185,129,0.25);
      color: #34d399;
    }
    .mode-toggle-btn.visual:hover { background: rgba(16,185,129,0.18); color: white; }

    /* ── Row Filter cell ────────────────────────────── */
    .filter-td { min-width: 240px; vertical-align: top; }

    .row-filter-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .filter-chips-mini {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .filter-tag-mini {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 3px 8px;
      background: rgba(99,102,241,0.1);
      border: 1px solid rgba(99,102,241,0.2);
      border-radius: 12px;
      font-size: 11px;
      color: #c7d2fe;
      white-space: nowrap;
    }

    .ft-dim  { color: #d8b4fe; font-weight: 700; }
    .ft-attr { color: #c7d2fe; font-weight: 600; }
    .ft-op   { color: #64748b; font-style: italic; margin: 0 2px; }
    .ft-val  { color: #f8fafc; }
    .ft-remove {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 10px;
      padding: 0 2px;
      line-height: 1;
    }

    .add-row-filter-btn {
      align-self: flex-start;
      padding: 4px 10px;
      background: rgba(99,102,241,0.08);
      border: 1px dashed rgba(99,102,241,0.25);
      border-radius: 6px;
      color: #818cf8;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .add-row-filter-btn:hover {
      background: rgba(99,102,241,0.18);
      border-color: #6366f1;
      color: white;
    }

    /* Inline row filter builder */
    .row-filter-builder {
      background: rgba(15,23,42,0.7);
      border: 1px solid rgba(99,102,241,0.25);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rfb-row {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }

    .rfb-table { flex: 0 0 130px; color: #d8b4fe; font-weight: 600; }
    .rfb-attr  { flex: 1 1 100px; }
    .rfb-op    { flex: 0 0 80px; color: #a5b4fc; font-weight: 600; }
    .rfb-val   { flex: 1 1 80px; }

    .rfb-actions { display: flex; gap: 6px; }

    .rfb-confirm-btn {
      padding: 5px 12px;
      background: rgba(16,185,129,0.15);
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 6px;
      color: #34d399;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .rfb-confirm-btn:hover { background: rgba(16,185,129,0.25); color: white; }

    .rfb-cancel-btn {
      padding: 5px 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      color: #64748b;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .rfb-cancel-btn:hover { color: #f8fafc; background: rgba(255,255,255,0.08); }

    /* Legacy filter badge */
    .legacy-filter-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(234,179,8,0.08);
      border: 1px solid rgba(234,179,8,0.2);
      border-radius: 8px;
      font-size: 11px;
      color: #fde68a;
    }
    .legacy-icon { font-size: 11px; }
    .legacy-filter-badge code {
      font-family: 'Fira Code', monospace;
      color: #fde68a;
      background: none;
      border: none;
      padding: 0;
    }

    /* ── Grid Action buttons ────────────────────────── */
    .table-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .action-btn-sm {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    .action-btn-sm:hover { background: rgba(255,255,255,0.1); }

    .action-btn-sm.add {
      background: rgba(34,197,94,0.1);
      border-color: rgba(34,197,94,0.3);
      color: #4ade80;
    }
    .action-btn-sm.add:hover { background: rgba(34,197,94,0.2); }

    .action-btn-sm.delete-selected {
      background: rgba(239,68,68,0.1);
      border-color: rgba(239,68,68,0.3);
      color: #fca5a5;
    }
    .action-btn-sm.delete-selected:hover { background: rgba(239,68,68,0.2); border-color: #ef4444; }

    /* ── Column toggles ─────────────────────────────── */
    .col-enable-toggles { display: flex; gap: 4px; flex-wrap: wrap; }

    .col-badge {
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #64748b;
      cursor: pointer;
      font-size: 10px;
      font-weight: bold;
      transition: all 0.15s ease;
    }
    .col-badge.active {
      background: rgba(34,197,94,0.15);
      color: #4ade80;
      border-color: rgba(34,197,94,0.3);
    }

    /* ── Preview table ──────────────────────────────── */
    .preview-section { }

    .spreadsheet-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .spreadsheet-table th {
      background: rgba(15,23,42,0.6);
      color: #94a3b8;
      padding: 10px 14px;
      font-size: 11px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .spreadsheet-table td {
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }

    .preview-col-label { font-size: 9px; color: #64748b; text-transform: none; margin-top: 2px; }

    .spreadsheet-table tr.row-style-header { background: rgba(27,79,114,0.3); color: white; border-bottom: 2px solid #1B4F72; }
    .spreadsheet-table tr.row-style-section { background: rgba(214,234,248,0.1); color: #a5b4fc; }
    .spreadsheet-table tr.row-style-total { background: rgba(235,245,251,0.05); border-top: 1px solid rgba(255,255,255,0.2); border-bottom: 2px double rgba(255,255,255,0.3); font-weight: bold; }
    .spreadsheet-table tr.row-style-highlight { background: rgba(255,220,0,0.05); color: #fbbf24; }

    .sticky-col { position: sticky; left: 0; background: #1e293b; z-index: 2; }
    .col-flag-header { text-align: center !important; }
    .col-flag-cell { text-align: center; }

    .flag-dot {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(34,197,94,0.2);
      color: #4ade80;
      font-weight: bold;
      font-size: 10px;
    }
    .flag-dash { color: #334155; }

    .row-type-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .row-type-badge.section { background: #1e293b; color: #cbd5e1; }
    .row-type-badge.data    { background: rgba(56,189,248,0.15); color: #38bdf8; }
    .row-type-badge.calc    { background: rgba(34,197,94,0.15); color: #4ade80; }
    .row-type-badge.blank   { background: transparent; color: #475569; }

    /* ── Alerts ─────────────────────────────────────── */
    .alert {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
    }
    .success-alert { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #a7f3d0; }
    .error-alert   { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
    .alert-icon    { font-size: 16px; }

    /* ── Spinner ────────────────────────────────────── */
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      display: inline-block;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .animate-fade-in {
      animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class ReportBuilderComponent implements OnInit {
  isNewReport = true;
  saving        = signal(false);
  showPreview   = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage   = signal<string | null>(null);

  // ── DB Metadata ─────────────────────────────────────────────────────────
  dbTables: string[]     = [];
  tableColumns: string[] = [];
  distinctValues: { [key: string]: string[] } = {};

  // ── Dimension joins & linked dimensions ─────────────────────────────────
  dimensionJoins: any[]  = [];          // all joins available for the selected fact table
  linkedDimensions: string[] = [];       // user-selected dim views to activate
  dimensionColumnsCache: { [dimView: string]: string[] } = {};
  loadingDimJoins = false;

  // ── Reporting date ───────────────────────────────────────────────────────
  reportingDate = '';
  availableReportingDates: string[] = [];

  // ── Form Fields ──────────────────────────────────────────────────────────
  reportId      = '';
  reportName    = '';
  reportVersion = 1;
  status        = 'draft';
  sourceTable   = '';
  granularity   = '';
  timeframeStart = '2022-01-01';
  timeframeEnd   = '';
  timeframeMode: 'custom' | 'today_minus_2' | 'today' = 'today_minus_2';
  quickFiltersList: string[]     = [];
  generalFilters: FilterCondition[] = [];

  // ── Row filter builder state ─────────────────────────────────────────────
  activeRowFilterId = '';
  pendingRowFilter: RowFilterCondition = { dimTable: '', attribute: '', operator: '=', value: '' };
  pendingRowFilterValues: string[]     = [];
  pendingFilterColumns: string[]       = [];

  // ── Rows and Columns Data Models ─────────────────────────────────────────
  rows: any[]    = [];
  columns: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private reportService: ReportService,
    private authService: AuthService,
    private router: Router
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  get computedTimeframeEnd(): string {
    if (this.timeframeMode === 'today') {
      return this.todayString();
    } else if (this.timeframeMode === 'today_minus_2') {
      return this.dateOffsetString(-2);
    }
    return this.timeframeEnd;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.loadReportingDates();

    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id && id !== 'new') {
        this.isNewReport = false;
        this.reportId = id;
        // Fire both fetches in parallel — total wait = max(t_tables, t_config)
        forkJoin({
          tables: this.reportService.getTables(),
          config: this.reportService.getReportConfig(id, '2025-12-31')
        }).subscribe({
          next: ({ tables, config }) => {
            this.dbTables = tables;
            this.applyReportConfig(config);
          },
          error: () => this.errorMessage.set('Failed to load report definition details.')
        });
      } else {
        this.isNewReport = true;
        this.reportService.getTables().subscribe({
          next: (tbls) => { this.dbTables = tbls; }
        });
        this.initializeDefaultCatalog();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT CONFIG — LOAD & APPLY
  // ═══════════════════════════════════════════════════════════════════════════

  applyReportConfig(data: any): void {
    this.reportId      = data.reportId;
    this.reportName    = data.name;
    this.reportVersion = data.version || 1;
    this.status        = data.status  || 'draft';
    this.sourceTable   = data.sourceTable || '';
    this.granularity   = data.granularity || '';
    this.reportingDate = data.reportingDate || '';

    // Timeframe
    if (data.timeframeToday) {
      this.timeframeMode = 'today';
    } else {
      this.timeframeMode = 'custom';
      this.timeframeEnd  = this.formatDateForInput(data.timeframeEnd || '');
    }
    this.timeframeStart = this.formatDateForInput(data.timeframeStart || '2022-01-01');

    // Quick & general filters
    this.quickFiltersList = data.quickFilters
      ? data.quickFilters.split(',').filter(Boolean)
      : [];

    try {
      this.generalFilters = data.generalFilters ? JSON.parse(data.generalFilters) : [];
    } catch {
      this.generalFilters = [];
    }

    // Linked dimensions
    this.linkedDimensions = data.linkedDimensions
      ? data.linkedDimensions.split(',').filter(Boolean)
      : [];

    // Columns
    this.columns = (data.columns || []).map((c: any) => ({
      colId:        c.colId,
      label:        c.label,
      colType:      c.colType,
      headerLayout: c.headerLayout || 'border',
      periodOffset: c.periodOffset,
      rollingN:     c.rollingN,
      formulaExpr:  c.formulaExpr,
      selected:     false
    }));

    // Rows — parse measure + rowFilters
    this.rows = (data.rows || []).map((r: any) => {
      const measure         = this.parseMeasure(r.source || '');
      const { rowFilters, legacyFilterExpr } = this.parseRowFilterExpr(r.filterExpr || '');
      return {
        rowId:           r.rowId,
        label:           r.label,
        rowType:         r.rowType,
        source:          r.source || '',
        parentRowId:     r.parentRowId || '',
        style:           r.style || 'normal',
        indentLevel:     r.indentLevel || 0,
        filterExpr:      r.filterExpr || '',
        activeCols:      Array.from(r.activeCols || []),
        selected:        false,
        // Measure builder
        measureAgg:      measure.aggFunction,
        measureCol:      measure.measureCol,
        customSqlMode:   measure.customSqlMode,
        // Row filters
        rowFilters,
        legacyFilterExpr
      };
    });

    // Load columns & joins for the source table
    if (this.sourceTable) {
      this.loadTableMetadata(this.sourceTable);
      this.loadDimensionJoins(this.sourceTable);
    }
    // Eagerly load cached columns for already-linked dimensions
    this.linkedDimensions.forEach(dim => this.loadDimensionColumns(dim));
  }

  initializeDefaultCatalog(): void {
    this.reportId      = '';
    this.reportName    = '';
    this.reportVersion = 1;
    this.sourceTable   = '';
    this.granularity   = '';
    this.reportingDate = '';
    this.timeframeStart = '2022-01-01';
    this.timeframeMode  = 'today_minus_2';
    this.timeframeEnd   = this.dateOffsetString(-2);
    this.quickFiltersList = [];
    this.generalFilters   = [];
    this.linkedDimensions = [];

    // Default columns
    this.columns = [
      { colId: 'C1', label: 'Previous Weeks',  colType: 'WEEK', headerLayout: 'border', periodOffset: -1, rollingN: null, formulaExpr: '', selected: false },
      { colId: 'C2', label: 'WTD no.',          colType: 'WEEK', headerLayout: 'bold',   periodOffset:  0, rollingN: null, formulaExpr: '', selected: false },
      { colId: 'C3', label: 'Budget WTD',       colType: 'WEEK', headerLayout: 'border', periodOffset:  0, rollingN: null, formulaExpr: '', selected: false }
    ];

    // Default rows
    this.rows = [
      this.makeDefaultRow('R1', 'Report Header',  'section', 'section', 0),
      this.makeDefaultRow('R2', 'GBS gross',       'data',    'normal',  1, { agg: 'SUM', col: 'amount', filters: [{ dimTable: '', attribute: 'lifecycle', operator: '=', value: '2' }] }),
      this.makeDefaultRow('R3', 'GBS net',         'data',    'normal',  1, { agg: 'SUM', col: 'amount', filters: [{ dimTable: '', attribute: 'lifecycle', operator: '=', value: '10' }] })
    ];
  }

  private makeDefaultRow(
    rowId: string, label: string, rowType: string, style: string,
    indentLevel: number,
    measure?: { agg: string; col: string; filters?: RowFilterCondition[] }
  ): any {
    return {
      rowId, label, rowType,
      source: measure ? `${measure.agg}(${measure.col})` : '',
      parentRowId: '', style, indentLevel,
      filterExpr: measure?.filters ? JSON.stringify(measure.filters) : '',
      activeCols: ['C1', 'C2', 'C3'],
      selected: false,
      measureAgg:      measure?.agg  || 'SUM',
      measureCol:      measure?.col  || '',
      customSqlMode:   false,
      rowFilters:      measure?.filters || [],
      legacyFilterExpr: ''
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE / DIMENSION LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  onTableChange(): void {
    if (!this.sourceTable) {
      this.tableColumns  = [];
      this.granularity   = '';
      this.dimensionJoins = [];
      this.linkedDimensions = [];
      this.dimensionColumnsCache = {};
      return;
    }
    this.loadTableMetadata(this.sourceTable);
    this.loadDimensionJoins(this.sourceTable);
  }

  loadTableMetadata(table: string): void {
    this.reportService.getTableColumns(table).subscribe({
      next: (cols) => { this.tableColumns = cols; }
    });
  }

  loadDimensionJoins(factTable: string): void {
    this.loadingDimJoins = true;
    this.dimensionJoins  = [];
    this.reportService.getDimensionJoins(factTable).subscribe({
      next: (joins) => {
        this.dimensionJoins = joins || [];
        this.loadingDimJoins = false;
      },
      error: () => {
        this.loadingDimJoins = false;
        // Fail silently — joins panel just won't show
      }
    });
  }

  loadDimensionColumns(dimView: string): void {
    if (this.dimensionColumnsCache[dimView]) return; // already cached
    this.reportService.getTableColumns(dimView).subscribe({
      next: (cols) => { this.dimensionColumnsCache = { ...this.dimensionColumnsCache, [dimView]: cols }; }
    });
  }

  getDimColumns(dimView: string): string[] {
    return this.dimensionColumnsCache[dimView] || [];
  }

  isDimensionLinked(dimView: string): boolean {
    return this.linkedDimensions.includes(dimView);
  }

  toggleLinkedDimension(dimView: string): void {
    const idx = this.linkedDimensions.indexOf(dimView);
    if (idx === -1) {
      this.linkedDimensions.push(dimView);
      this.loadDimensionColumns(dimView);  // lazy-load on first enable
    } else {
      this.linkedDimensions.splice(idx, 1);
    }
  }

  getColumnsForFilterTable(dimTable: string | undefined): string[] {
    if (!dimTable) return this.tableColumns;           // fact table
    return this.getDimColumns(dimTable);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMEFRAME
  // ═══════════════════════════════════════════════════════════════════════════

  setTimeframeMode(mode: 'custom' | 'today_minus_2' | 'today'): void {
    this.timeframeMode = mode;
    if (mode === 'today_minus_2') this.timeframeEnd = this.dateOffsetString(-2);
    if (mode === 'today')         this.timeframeEnd = this.todayString();
  }

  private todayString(): string      { return this.dateOffsetString(0); }
  private dateOffsetString(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTING DATE
  // ═══════════════════════════════════════════════════════════════════════════

  loadReportingDates(): void {
    this.reportService.getReportingDates().subscribe({
      next: (dates) => { this.availableReportingDates = dates || []; },
      error: () => { /* fail silently — user can still type a date */ }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  isQuickFilter(key: string): boolean   { return this.quickFiltersList.includes(key); }
  toggleQuickFilter(key: string): void {
    const idx = this.quickFiltersList.indexOf(key);
    if (idx === -1) this.quickFiltersList.push(key);
    else            this.quickFiltersList.splice(idx, 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAL FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  addGeneralFilter(): void {
    this.generalFilters.push({ attribute: '', operator: 'is', value: '', dimTable: '' });
  }

  removeGeneralFilter(index: number): void {
    this.generalFilters.splice(index, 1);
  }

  onGeneralFilterTableChange(filter: FilterCondition): void {
    filter.attribute = '';
    filter.value     = '';
  }

  loadGeneralFilterValues(filter: FilterCondition): void {
    const table = filter.dimTable || this.sourceTable;
    if (!table || !filter.attribute) return;
    const key = `${table}.${filter.attribute}`;
    if (this.distinctValues[key]) return;
    this.reportService.getDistinctValues(table, filter.attribute).subscribe({
      next: (vals) => { this.distinctValues = { ...this.distinctValues, [key]: vals }; }
    });
  }

  getGeneralFilterOptions(filter: FilterCondition): string[] {
    const table = filter.dimTable || this.sourceTable;
    return this.distinctValues[`${table}.${filter.attribute}`] || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW FILTER BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  openRowFilterBuilder(row: any): void {
    this.activeRowFilterId   = row.rowId;
    this.pendingRowFilter    = { dimTable: '', attribute: '', operator: '=', value: '' };
    this.pendingRowFilterValues = [];
    this.pendingFilterColumns   = [...this.tableColumns];
  }

  cancelRowFilter(): void {
    this.activeRowFilterId      = '';
    this.pendingRowFilter       = { dimTable: '', attribute: '', operator: '=', value: '' };
    this.pendingRowFilterValues = [];
    this.pendingFilterColumns   = [];
  }

  onPendingFilterTableChange(): void {
    this.pendingRowFilter.attribute = '';
    this.pendingRowFilter.value     = '';
    this.pendingRowFilterValues     = [];
    const table = this.pendingRowFilter.dimTable || this.sourceTable;
    if (this.pendingRowFilter.dimTable) {
      this.loadDimensionColumns(this.pendingRowFilter.dimTable);
      // Give the cache update a moment to propagate, then refresh columns
      setTimeout(() => {
        this.pendingFilterColumns = this.getDimColumns(this.pendingRowFilter.dimTable) || [];
      }, 100);
    } else {
      this.pendingFilterColumns = [...this.tableColumns];
    }
  }

  onPendingFilterAttrChange(): void {
    const table = this.pendingRowFilter.dimTable || this.sourceTable;
    const attr  = this.pendingRowFilter.attribute;
    if (!table || !attr) return;
    const key = `${table}.${attr}`;
    if (this.distinctValues[key]) {
      this.pendingRowFilterValues = this.distinctValues[key];
      return;
    }
    this.reportService.getDistinctValues(table, attr).subscribe({
      next: (vals) => {
        this.distinctValues = { ...this.distinctValues, [key]: vals };
        this.pendingRowFilterValues = vals;
      }
    });
  }

  confirmRowFilter(row: any): void {
    if (!this.pendingRowFilter.attribute) return;
    if (!row.rowFilters) row.rowFilters = [];
    row.rowFilters.push({ ...this.pendingRowFilter });
    this.cancelRowFilter();
  }

  removeRowFilter(row: any, index: number): void {
    row.rowFilters.splice(index, 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW TYPE CHANGE
  // ═══════════════════════════════════════════════════════════════════════════

  onRowTypeChange(row: any): void {
    if (row.rowType !== 'data') {
      row.rowFilters     = [];
      row.legacyFilterExpr = '';
    }
    if (row.rowType === 'section' || row.rowType === 'blank') {
      row.source         = '';
      row.customSqlMode  = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEASURE SERIALIZATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private parseMeasure(source: string): { aggFunction: string; measureCol: string; customSqlMode: boolean } {
    if (!source) return { aggFunction: 'SUM', measureCol: '', customSqlMode: false };
    const m = source.match(/^(SUM|COUNT|COUNT_DISTINCT|AVG|MIN|MAX)\((.+)\)$/i);
    if (m) return { aggFunction: m[1].toUpperCase(), measureCol: m[2], customSqlMode: false };
    return { aggFunction: 'SUM', measureCol: '', customSqlMode: true };
  }

  private parseRowFilterExpr(filterExpr: string): { rowFilters: RowFilterCondition[]; legacyFilterExpr: string } {
    if (!filterExpr) return { rowFilters: [], legacyFilterExpr: '' };
    try {
      const parsed = JSON.parse(filterExpr);
      if (Array.isArray(parsed)) return { rowFilters: parsed, legacyFilterExpr: '' };
    } catch { /* not JSON */ }
    return { rowFilters: [], legacyFilterExpr: filterExpr };
  }

  private serializeMeasure(row: any): string {
    if (row.rowType !== 'data') return row.source || '';
    if (row.customSqlMode || !row.measureAgg || !row.measureCol) return row.source || '';
    return `${row.measureAgg}(${row.measureCol})`;
  }

  private serializeRowFilters(row: any): string {
    if (row.rowType !== 'data') return '';
    if (row.rowFilters && row.rowFilters.length > 0) return JSON.stringify(row.rowFilters);
    return row.legacyFilterExpr || '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROWS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  addRow(): void {
    const n = this.rows.length + 1;
    this.rows.push(this.makeDefaultRow(
      `R${n}`, `New Row ${n}`, 'data', 'normal', 0,
      { agg: 'SUM', col: this.tableColumns[0] || 'amount', filters: [] }
    ));
  }

  resetRows(): void {
    if (confirm('Are you sure you want to reset all rows?')) this.rows = [];
  }

  deleteRow(index: number): void {
    const r = this.rows[index];
    if (confirm(`Delete row "${r.label || r.rowId}"?`)) this.rows.splice(index, 1);
  }

  deleteSelectedRows(): void {
    const n = this.rows.filter(r => r.selected).length;
    if (!n) { alert('Select at least one row to delete.'); return; }
    if (confirm(`Delete ${n} selected row(s)?`)) this.rows = this.rows.filter(r => !r.selected);
  }

  duplicateSelectedRow(): void {
    const sel = this.rows.filter(r => r.selected);
    if (!sel.length) { alert('Select at least one row to duplicate.'); return; }
    sel.forEach(sr => {
      this.rows.push({ ...sr, rowId: `R${this.rows.length + 1}`, label: `${sr.label} (Copy)`, selected: false, rowFilters: [...(sr.rowFilters || [])] });
    });
  }

  reorderRows(): void {
    this.rows.sort((a, b) => {
      const an = parseInt(a.rowId.replace(/\D/g, '')) || 0;
      const bn = parseInt(b.rowId.replace(/\D/g, '')) || 0;
      return an - bn;
    });
  }

  toggleAllRowsSelect(event: any): void {
    const checked = event.target.checked;
    this.rows.forEach(r => r.selected = checked);
  }

  changeIndent(row: any, diff: number): void {
    row.indentLevel = Math.max(0, (row.indentLevel || 0) + diff);
  }

  toggleColForRow(row: any, colId: string): void {
    const cid = colId.toUpperCase();
    const idx = row.activeCols.indexOf(cid);
    if (idx === -1) row.activeCols.push(cid);
    else            row.activeCols.splice(idx, 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMNS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  addColumn(): void {
    const n = this.columns.length + 1;
    this.columns.push({ colId: `C${n}`, label: `Column ${n}`, colType: 'WEEK', headerLayout: 'border', periodOffset: 0, rollingN: null, formulaExpr: '', selected: false });
  }

  resetColumns(): void {
    if (confirm('Reset all columns?')) this.columns = [];
  }

  deleteColumn(index: number): void {
    const c = this.columns[index];
    if (confirm(`Delete column "${c.label || c.colId}"?`)) {
      const cid = c.colId.toUpperCase();
      this.columns.splice(index, 1);
      this.rows.forEach(row => {
        if (row.activeCols) row.activeCols = row.activeCols.filter((id: string) => id.toUpperCase() !== cid);
      });
    }
  }

  deleteSelectedCols(): void {
    const sel = this.columns.filter(c => c.selected);
    if (!sel.length) { alert('Select at least one column to delete.'); return; }
    if (confirm(`Delete ${sel.length} selected column(s)?`)) {
      const ids = sel.map(c => c.colId.toUpperCase());
      this.columns = this.columns.filter(c => !c.selected);
      this.rows.forEach(row => {
        if (row.activeCols) row.activeCols = row.activeCols.filter((id: string) => !ids.includes(id.toUpperCase()));
      });
    }
  }

  duplicateSelectedColumn(): void {
    const sel = this.columns.filter(c => c.selected);
    if (!sel.length) { alert('Select at least one column to duplicate.'); return; }
    sel.forEach(sc => this.columns.push({ ...sc, colId: `C${this.columns.length + 1}`, label: `${sc.label} (Copy)`, selected: false }));
  }

  reorderColumns(): void {
    this.columns.sort((a, b) => {
      const an = parseInt(a.colId.replace(/\D/g, '')) || 0;
      const bn = parseInt(b.colId.replace(/\D/g, '')) || 0;
      return an - bn;
    });
  }

  toggleAllColsSelect(event: any): void {
    const checked = event.target.checked;
    this.columns.forEach(c => c.selected = checked);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  togglePreview(): void { this.showPreview.set(!this.showPreview()); }

  saveConfig(): void {
    if (!this.reportId || !this.reportName) {
      this.errorMessage.set('Report ID and Report Title are mandatory fields.');
      return;
    }
    if (!this.sourceTable) {
      this.errorMessage.set('Source Table is required.');
      return;
    }

    this.saving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const payload = {
      reportId:        this.reportId,
      name:            this.reportName,
      version:         this.reportVersion,
      exploreId:       1,
      status:          this.status,
      sourceTable:     this.sourceTable,
      granularity:     this.granularity,
      reportingDate:   this.reportingDate,
      timeframeStart:  this.timeframeStart,
      timeframeEnd:    this.computedTimeframeEnd,
      timeframeToday:  this.timeframeMode === 'today',
      quickFilters:    this.quickFiltersList.join(','),
      generalFilters:  JSON.stringify(this.generalFilters),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId:        c.colId,
        label:        c.label,
        colType:      c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN:     c.rollingN,
        formulaExpr:  c.formulaExpr,
        displayOrder: i + 1
      })),
      rows: this.rows.map((r, i) => ({
        rowId:        r.rowId,
        reportId:     this.reportId,
        label:        r.label,
        rowType:      r.rowType,
        source:       this.serializeMeasure(r),
        parentRowId:  r.parentRowId || null,
        style:        r.style || 'normal',
        indentLevel:  r.indentLevel,
        displayOrder: i + 1,
        activeCols:   r.activeCols,
        filterExpr:   this.serializeRowFilters(r)
      }))
    };

    const req$ = this.isNewReport
      ? this.reportService.createReport(payload)
      : this.reportService.saveReport(this.reportId, payload);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Report definition successfully saved!');
        setTimeout(() => this.router.navigate(['/reports', this.reportId]), 1200);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to persist report definition.');
      }
    });
  }

  goBack(): void {
    if (confirm('Discard changes and exit?')) {
      this.router.navigate(this.isNewReport ? ['/dashboard'] : ['/reports', this.reportId]);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    const t = dateStr.trim().toLowerCase();
    if (t === 'today' || t === 'sysdate') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return `${y.length === 2 ? '20' + y : y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) return this.dateOffsetString(0).slice(0, 4) === String(dt.getFullYear())
      ? `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
      : '';
    return '';
  }
}
