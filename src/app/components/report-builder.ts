import { Component, OnInit, signal, computed, effect, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  parseMeasure,
  serializeMeasure,
  parseRowFilterExpr,
  serializeRowFilters,
  formatDateForInput,
  dateOffsetString
} from '../utils/report-parser';

export interface ValidationError {
  elementId: string;
  fieldContext: string;
  errorSeverity: 'CRITICAL' | 'WARNING';
  displayMessage: string;
}

/** Base quick/general filter condition (used on the report header scope). */
interface FilterCondition {
  attribute: string;    // column name (plain for fact, "dim.col" style not used here — dimTable is separate)
  operator: string;
  value: string;
  dimTable?: string;    // empty → fact table; set → dimension view name
}

/** A runtime-exposed filter condition (shown to users at report run time). */
interface QuickFilterCondition {
  dimTable:    string;           // '' = fact table; otherwise dim view name
  attribute:   string;           // column name within that table
  operator:    string;
  value:       string;
  conjunction: 'AND' | 'OR';    // how this condition joins the NEXT one (ignored for last)
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
      <!-- Mobile topbar -->
      <div class="mobile-topbar">
        <button class="hamburger-btn" (click)="toggleSidebar()" aria-label="Toggle navigation">
          <span class="ham-line"></span>
          <span class="ham-line"></span>
          <span class="ham-line"></span>
        </button>
        <span class="topbar-brand">Report Builder</span>
      </div>
      <!-- Sidebar overlay backdrop -->
      <div class="sidebar-overlay" [class.visible]="sidebarOpen()" (click)="closeSidebar()"></div>
      <!-- ════════════════════════════════════════════ SIDEBAR -->
      <aside class="sidebar" [class.open]="sidebarOpen()">
        <button class="sidebar-close-btn" (click)="closeSidebar()" aria-label="Close navigation">✕</button>
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
            <button (click)="previewSql()" class="btn-preview-sql">
              ‹› Preview SQL
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

        <!-- Validation Diagnostics Console -->
        @if (validationErrors().length > 0) {
          <div class="validation-console card animate-fade-in">
            <h3 class="section-title">🛑 Validation Diagnostics ({{ validationErrors().length }} Issues Found)</h3>
            <p class="section-desc">Resolve these logical, formula, or database catalog mismatch errors to ensure query and process safety.</p>
            <div class="diagnostics-grid">
              @for (err of validationErrors(); track err.elementId + '-' + err.fieldContext + '-' + err.displayMessage) {
                <div class="diagnostic-item" [class.critical]="err.errorSeverity === 'CRITICAL'" [class.warning]="err.errorSeverity === 'WARNING'">
                  <span class="item-icon">{{ err.errorSeverity === 'CRITICAL' ? '🛑' : '⚠️' }}</span>
                  <div class="item-body">
                    <strong>{{ err.elementId }}</strong> ({{ err.fieldContext }}): {{ err.displayMessage }}
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- ── Preview Modal ───────────────────────────────────── -->
        @if (showPreview()) {
          <section class="preview-section card animate-fade-in">
            <div class="preview-header-flex">
              <div>
                <h3 class="section-title">📊 Live Layout Preview</h3>
                <p class="section-desc">Molded view of rows and active columns. Formula evaluations run during Phase 2.</p>
              </div>
              <div class="preview-tabs">
                <button 
                  type="button" 
                  class="tab-btn" 
                  [class.active]="activePreviewTab() === 'grid'"
                  (click)="activePreviewTab.set('grid')">
                  ▦ Grid View
                </button>
                <button 
                  type="button" 
                  class="tab-btn" 
                  [class.active]="activePreviewTab() === 'sql'"
                  (click)="activePreviewTab.set('sql')">
                  ‹› SQL Code Preview
                </button>
              </div>
            </div>

            @if (activePreviewTab() === 'grid') {
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
            } @else if (activePreviewTab() === 'sql') {
              <div class="sql-preview-container">
                @if (isLoadingSql()) {
                  <div class="loading-state">
                    <span class="spinner"></span> Loading SQL preview...
                  </div>
                } @else if (compiledSql()) {
                  <pre class="sql-code-block"><code>{{ compiledSql() }}</code></pre>
                } @else {
                  <div class="empty-state">No compiled SQL preview available.</div>
                }
              </div>
            }
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
              @if (availableReportingDates.length > 0) {
                <!-- Populated from dim_date — single date value picker -->
                <select
                  id="reporting-date"
                  [(ngModel)]="reportingDate"
                  class="form-select"
                >
                  <option value="">— select a reporting date —</option>
                  @for (d of availableReportingDates; track d) {
                    <option [value]="d">{{ d }}</option>
                  }
                </select>
                <span class="field-hint">{{ availableReportingDates.length }} dates available in dim_date</span>
              } @else {
                <!-- Fallback while dim_date is still loading -->
                <input
                  type="date"
                  id="reporting-date"
                  [(ngModel)]="reportingDate"
                  class="form-input"
                  title="Type YYYY-MM-DD — dim_date list is loading"
                />
                <span class="field-hint">Loading available dates from dim_date…</span>
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
                      title="Today minus 2 calendar days"
                    >Today − 2</button>
                    <button
                      type="button"
                      class="mode-btn"
                      [class.active]="timeframeMode === 'today_minus_1'"
                      (click)="setTimeframeMode('today_minus_1')"
                      title="Today minus 1 calendar day"
                    >Today − 1</button>
                    <button
                      type="button"
                      class="mode-btn"
                      [class.active]="timeframeMode === 'today'"
                      (click)="setTimeframeMode('today')"
                      title="Today (current date)"
                    >Today</button>
                    <button
                      type="button"
                      class="mode-btn"
                      [class.active]="timeframeMode === 'custom'"
                      (click)="setTimeframeMode('custom')"
                      title="Pick a specific date from dim_date or calendar"
                    >Custom ▾</button>
                  </div>
                  @if (timeframeMode === 'custom') {
                    @if (availableReportingDates.length > 0) {
                      <!-- Single select from dim_date for custom end date -->
                      <select
                        [(ngModel)]="timeframeEnd"
                        class="form-select tf-end-select"
                        title="Select end date from dim_date"
                      >
                        <option value="">— select end date —</option>
                        @for (d of availableReportingDates; track d) {
                          <option [value]="d">{{ d }}</option>
                        }
                      </select>
                    } @else {
                      <!-- Fallback while dim_date is loading -->
                      <input
                        type="date"
                        [(ngModel)]="timeframeEnd"
                        class="form-input tf-end"
                        title="Type YYYY-MM-DD — dim_date list is loading"
                      />
                    }
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

          <!-- ── Quick Filters ──────────────────────────────────────────────── -->
          <div class="form-group filters-builder">
            <div class="flex-header">
              <label>Quick Filters <span class="label-hint">(runtime-exposed filter conditions)</span></label>
              <button (click)="addQuickFilter()" class="add-sub-btn">+ Add Filter Condition</button>
            </div>
            @if (quickFilters.length === 0) {
              <p class="empty-filters">No quick filters configured. Add conditions that users can tune at runtime.</p>
            } @else {
              <div class="filters-list">
                @for (filter of quickFilters; track $index; let idx = $index; let last = $last) {
                  <div class="filter-row animate-fade-in">

                    <!-- Table selector -->
                    <select
                      [(ngModel)]="filter.dimTable"
                      (change)="onQuickFilterTableChange(filter)"
                      class="form-select sm dim-select"
                    >
                      <option value="">{{ sourceTable || 'Fact Table' }}</option>
                      @for (dim of linkedDimensions; track dim) {
                        <option [value]="dim">{{ dim }}</option>
                      }
                    </select>

                    <!-- Column selector -->
                    <select [(ngModel)]="filter.attribute" (change)="filter.value = ''" class="form-select sm">
                      <option value="">-- Column --</option>
                      @for (col of getColumnsForFilterTable(filter.dimTable); track col) {
                        <option [value]="col">{{ col }}</option>
                      }
                    </select>

                    <!-- Operator -->
                    <select [(ngModel)]="filter.operator" class="form-select sm operator">
                      @for (op of operators; track op.value) {
                        <option [value]="op.value">{{ op.label }}</option>
                      }
                    </select>

                    <!-- Value -->
                    <input
                      type="text"
                      [(ngModel)]="filter.value"
                      placeholder="Enter value…"
                      class="form-input sm"
                      [class.invalid-input]="isFilterValueInvalid(filter)"
                      [title]="isFilterValueInvalid(filter) ? 'Value does not match the column type' : ''"
                    />

                    <button (click)="removeQuickFilter(idx)" class="remove-btn" title="Remove condition">✕</button>
                  </div>

                  <!-- AND / OR conjunction between conditions -->
                  @if (!last) {
                    <div class="conjunction-row">
                      <button
                        type="button"
                        class="conj-btn"
                        [class.active]="filter.conjunction === 'AND'"
                        (click)="filter.conjunction = 'AND'"
                      >AND</button>
                      <button
                        type="button"
                        class="conj-btn"
                        [class.active]="filter.conjunction === 'OR'"
                        (click)="filter.conjunction = 'OR'"
                      >OR</button>
                    </div>
                  }
                }
              </div>
            }
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
                    <select [(ngModel)]="filter.attribute" (change)="filter.value = ''" class="form-select sm">
                      <option value="">-- Column --</option>
                      @for (col of getColumnsForFilterTable(filter.dimTable); track col) {
                        <option [value]="col">{{ col }}</option>
                      }
                    </select>

                    <!-- Operator -->
                    <select [(ngModel)]="filter.operator" class="form-select sm operator">
                      @for (op of operators; track op.value) {
                        <option [value]="op.value">{{ op.label }}</option>
                      }
                    </select>

                    <!-- Value -->
                    <input
                      type="text"
                      [(ngModel)]="filter.value"
                      placeholder="Enter value…"
                      class="form-input sm"
                      [class.invalid-input]="isFilterValueInvalid(filter)"
                      [title]="isFilterValueInvalid(filter) ? 'Value does not match the column type' : ''"
                    />

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
                  <tr [class.selected]="row.selected"
                      [class.has-critical]="hasError(row.rowId, 'CRITICAL')"
                      [class.has-warning]="hasError(row.rowId, 'WARNING')"
                      [title]="hasError(row.rowId) ? getErrorMessage(row.rowId) : ''">
                    <td><input type="checkbox" [(ngModel)]="row.selected" /></td>

                    <!-- Row ID -->
                    <td>
                      <div class="row-id-cell">
                        <input type="text" [(ngModel)]="row.rowId" (ngModelChange)="triggerValidationDebounced()" placeholder="R1" class="cell-input center" />
                        @if (hasError(row.rowId, 'CRITICAL')) {
                          <span class="error-badge" [title]="getErrorMessage(row.rowId)">🛑</span>
                        }
                        @if (hasError(row.rowId, 'WARNING')) {
                          <span class="error-badge" [title]="getErrorMessage(row.rowId)">⚠️</span>
                        }
                      </div>
                    </td>

                    <!-- Row Label with indent controls -->
                    <td>
                      <div class="indent-wrapper" [style.padding-left.px]="row.indentLevel * 12">
                        <button (click)="changeIndent(row, -1); triggerValidationDebounced()" class="indent-btn" title="Decrease indent">«</button>
                        <button (click)="changeIndent(row, 1); triggerValidationDebounced()" class="indent-btn" title="Increase indent">»</button>
                        <input type="text" [(ngModel)]="row.label" (ngModelChange)="triggerValidationDebounced()" placeholder="Row Label" class="cell-input" />
                      </div>
                    </td>

                    <!-- Style / Type -->
                    <td>
                      <div class="style-cell">
                        <select [(ngModel)]="row.rowType" (change)="onRowTypeChange(row); triggerValidationDebounced()" class="cell-select">
                          <option value="data">📊 data</option>
                          <option value="calc">🧮 calc</option>
                          <option value="section">📂 section</option>
                          <option value="blank">🫙 blank</option>
                        </select>
                        <select [(ngModel)]="row.style" (ngModelChange)="triggerValidationDebounced()" class="cell-select">
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
                              (ngModelChange)="triggerValidationDebounced()"
                              placeholder="e.g. SUM(amount)"
                              class="cell-input code"
                            />
                            <button
                              (click)="row.customSqlMode = false; triggerValidationDebounced()"
                              class="mode-toggle-btn visual"
                              title="Switch to visual builder"
                            >⬡ Visual</button>
                          </div>
                        } @else {
                          <!-- Visual measure builder -->
                          <div class="measure-builder-row">
                            <select [(ngModel)]="row.measureAgg" (ngModelChange)="triggerValidationDebounced()" class="cell-select agg-select">
                              <option value="SUM">SUM</option>
                              <option value="COUNT">COUNT</option>
                              <option value="COUNT_DISTINCT">COUNT DIST</option>
                              <option value="AVG">AVG</option>
                              <option value="MIN">MIN</option>
                              <option value="MAX">MAX</option>
                            </select>
                            <span class="measure-of">of</span>
                            <select [(ngModel)]="row.measureCol" (ngModelChange)="triggerValidationDebounced()" class="cell-select col-select">
                              <option value="">-- column --</option>
                              @for (col of tableColumns; track col) {
                                <option [value]="col">{{ col }}</option>
                              }
                            </select>
                            <button
                              (click)="row.customSqlMode = true; triggerValidationDebounced()"
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
                          (ngModelChange)="triggerValidationDebounced()"
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
                              <span class="filter-tag-mini" [class.invalid-filter-tag]="isFilterValueInvalid(f)">
                                @if (f.dimTable) {
                                  <span class="ft-dim">{{ f.dimTable }}.</span>
                                }
                                <span class="ft-attr">{{ f.attribute }}</span>
                                <span class="ft-op">{{ getOperatorLabel(f.operator) }}</span>
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
                                  @for (op of operators; track op.value) {
                                    <option [value]="op.value">{{ op.label }}</option>
                                  }
                                </select>

                                <!-- Value with distinct suggestions -->
                                <input
                                  type="text"
                                  [(ngModel)]="pendingRowFilter.value"
                                  placeholder="value…"
                                  list="rfb-val-list"
                                  class="form-input sm rfb-val"
                                  [class.invalid-input]="isFilterValueInvalid(pendingRowFilter)"
                                  [title]="isFilterValueInvalid(pendingRowFilter) ? 'Value does not match the column type' : ''"
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
                  <tr [class.selected]="col.selected"
                      [class.has-critical]="hasError(col.colId, 'CRITICAL')"
                      [class.has-warning]="hasError(col.colId, 'WARNING')"
                      [title]="hasError(col.colId) ? getErrorMessage(col.colId) : ''">
                    <td><input type="checkbox" [(ngModel)]="col.selected" /></td>
                    <td>
                      <div class="row-id-cell">
                        <input type="text" [(ngModel)]="col.colId" (ngModelChange)="triggerValidationDebounced()" placeholder="C1" class="cell-input center" />
                        @if (hasError(col.colId, 'CRITICAL')) {
                          <span class="error-badge" [title]="getErrorMessage(col.colId)">🛑</span>
                        }
                        @if (hasError(col.colId, 'WARNING')) {
                          <span class="error-badge" [title]="getErrorMessage(col.colId)">⚠️</span>
                        }
                      </div>
                    </td>
                    <td>
                      <input type="text" [(ngModel)]="col.label" (ngModelChange)="triggerValidationDebounced()" placeholder="Column Header Label" class="cell-input" />
                    </td>
                    <td>
                      <select [(ngModel)]="col.colType" (ngModelChange)="onColTypeChange(col); triggerValidationDebounced()" class="cell-select">
                        <option value="WEEK">WEEK</option>
                        <option value="MTD">MTD</option>
                        <option value="YTD">YTD</option>
                        <option value="ROLLING">ROLLING</option>
                        <option value="CALC">CALC</option>
                      </select>
                    </td>
                    <td>
                      <select [(ngModel)]="col.headerLayout" (ngModelChange)="triggerValidationDebounced()" class="cell-select">
                        <option value="normal">Normal</option>
                        <option value="bold">Bold, Center</option>
                        <option value="border">Bold, Border</option>
                      </select>
                    </td>
                    <td>
                      <input type="number" [(ngModel)]="col.periodOffset" (ngModelChange)="triggerValidationDebounced()" [disabled]="col.colType === 'CALC'" class="cell-input center" />
                    </td>
                    <td>
                      <input type="number" [(ngModel)]="col.rollingN" (ngModelChange)="triggerValidationDebounced()" [disabled]="col.colType !== 'ROLLING'" placeholder="e.g. 10" class="cell-input center" />
                    </td>
                    <td>
                      <input
                        type="text"
                        [(ngModel)]="col.formulaExpr"
                        (ngModelChange)="triggerValidationDebounced()"
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

        <!-- SQL Preview Modal Overlay -->
        @if (isSqlModalOpen()) {
          <div class="sql-modal-overlay animate-fade-in" (click)="closeSqlModal()">
            <div class="sql-modal-card animate-scale-up" (click)="$event.stopPropagation()">
              <div class="sql-modal-header">
                <div>
                  <h2>‹› Compiled PostgreSQL Query Preview</h2>
                  <p class="modal-subtitle">Dry-run matrix compilation. View query before saving configuration.</p>
                </div>
                <button class="modal-close-btn" (click)="closeSqlModal()">✕</button>
              </div>
              <div class="sql-modal-body">
                @if (isLoadingSql()) {
                  <div class="modal-loading">
                    <span class="spinner"></span>
                    <span>Compiling report matrix query...</span>
                  </div>
                } @else {
                  <div class="sql-viewer-wrapper">
                    <div class="sql-viewer-actions">
                      <span class="file-tag">PGSQL</span>
                      <button (click)="copySqlToClipboard()" class="copy-btn">
                        {{ isCopied() ? '✓ Copied!' : '📋 Copy to Clipboard' }}
                      </button>
                    </div>
                    <pre><code class="language-sql">{{ previewSqlText() }}</code></pre>
                  </div>
                }
              </div>
              <div class="sql-modal-footer">
                <button (click)="closeSqlModal()" class="footer-close-btn">Close Preview</button>
              </div>
            </div>
          </div>
        }

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

    .tf-end-select { min-width: 200px; }

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

    /* ── Quick & General Filters builder ──────────────────── */
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
    .form-select.sm.operator { width: 180px; color: #a5b4fc; font-weight: 600; text-align: center; }

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

    /* AND / OR conjunction row between quick-filter conditions */
    .conjunction-row {
      display: flex;
      align-items: center;
      gap: 0;
      padding: 4px 0 4px 10px;
    }
    .conj-btn {
      padding: 4px 12px;
      background: rgba(15,23,42,0.6);
      border: 1px solid rgba(255,255,255,0.08);
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
      letter-spacing: 0.5px;
    }
    .conj-btn:first-child { border-radius: 6px 0 0 6px; }
    .conj-btn:last-child  { border-radius: 0 6px 6px 0; border-left: none; }
    .conj-btn:hover { background: rgba(99,102,241,0.1); color: #c7d2fe; }
    .conj-btn.active {
      background: rgba(99,102,241,0.22);
      color: #a5b4fc;
      border-color: rgba(99,102,241,0.4);
    }

    /* ── Filter row (shared by Quick Filters & General Filters) ── */
    .filters-builder { }

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
    .rfb-op    { flex: 0 0 180px; color: #a5b4fc; font-weight: 600; }
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
    .form-input.invalid-input { border-color: #ef4444 !important; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important; }
    .invalid-filter-tag { background: rgba(239, 68, 68, 0.15) !important; border-color: rgba(239, 68, 68, 0.3) !important; color: #fca5a5 !important; }

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

    /* ═══════════════ MOBILE RESPONSIVE ═══════════════ */

    .mobile-topbar {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 200;
      height: 60px;
      background: rgba(15, 23, 42, 0.97);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      align-items: center;
      padding: 0 16px;
      gap: 14px;
    }

    .topbar-brand {
      font-size: 17px;
      font-weight: 700;
      background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hamburger-btn {
      display: flex;
      flex-direction: column;
      gap: 5px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background 0.2s ease;
    }
    .hamburger-btn:hover { background: rgba(255, 255, 255, 0.08); }

    .ham-line {
      display: block;
      width: 22px;
      height: 2px;
      background: #f8fafc;
      border-radius: 2px;
    }

    .sidebar-close-btn {
      display: none;
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #f8fafc;
      font-size: 14px;
      width: 32px;
      height: 32px;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      z-index: 10;
    }
    .sidebar-close-btn:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }

    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 149;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    .sidebar-overlay.visible { display: block; }

    @media (max-width: 1023px) {
      .mobile-topbar { display: flex; }
      .sidebar-close-btn { display: flex; }

      .sidebar {
        position: fixed;
        top: 0; left: 0;
        height: 100%;
        width: 280px;
        z-index: 150;
        transform: translateX(-100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
      }
      .sidebar.open {
        transform: translateX(0);
        box-shadow: 4px 0 32px rgba(0, 0, 0, 0.5);
      }

      .main-content {
        padding: 80px 20px 32px 20px;
        max-width: 100vw;
      }

      .detail-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
      .action-buttons {
        flex-wrap: wrap;
        gap: 10px;
        width: 100%;
      }
      .preview-btn, .save-btn {
        flex: 1;
        justify-content: center;
        min-width: 130px;
      }
    }

    @media (max-width: 767px) {
      .main-content {
        padding: 76px 12px 24px 12px;
        max-width: 100vw;
      }
      .card {
        padding: 20px 16px;
      }
      h1 {
        font-size: 22px;
      }
    }

    /* Validation & Linting Engine Styles */
    .has-critical {
      border-left: 4px solid #ef4444 !important;
      background-color: rgba(239, 68, 68, 0.04) !important;
    }
    .has-warning {
      border-left: 4px solid #f59e0b !important;
      background-color: rgba(245, 158, 11, 0.03) !important;
    }
    .row-id-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      position: relative;
    }
    .error-badge {
      font-size: 14px;
      cursor: help;
      user-select: none;
    }
    .validation-console {
      margin-bottom: 24px;
      border: 1px solid rgba(239, 68, 68, 0.2);
      background: rgba(15, 23, 42, 0.6) !important;
    }
    .diagnostics-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
      padding-right: 8px;
      margin-top: 12px;
    }
    .diagnostic-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
      background: rgba(255, 255, 255, 0.02);
      border-left: 3px solid transparent;
    }
    .diagnostic-item.critical {
      border-left-color: #ef4444;
      background: rgba(239, 68, 68, 0.05);
      color: #fca5a5;
    }
    .diagnostic-item.warning {
      border-left-color: #f59e0b;
      background: rgba(245, 158, 11, 0.04);
      color: #fde047;
    }
    .item-icon {
      font-size: 15px;
    }
    .item-body {
      flex: 1;
    }

    /* Live SQL Preview Styles */
    .preview-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 8px;
    }
    .preview-tabs {
      display: flex;
      gap: 8px;
      margin: 8px 0;
      background: rgba(15, 23, 42, 0.4);
      padding: 4px;
      border-radius: 10px;
      width: fit-content;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .tab-btn {
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tab-btn:hover {
      color: #f1f5f9;
      background: rgba(255, 255, 255, 0.02);
    }
    .tab-btn.active {
      background: #1e293b;
      color: #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .sql-preview-container {
      background: #0f172a;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 20px;
      margin-top: 12px;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    .sql-code-block {
      margin: 0;
      font-family: 'Fira Code', 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.6;
      max-height: 450px;
      overflow-y: auto;
      overflow-x: auto;
      white-space: pre;
    }
    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #94a3b8;
      font-size: 14px;
      padding: 40px 0;
    }
    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* SQL Preview Modal Overlay */
    .sql-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .sql-modal-card {
      width: 90%;
      max-width: 900px;
      max-height: 85vh;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .sql-modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sql-modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #f8fafc;
    }
    .modal-subtitle {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: #94a3b8;
    }
    .modal-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    .modal-close-btn:hover {
      color: #f1f5f9;
      background: rgba(255, 255, 255, 0.05);
    }
    .sql-modal-body {
      padding: 24px;
      flex: 1;
      overflow-y: auto;
    }
    .modal-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 80px 0;
      color: #94a3b8;
      font-size: 14px;
    }
    .sql-viewer-wrapper {
      display: flex;
      flex-direction: column;
      background: #0f172a;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      overflow: hidden;
    }
    .sql-viewer-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: rgba(15, 23, 42, 0.6);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .file-tag {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #6366f1;
      background: rgba(99, 102, 241, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .copy-btn {
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      color: #cbd5e1;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #f1f5f9;
    }
    .sql-viewer-wrapper pre {
      margin: 0;
      padding: 16px 20px;
      overflow-x: auto;
      max-height: 400px;
    }
    .sql-viewer-wrapper code {
      font-family: 'Fira Code', 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.6;
      white-space: pre;
    }
    .sql-modal-footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: flex-end;
      background: rgba(30, 41, 59, 0.5);
    }
    .footer-close-btn {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 600;
      color: #cbd5e1;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .footer-close-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #f1f5f9;
    }
    .btn-preview-sql {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    .btn-preview-sql:hover {
      background: rgba(56, 189, 248, 0.2);
      border-color: rgba(56, 189, 248, 0.4);
    }
    .btn-preview-sql:active {
      transform: scale(0.98);
    }
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out;
    }
    .animate-scale-up {
      animation: scaleUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ReportBuilderComponent implements OnInit {
  isNewReport = true;
  saving        = signal(false);
  showPreview   = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage   = signal<string | null>(null);
  sidebarOpen    = signal(false);

  // SQL Preview State
  activePreviewTab = signal<'grid' | 'sql'>('grid');
  compiledSql      = signal<string>('');
  isLoadingSql     = signal<boolean>(false);
  isSqlModalOpen   = signal<boolean>(false);
  previewSqlText   = signal<string>('');
  isCopied         = signal<boolean>(false);

  validationErrors = signal<ValidationError[]>([]);
  isValid = computed(() => !this.validationErrors().some(e => e.errorSeverity === 'CRITICAL'));
  
  hasError(elementId: string, severity?: 'CRITICAL' | 'WARNING'): boolean {
    return this.validationErrors().some(e => 
      e.elementId.toUpperCase() === elementId.toUpperCase() && 
      (!severity || e.errorSeverity === severity)
    );
  }

  getErrorMessage(elementId: string): string {
    return this.validationErrors()
      .filter(e => e.elementId.toUpperCase() === elementId.toUpperCase())
      .map(e => `[${e.errorSeverity}] ${e.displayMessage}`)
      .join('\n');
  }

  private validationTimeout: any;

  triggerValidationDebounced(): void {
    if (this.validationTimeout) {
      clearTimeout(this.validationTimeout);
    }
    this.validationTimeout = setTimeout(() => {
      this.runValidation();
      if (this.activePreviewTab() === 'sql' && this.showPreview()) {
        this.runSqlPreview();
      }
    }, 450);
  }

  runValidation(): void {
    if (!this.reportId) return;
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
      quickFilters:    JSON.stringify(this.quickFilters),
      generalFilters:  JSON.stringify(this.generalFilters),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId:        c.colId,
        label:        c.label,
        colType:      c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN:     c.colType === 'ROLLING' ? c.rollingN : null,
        formulaExpr:  c.colType === 'CALC' ? c.formulaExpr : '',
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

    this.reportService.validateReport(payload).subscribe({
      next: (res: any) => {
        this.validationErrors.set(res.errors || []);
      },
      error: (err) => {
        console.warn('Asynchronous validation call failed:', err);
      }
    });
  }

  runSqlPreview(): void {
    if (!this.reportId) {
      this.compiledSql.set('');
      return;
    }
    this.isLoadingSql.set(true);
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
      quickFilters:    JSON.stringify(this.quickFilters),
      generalFilters:  JSON.stringify(this.generalFilters),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId:        c.colId,
        label:        c.label,
        colType:      c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN:     c.colType === 'ROLLING' ? c.rollingN : null,
        formulaExpr:  c.colType === 'CALC' ? c.formulaExpr : '',
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

    this.reportService.previewSql(payload).subscribe({
      next: (res: any) => {
        this.compiledSql.set(res.sql || '');
        this.isLoadingSql.set(false);
      },
      error: (err: any) => {
        console.warn('SQL preview generation failed:', err);
        this.compiledSql.set(err.error?.error || 'Failed to compile SQL preview.');
        this.isLoadingSql.set(false);
      }
    });
  }

  previewSql(): void {
    if (!this.reportId) {
      this.previewSqlText.set('No Report ID specified.');
      return;
    }
    this.isSqlModalOpen.set(true);
    this.isLoadingSql.set(true);
    this.previewSqlText.set('');

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
      quickFilters:    JSON.stringify(this.quickFilters),
      generalFilters:  JSON.stringify(this.generalFilters),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId:        c.colId,
        label:        c.label,
        colType:      c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN:     c.colType === 'ROLLING' ? c.rollingN : null,
        formulaExpr:  c.colType === 'CALC' ? c.formulaExpr : '',
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

    this.reportService.previewSql(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.previewSqlText.set(res.sql || '');
          this.isLoadingSql.set(false);
        },
        error: (err: any) => {
          console.warn('SQL preview generation failed:', err);
          this.previewSqlText.set(err.error?.error || 'Failed to compile SQL preview.');
          this.isLoadingSql.set(false);
        }
      });
  }

  closeSqlModal(): void {
    this.isSqlModalOpen.set(false);
  }

  copySqlToClipboard(): Promise<void> | void {
    const sqlText = this.previewSqlText();
    if (sqlText) {
      return navigator.clipboard.writeText(sqlText).then(() => {
        this.isCopied.set(true);
        setTimeout(() => this.isCopied.set(false), 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    }
  }

  // ── DB Metadata ─────────────────────────────────────────────────────────
  dbTables: string[]     = [];
  tableColumns: string[] = [];
  distinctValues: { [key: string]: string[] } = {};

  // ── Dimension joins & linked dimensions ─────────────────────────────────
  dimensionJoins: any[]  = [];          // all joins available for the selected fact table
  linkedDimensions: string[] = [];       // user-selected dim views to activate
  dimensionColumnsCache: { [dimView: string]: string[] } = {};
  columnTypesCache: { [tableName: string]: { [columnName: string]: string } } = {};
  loadingDimJoins = false;

  // ── Reporting date ───────────────────────────────────────────────────────
  reportingDate = '';  // default applied at runtime in initializeDefaultCatalog / applyReportConfig
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
  timeframeMode: 'custom' | 'today_minus_2' | 'today_minus_1' | 'today' = 'today_minus_2';
  quickFilters: QuickFilterCondition[] = [];
  generalFilters: FilterCondition[]     = [];

  // ── Operators list ───────────────────────────────────────────────────────
  readonly operators = [
    { value: '=', label: 'is' },
    { value: 'is not', label: 'is not' },
    { value: 'like', label: 'contains' },
    { value: 'not like', label: 'does not contains' },
    { value: 'starts with', label: 'start with' },
    { value: 'ends with', label: 'end with' },
    { value: 'is blank', label: 'is blank' },
    { value: 'is not blank', label: 'is not blank' },
    { value: 'is null', label: 'is null' },
    { value: 'is not null', label: 'is not null' },
    { value: 'in', label: 'in' },
    { value: '!=', label: 'is different from' },
    { value: '>', label: 'is greater then' },
    { value: '>=', label: 'is greater or equal' },
    { value: '<', label: 'is less then' },
    { value: '<=', label: 'is less or equal' }
  ];

  getOperatorLabel(op: string): string {
    const found = this.operators.find(o => o.value === op);
    if (found) return found.label;
    if (op === 'is') return 'is';
    if (op === 'contains') return 'contains';
    if (op === 'does not contains') return 'does not contains';
    if (op === 'start with') return 'start with';
    if (op === 'end with') return 'end with';
    return op;
  }

  normalizeFilterOperator(op: string): string {
    if (!op) return '=';
    const clean = op.trim().toLowerCase();
    if (clean === 'is') return '=';
    if (clean === 'contains') return 'like';
    if (clean === 'does not contains' || clean === 'does not contain') return 'not like';
    if (clean === 'start with') return 'starts with';
    if (clean === 'end with') return 'ends with';
    return op;
  }

  // ── Row filter builder state ─────────────────────────────────────────────
  activeRowFilterId = '';
  pendingRowFilter: RowFilterCondition = { dimTable: '', attribute: '', operator: '=', value: '' };
  pendingRowFilterValues: string[]     = [];
  pendingFilterColumns: string[]       = [];

  // ── Rows and Columns Data Models ─────────────────────────────────────────
  rows: any[]    = [];
  columns: any[] = [];

  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private reportService = inject(ReportService);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    try {
      effect(() => {
        if (this.activePreviewTab() === 'sql' && this.showPreview()) {
          this.runSqlPreview();
        }
      }, { allowSignalWrites: true });
    } catch (e) {
      console.warn('Reactivity/Effect context not available. Skipping effect creation.', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  get computedTimeframeEnd(): string {
    if (this.timeframeMode === 'today')         return this.dateOffsetString(0);
    if (this.timeframeMode === 'today_minus_1') return this.dateOffsetString(-1);
    if (this.timeframeMode === 'today_minus_2') return this.dateOffsetString(-2);
    return this.timeframeEnd;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.loadReportingDates();

    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((params) => {
      const id = params['id'];
      if (id && id !== 'new') {
        this.isNewReport = false;
        this.reportId = id;
        // Fire both fetches in parallel — total wait = max(t_tables, t_config)
        forkJoin({
          tables: this.reportService.getTables(),
          config: this.reportService.getReportConfig(id, '2025-12-31')
        }).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: ({ tables, config }) => {
            this.dbTables = tables;
            this.applyReportConfig(config);
          },
          error: () => this.errorMessage.set('Failed to load report definition details.')
        });
      } else {
        this.isNewReport = true;
        this.reportService.getTables().pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
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
    this.reportingDate = data.reportingDate || this.dateOffsetString(-1);

    // Timeframe — restore relative mode or custom date
    const offset: number | null = data.timeframeTodayOffset ?? null;
    if (offset === 0) {
      this.timeframeMode = 'today';
    } else if (offset === -1) {
      this.timeframeMode = 'today_minus_1';
    } else if (offset === -2 || data.timeframeToday === false && !data.timeframeEnd) {
      this.timeframeMode = 'today_minus_2';
    } else if (data.timeframeToday) {
      // backward-compat: old boolean flag → today
      this.timeframeMode = 'today';
    } else {
      this.timeframeMode = 'custom';
      this.timeframeEnd  = this.formatDateForInput(data.timeframeEnd || '');
    }
    this.timeframeStart = this.formatDateForInput(data.timeframeStart || '2022-01-01');

    // Quick filters — try JSON first (new format), fall back from old CSV column-list
    try {
      this.quickFilters = data.quickFilters ? JSON.parse(data.quickFilters) : [];
      if (!Array.isArray(this.quickFilters)) this.quickFilters = [];
      this.quickFilters.forEach(f => f.operator = this.normalizeFilterOperator(f.operator));
    } catch {
      // Legacy: comma-separated column names — convert to stub conditions with no value
      this.quickFilters = data.quickFilters
        ? data.quickFilters.split(',').filter(Boolean).map((col: string) => ({
            dimTable:    '',
            attribute:   col.includes('.') ? col.split('.')[1] : col,
            operator:    '=',
            value:       '',
            conjunction: 'AND' as const
          }))
        : [];
    }

    try {
      this.generalFilters = data.generalFilters ? JSON.parse(data.generalFilters) : [];
      this.generalFilters.forEach(f => f.operator = this.normalizeFilterOperator(f.operator));
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
      const measure         = this.parseMeasure(r.source);
      const { rowFilters, legacyFilterExpr } = this.parseRowFilterExpr(r.filterExpr || '');
      rowFilters.forEach(f => f.operator = this.normalizeFilterOperator(f.operator));
      
      let sourceStr = '';
      if (typeof r.source === 'string') {
        sourceStr = r.source;
      } else if (r.source && typeof r.source === 'object') {
        sourceStr = r.source.rawSql || '';
      }

      return {
        rowId:           r.rowId,
        label:           r.label,
        rowType:         r.rowType,
        source:          sourceStr,
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
    this.runValidation();
  }

  initializeDefaultCatalog(): void {
    this.reportId      = '';
    this.reportName    = '';
    this.reportVersion = 1;
    this.sourceTable   = '';
    this.granularity   = '';
    this.reportingDate = this.dateOffsetString(-1);
    this.timeframeStart = '2022-01-01';
    this.timeframeMode  = 'today_minus_2';
    this.timeframeEnd   = this.dateOffsetString(-2);
    this.quickFilters     = [];
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
    this.runValidation();
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
    this.reportService.getTableColumns(table).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (cols) => { this.tableColumns = cols; }
    });

    this.reportService.getColumnTypes(table).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (types) => { this.columnTypesCache = { ...this.columnTypesCache, [table]: types }; }
    });
  }

  loadDimensionJoins(factTable: string): void {
    this.loadingDimJoins = true;
    this.dimensionJoins  = [];
    this.reportService.getDimensionJoins(factTable).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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
    this.reportService.getTableColumns(dimView).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (cols) => { this.dimensionColumnsCache = { ...this.dimensionColumnsCache, [dimView]: cols }; }
    });

    this.reportService.getColumnTypes(dimView).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (types) => { this.columnTypesCache = { ...this.columnTypesCache, [dimView]: types }; }
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

  setTimeframeMode(mode: 'custom' | 'today_minus_2' | 'today_minus_1' | 'today'): void {
    this.timeframeMode = mode;
    if (mode === 'today_minus_2') this.timeframeEnd = this.dateOffsetString(-2);
    if (mode === 'today_minus_1') this.timeframeEnd = this.dateOffsetString(-1);
    if (mode === 'today')         this.timeframeEnd = this.dateOffsetString(0);
    // 'custom' leaves timeframeEnd as-is for the user to pick
  }

  private todayString(): string      { return this.dateOffsetString(0); }
  private dateOffsetString(n: number): string {
    return dateOffsetString(n);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTING DATE
  // ═══════════════════════════════════════════════════════════════════════════

  loadReportingDates(): void {
    this.reportService.getReportingDates().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (dates) => { this.availableReportingDates = dates || []; },
      error: () => { /* fail silently — user can still type a date */ }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  addQuickFilter(): void {
    this.quickFilters.push({ dimTable: '', attribute: '', operator: '=', value: '', conjunction: 'AND' });
  }

  removeQuickFilter(index: number): void {
    this.quickFilters.splice(index, 1);
  }

  onQuickFilterTableChange(filter: QuickFilterCondition): void {
    filter.attribute = '';
    filter.value     = '';
  }



  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAL FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  addGeneralFilter(): void {
    this.generalFilters.push({ attribute: '', operator: '=', value: '', dimTable: '' });
  }

  removeGeneralFilter(index: number): void {
    this.generalFilters.splice(index, 1);
  }

  onGeneralFilterTableChange(filter: FilterCondition): void {
    filter.attribute = '';
    filter.value     = '';
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
    this.pendingRowFilter.value = '';
    const table = this.pendingRowFilter.dimTable || this.sourceTable;
    const attr  = this.pendingRowFilter.attribute;
    if (!table || !attr) return;
    const key = `${table}.${attr}`;
    if (this.distinctValues[key]) {
      this.pendingRowFilterValues = this.distinctValues[key];
      return;
    }
    this.reportService.getDistinctValues(table, attr).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (vals) => {
        this.distinctValues = { ...this.distinctValues, [key]: vals };
        this.pendingRowFilterValues = vals;
      }
    });
  }

  confirmRowFilter(row: any): void {
    if (!this.pendingRowFilter.attribute) return;

    const table = this.pendingRowFilter.dimTable || this.sourceTable;
    const colTypes = this.columnTypesCache[table];
    if (colTypes && this.pendingRowFilter.value && this.pendingRowFilter.value.trim() !== '') {
      const type = colTypes[this.pendingRowFilter.attribute];
      if (type && !this.validateFilterValue(type, this.pendingRowFilter.value)) {
        alert(`Validation failed: Value "${this.pendingRowFilter.value}" is not valid for column "${this.pendingRowFilter.attribute}" of type "${type}" in table "${table}".`);
        return;
      }
    }

    if (!row.rowFilters) row.rowFilters = [];
    row.rowFilters.push({ ...this.pendingRowFilter });
    this.cancelRowFilter();
  }

  validateFilterValue(type: string, value: string): boolean {
    if (!type) return true;
    const lowerType = type.toLowerCase();
    const trimmed = value.trim();

    if (lowerType.includes('int') && !lowerType.includes('interval')) {
      return /^[+-]?\d+$/.test(trimmed);
    }

    if (
      lowerType.includes('numeric') ||
      lowerType.includes('decimal') ||
      lowerType.includes('real') ||
      lowerType.includes('double') ||
      lowerType.includes('float')
    ) {
      if (trimmed === '') return false;
      const num = Number(trimmed);
      return !isNaN(num) && isFinite(num);
    }

    if (lowerType === 'boolean' || lowerType === 'bool') {
      const v = trimmed.toLowerCase();
      return v === 'true' || v === 'false' || v === '1' || v === '0';
    }

    if (lowerType.includes('date') || lowerType.includes('timestamp') || lowerType.includes('time')) {
      if (trimmed === '') return false;
      const timestamp = Date.parse(trimmed);
      if (isNaN(timestamp)) return false;
      if (/^\d+$/.test(trimmed) && trimmed.length < 4) return false;
      return true;
    }

    return true;
  }

  isFilterValueInvalid(filter: any): boolean {
    if (!filter.attribute || !filter.value || filter.value.trim() === '') return false;
    const table = filter.dimTable || this.sourceTable;
    const colTypes = this.columnTypesCache[table];
    if (!colTypes) return false;
    const type = colTypes[filter.attribute];
    if (!type) return false;
    return !this.validateFilterValue(type, filter.value);
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

  private parseMeasure(source: any): { aggFunction: string; measureCol: string; customSqlMode: boolean } {
    return parseMeasure(source);
  }

  private parseRowFilterExpr(filterExpr: string): { rowFilters: RowFilterCondition[]; legacyFilterExpr: string } {
    return parseRowFilterExpr(filterExpr);
  }

  private serializeMeasure(row: any): any {
    return serializeMeasure(row);
  }

  private serializeRowFilters(row: any): string {
    return serializeRowFilters(row);
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

  onColTypeChange(col: any): void {
    if (col.colType !== 'ROLLING') {
      col.rollingN = null;
    }
    if (col.colType !== 'CALC') {
      col.formulaExpr = '';
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

    // Validate quick filters
    for (const filter of this.quickFilters) {
      if (filter.attribute && filter.value && filter.value.trim() !== '') {
        const table = filter.dimTable || this.sourceTable;
        const colTypes = this.columnTypesCache[table];
        if (colTypes) {
          const type = colTypes[filter.attribute];
          if (type && !this.validateFilterValue(type, filter.value)) {
            this.errorMessage.set(`Validation failed: Value "${filter.value}" is not valid for column "${filter.attribute}" of type "${type}" in table "${table}".`);
            return;
          }
        }
      }
    }

    // Validate general filters
    for (const filter of this.generalFilters) {
      if (filter.attribute && filter.value && filter.value.trim() !== '') {
        const table = filter.dimTable || this.sourceTable;
        const colTypes = this.columnTypesCache[table];
        if (colTypes) {
          const type = colTypes[filter.attribute];
          if (type && !this.validateFilterValue(type, filter.value)) {
            this.errorMessage.set(`Validation failed: Value "${filter.value}" is not valid for column "${filter.attribute}" of type "${type}" in table "${table}".`);
            return;
          }
        }
      }
    }

    // Validate row filters
    for (const row of this.rows) {
      if (row.rowFilters) {
        for (const filter of row.rowFilters) {
          if (filter.attribute && filter.value && filter.value.trim() !== '') {
            const table = filter.dimTable || this.sourceTable;
            const colTypes = this.columnTypesCache[table];
            if (colTypes) {
              const type = colTypes[filter.attribute];
              if (type && !this.validateFilterValue(type, filter.value)) {
                this.errorMessage.set(`Validation failed: Value "${filter.value}" is not valid for column "${filter.attribute}" of type "${type}" in row "${row.label || row.rowId}".`);
                return;
              }
            }
          }
        }
      }
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
      // Relative offset: 0=today, -1=today-1, -2=today-2, null=custom absolute date
      timeframeTodayOffset: this.timeframeMode === 'today'         ?  0
                          : this.timeframeMode === 'today_minus_1' ? -1
                          : this.timeframeMode === 'today_minus_2' ? -2
                          : null,
      timeframeToday:  this.timeframeMode === 'today', // backward-compat
      quickFilters:    JSON.stringify(this.quickFilters),
      generalFilters:  JSON.stringify(this.generalFilters),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId:        c.colId,
        label:        c.label,
        colType:      c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN:     c.colType === 'ROLLING' ? c.rollingN : null,
        formulaExpr:  c.colType === 'CALC' ? c.formulaExpr : '',
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

    req$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  closeSidebar(): void { this.sidebarOpen.set(false); }

  goBack(): void {
    if (confirm('Discard changes and exit?')) {
      this.router.navigate(this.isNewReport ? ['/dashboard'] : ['/reports', this.reportId]);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  formatDateForInput(dateStr: string): string {
    return formatDateForInput(dateStr, () => this.dateOffsetString(0));
  }
}
