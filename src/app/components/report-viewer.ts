import { Component, OnInit, signal, computed, inject, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { DateFormatter } from '../utils/date-formatter';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './sidebar';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SidebarComponent],
  template: `
    <div class="builder-container">
      <!-- Mobile topbar -->
      <div class="mobile-topbar">
        <button class="hamburger-btn" (click)="toggleSidebar()" aria-label="Toggle navigation">
          <span class="ham-line"></span>
          <span class="ham-line"></span>
          <span class="ham-line"></span>
        </button>
        <span class="topbar-brand">Reports Execution Hub</span>
      </div>
      <app-sidebar
        brandIcon="analytics-grid"
        brandText="Execution Hub"
        [showUser]="true"
        [mobileOpen]="sidebarOpen()"
        (mobileOpenChange)="sidebarOpen.set($event)"
      ></app-sidebar>

      <!-- ══════════════════════════════════════════ MAIN CONTENT -->
      <main class="main-content animate-fade-in">
        <header class="detail-header">
          <div>
            <div class="breadcrumbs">
              <a routerLink="/dashboard">Reports</a> / <span>Execution Hub</span>
            </div>
            <h1>📈 Reports Execution Hub</h1>
            <p class="report-subtitle">
              Configure parameters, run queries, and review calculated data grids.
            </p>
          </div>
        </header>

        <!-- Split-Pane Workspace Dashboard Explorer Layout -->
        <div class="workspace-split-pane">
          <!-- Left Nav Explorer Sidebar (w-[320px]) -->
          <aside class="explorer-sidebar">
            <div class="search-container">
              <input
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                placeholder="🔍 Search templates..."
                class="form-input text-sm bg-slate-50 border-slate-200 focus:border-indigo-500 rounded-lg p-2.5 w-full text-slate-800 placeholder-slate-400"
              />
            </div>

            <div class="explorer-list">
              @for (rep of filteredReports(); track rep.reportId) {
                <div
                  (click)="onReportSelected(rep.reportId)"
                  [class.active-light-explorer-row]="selectedReportId() === rep.reportId"
                  class="explorer-row group"
                >
                  <div class="flex flex-col gap-1">
                    <span class="report-code font-mono font-bold text-slate-400 group-hover:text-indigo-600">{{ rep.reportId }}</span>
                    <span class="report-name-text font-bold text-slate-700 group-hover:text-slate-900">{{ rep.name }}</span>
                  </div>
                  <span class="status-badge-explorer" [class]="rep.status || 'draft'">
                    {{ rep.status || 'draft' }}
                  </span>
                </div>
              } @empty {
                <div class="text-center text-xs text-slate-400 py-8 font-mono">No templates found</div>
              }
            </div>
          </aside>

          <!-- Right Active Canvas Workspace -->
          <div class="workspace-active-canvas">
            @if (selectedReportId()) {
              <!-- Active Report Header Area -->
              <div class="active-report-meta-header">
                <div>
                  <h2 class="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2" style="margin:0;">
                    <span>📊 {{ reportName() }}</span>
                    <span class="report-code font-mono text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100" style="margin-left: 8px;">{{ selectedReportId() }}</span>
                  </h2>
                </div>
                <div class="status-badge-explorer" [class]="reportConfig()?.status || 'draft'">
                  {{ reportConfig()?.status || 'draft' }}
                </div>
              </div>

              <!-- Horizontal Parameter Bar inside Canvas -->
              <div class="horizontal-parameter-bar">
                <!-- Custom Date Picker Popover Widget -->
                <div class="calendar-picker-container">
                  <label class="text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-1.5 block">Reporting Date</label>
                  <button 
                    type="button"
                    class="calendar-trigger-btn font-mono"
                    (click)="toggleCalendarPopover($event)"
                  >
                    <span>📅 {{ selectedReportingDate() || 'Select Date' }}</span>
                    <span class="text-[9px] text-slate-400">▼</span>
                  </button>
                  
                  @if (isCalendarOpen()) {
                    <div class="calendar-popover-panel">
                      <!-- Calendar Header -->
                      <div class="calendar-popover-header">
                        <button type="button" class="month-nav-btn" (click)="prevMonth()">◀</button>
                        <span class="calendar-month-year">{{ getMonthName(calendarMonth()) }} {{ calendarYear() }}</span>
                        <button type="button" class="month-nav-btn" (click)="nextMonth()">▶</button>
                      </div>
                      
                      <!-- Weekday headers -->
                      <div class="calendar-weekdays">
                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                      </div>
                      
                      <!-- Day cells -->
                      <div class="calendar-days">
                        @for (cell of calendarCells(); track $index) {
                          @if (cell.dayNum) {
                            <button
                              type="button"
                              [disabled]="!cell.isAvailable"
                              [class.day-available]="cell.isAvailable"
                              [class.day-selected]="cell.isSelected"
                              [class.day-unavailable]="!cell.isAvailable"
                              class="day-cell"
                              (click)="selectCalendarDate(cell.dateStr)"
                            >
                              {{ cell.dayNum }}
                            </button>
                          } @else {
                            <span class="day-cell empty-cell"></span>
                          }
                        }
                      </div>
                      
                      <!-- Popover Footer -->
                      <div class="calendar-footer">
                        <span style="display: flex; align-items: center; gap: 4px;">
                          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span> Available
                        </span>
                        <button type="button" class="hover:text-indigo-600 font-bold text-slate-500" style="background:none; border:none; cursor:pointer; font-size:9px;" (click)="isCalendarOpen.set(false)">Close</button>
                      </div>
                    </div>
                  }
                </div>

                <!-- Quick Filters Runtime Inputs -->
                @for (filter of runtimeQuickFilters(); track filter.tableColumn) {
                  <div class="form-group">
                    <label class="text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-1.5 block">
                      {{ filter.dimTable ? filter.dimTable + '.' : '' }}{{ filter.attribute }} ({{ filter.operator }})
                    </label>

                    @if (filter.options.length > 0) {
                      <select [(ngModel)]="filter.value" class="form-select font-mono text-xs bg-white border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 max-w-[180px]">
                        <option value="">-- All Values --</option>
                        @for (opt of filter.options; track opt) {
                          <option [value]="opt">{{ opt }}</option>
                        }
                      </select>
                    } @else {
                      <input
                        type="text"
                        [(ngModel)]="filter.value"
                        placeholder="Enter filter value..."
                        class="form-input text-xs bg-white border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 max-w-[180px]"
                      />
                    }
                  </div>
                }

                <!-- Run execution button -->
                <button
                  (click)="runExecution()"
                  [disabled]="executing() || !selectedReportingDate()"
                  class="run-report-btn"
                  style="margin: 0; min-height: 38px; width: auto; padding: 10px 24px;"
                >
                  @if (executing()) {
                    <span class="spinner"></span> Executing...
                  } @else {
                    <span>⚡ Run Report</span>
                  }
                </button>
              </div>

              <!-- Canvas Workspace Container -->
              <div class="immersive-data-canvas">
                <!-- Execution Error Alert -->
                @if (executionError()) {
                  <div class="alert error-alert animate-fade-in mb-4">
                    <span class="alert-icon">🛑</span>
                    <span>{{ executionError() }}</span>
                  </div>
                }

                <!-- When Idle (No data executed yet) -->
                @if (!executedData() && !executing()) {
                  <div class="idle-placeholder">
                    <span class="placeholder-icon">📈</span>
                    <h3 class="placeholder-title">Ready for Execution</h3>
                    <p class="placeholder-desc">Configure the reporting parameters in the top bar and execute the queries.</p>
                  </div>
                }

                <!-- When Executing (Loading/Spinner) -->
                @if (executing()) {
                  <div class="loading-state-canvas">
                    <span class="spinner border-4 w-12 h-12 mb-4" style="border-top-color: #4f46e5;"></span>
                    <h3 class="loading-title">Running Queries</h3>
                    <p class="loading-desc">Compiling SQL matrices and evaluating formulas...</p>
                  </div>
                }

                <!-- When Executed -->
                @if (executedData() && !executing()) {
                  <div class="executed-workspace card animate-fade-in">
                    <!-- Header bar -->
                    <div class="workspace-header-bar mb-4 pb-4">
                      <div>
                        <h3 class="section-title text-[10px] tracking-wider uppercase font-bold text-slate-400">📊 Publication-Ready Data Grid</h3>
                        <p class="section-subtitle font-mono text-[11px] text-slate-500 mt-1">Compiled matrix for {{ reportName() }}</p>
                      </div>
                      <button (click)="exportToCsv()" class="export-csv-btn">
                        <span>📥 Export CSV</span>
                      </button>
                    </div>

                    <!-- Spreadsheet Grid -->
                    <div class="table-wrapper rows-table-wrapper max-w-full overflow-auto">
                      <table class="spreadsheet-table w-full border-collapse">
                        <thead>
                          <tr>
                            <th class="sticky-col px-4 py-3 text-left">Label</th>
                            <th class="px-4 py-3 text-left">ID</th>
                            <th class="px-4 py-3 text-left">Type</th>
                            @for (col of expandedColumns(); track col.colId) {
                              <th class="col-flag-header px-4 py-3 text-center border-l border-slate-200">
                                <div class="font-mono text-indigo-600">{{ col.colId }}</div>
                                <div class="preview-col-label">{{ col.label }}</div>
                              </th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of rows(); track row.rowId) {
                            <tr
                              [class]="'row-style-' + (row.style || 'normal').toLowerCase()"
                              class="hover:bg-slate-50 transition-colors"
                            >
                              <td
                                class="sticky-col label-cell px-4 py-3"
                                [style.padding-left.px]="16 + row.indentLevel * 16"
                              >
                                @if (
                                  row.rowType === 'section' ||
                                  row.style?.toLowerCase() === 'section' ||
                                  row.style?.toLowerCase() === 'header'
                                ) {
                                  📂 <strong>{{ row.label }}</strong>
                                } @else if (row.rowType === 'calc') {
                                  🧮 <strong>{{ row.label }}</strong>
                                } @else if (row.rowType === 'data') {
                                  📊 {{ row.label }}
                                } @else {
                                  &nbsp;
                                }
                              </td>
                              <td class="px-4 py-3 font-mono text-slate-400">{{ row.rowId }}</td>
                              <td class="px-4 py-3">
                                <span class="row-type-badge badge font-mono text-[9px]" [class]="'badge-' + (row.rowType === 'calc' ? 'success' : row.rowType === 'data' ? 'success' : 'muted')">
                                  {{ row.rowType }}
                                </span>
                              </td>
                              @for (col of expandedColumns(); track col.colId) {
                                <td
                                  class="col-flag-cell px-4 py-3 text-center font-mono border-l border-slate-200"
                                  [class.section-cell]="row.rowType === 'section'"
                                >
                                  @if (row.rowType === 'blank') {
                                    &nbsp;
                                  } @else {
                                    {{ getCellValue(row.rowId, col.colId) }}
                                  }
                                </td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <!-- Explorer Placeholder when no report is selected -->
              <div class="select-placeholder animate-fade-in">
                <div class="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm transition-transform duration-200 hover:scale-105 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" />
                    <path d="m5 17 4-4 4 4 6-6" stroke-width="2.5" class="text-indigo-500" />
                  </svg>
                </div>
                <h3 class="placeholder-title">No Template Selected</h3>
                <p class="placeholder-desc">Please select a report template from the vertical sidebar explorer on the left to review parameter configurations and run query calculations.</p>
              </div>
            }
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      /* Tailwind utility classes for SVG frame */
      .w-10 { width: 2.5rem; }
      .h-10 { height: 2.5rem; }
      .rounded-xl { border-radius: 0.75rem; }
      .bg-indigo-50 { background-color: rgba(79, 70, 229, 0.08); }
      .border-indigo-100 { border: 1px solid rgba(79, 70, 229, 0.2); }
      .flex { display: flex; }
      .items-center { align-items: center; }
      .justify-center { justify-content: center; }
      .text-indigo-600 { color: #4f46e5; }
      .text-indigo-500 { color: #6366f1; }
      .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
      .transition-transform { transition-property: transform; }
      .duration-200 { transition-duration: 200ms; }
      .hover\:scale-105:hover { transform: scale(1.05); }
      .mb-4 { margin-bottom: 1rem; }

      .builder-container {
        display: flex;
        min-height: 100vh;
        background: #f8fafc;
        color: #1e293b;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      /* ── Main Content ───────────────────────────────── */
      .main-content {
        flex-grow: 1;
        padding: 40px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
        transition: max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: calc(100vw - 260px);
      }

      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 20px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 24px;
      }

      .breadcrumbs {
        font-size: 13px;
        color: #64748b;
        margin-bottom: 8px;
      }
      .breadcrumbs a {
        color: #4f46e5;
        text-decoration: none;
      }
      .breadcrumbs a:hover {
        text-decoration: underline;
      }

      h1 {
        font-size: 32px;
        font-weight: 800;
        margin: 0;
        letter-spacing: -1px;
        color: #1e293b;
      }
      .report-subtitle {
        font-size: 15px;
        color: #64748b;
        margin: 4px 0 0 0;
      }

      /* ── Cards & Panels ─────────────────────────────── */
      .card {
        background: #ffffff;
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 16px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 12px -1px rgba(0, 0, 0, 0.03);
      }

      /* ── Workspace Split-Pane Explorer Layout ────────── */
      .workspace-split-pane {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        width: 100%;
        min-height: 620px;
        gap: 0;
        background: #ffffff;
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
      }
      
      .explorer-sidebar {
        width: 320px;
        flex-shrink: 0;
        border-right: 1px solid rgba(226, 232, 240, 0.8);
        background: #ffffff;
        display: flex;
        flex-direction: column;
        padding: 20px;
        box-sizing: border-box;
      }
      
      .search-container {
        margin-bottom: 16px;
      }
      
      .explorer-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow-y: auto;
        flex-grow: 1;
        max-height: calc(100vh - 280px);
      }
      
      .explorer-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: transparent;
        border: 1px solid transparent;
        border-left: 2px solid transparent;
        border-radius: 8px;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .explorer-row:hover {
        color: #1e293b;
        background: #f8fafc;
        transform: translateX(2px);
      }
      .explorer-row.active-light-explorer-row {
        background: rgba(79, 70, 229, 0.08) !important;
        color: #4f46e5 !important;
        border-left: 2px solid #4f46e5 !important;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.05);
      }
      .explorer-row.active-light-explorer-row .report-code {
        color: #4f46e5 !important;
      }
      .explorer-row.active-light-explorer-row .report-name-text {
        color: #4f46e5 !important;
      }
      
      .report-code {
        font-size: 10px;
        letter-spacing: 0.05em;
      }
      .report-name-text {
        font-size: 13px;
        line-height: 1.4;
      }
      
      .status-badge-explorer {
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.05em;
        background: #f1f5f9;
        color: #64748b;
      }
      .status-badge-explorer.published {
        background: rgba(16, 185, 129, 0.15);
        color: #059669;
      }
      .status-badge-explorer.draft {
        background: rgba(245, 158, 11, 0.15);
        color: #d97706;
      }

      /* ── Active Canvas Workspace ────────────────────── */
      .workspace-active-canvas {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        padding: 24px;
        box-sizing: border-box;
        min-width: 0;
        background: #ffffff;
      }
      
      .active-report-meta-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 16px;
        margin-bottom: 20px;
      }
      
      .horizontal-parameter-bar {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px 20px;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        margin-bottom: 24px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .form-group label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64748b;
      }

      .form-input,
      .form-select {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 14px;
        color: #1e293b;
        outline: none;
        font-size: 13px;
        font-family: inherit;
        transition: all 0.2s ease;
        box-sizing: border-box;
        width: 100%;
      }
      .form-input:focus,
      .form-select:focus {
        border-color: #4f46e5;
        box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
      }
      .form-input::placeholder {
        color: #94a3b8;
      }

      /* ── Custom Date Picker Calendar Popover ────────── */
      .calendar-picker-container {
        position: relative;
        display: flex;
        flex-direction: column;
      }
      
      .calendar-trigger-btn {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        color: #1e293b;
        font-size: 13px;
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        outline: none;
        transition: all 0.2s ease;
        box-sizing: border-box;
        min-width: 170px;
      }
      .calendar-trigger-btn:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      .calendar-trigger-btn:focus {
        border-color: #4f46e5;
        box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
      }
      
      .calendar-popover-panel {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        width: 280px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        z-index: 100;
        box-sizing: border-box;
      }
      
      .calendar-popover-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .calendar-month-year {
        font-weight: 700;
        font-size: 13px;
        color: #1e293b;
      }
      
      .month-nav-btn {
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .month-nav-btn:hover {
        background: #f1f5f9;
        color: #1e293b;
      }
      
      .calendar-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        text-align: center;
        font-size: 9px;
        font-weight: 700;
        color: #64748b;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .calendar-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }
      
      .day-cell {
        background: transparent;
        border: none;
        border-radius: 6px;
        color: #94a3b8;
        font-size: 11px;
        font-family: 'JetBrains Mono', monospace;
        padding: 6px 0;
        cursor: not-allowed;
        opacity: 0.25;
        transition: all 0.15s ease;
      }
      
      .day-cell.day-available {
        opacity: 1;
        cursor: pointer;
        color: #334155;
      }
      .day-cell.day-available:hover {
        background: rgba(79, 70, 229, 0.08);
        color: #4f46e5;
      }
      .day-cell.day-selected {
        background: #4f46e5 !important;
        color: white !important;
        font-weight: 700;
        opacity: 1 !important;
        box-shadow: 0 0 10px rgba(79, 70, 229, 0.3);
      }
      .day-cell.empty-cell {
        visibility: hidden;
      }
      
      .calendar-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #e2e8f0;
        font-size: 9px;
        color: #64748b;
      }

      /* ── Run Button ─────────────────────────────────── */
      .run-report-btn {
        padding: 12px 28px;
        background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
        border: none;
        border-radius: 10px;
        color: white;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        transition: all 0.2s ease;
        width: 100%;
        margin-top: 8px;
      }
      .run-report-btn:hover:not(:disabled) {
        filter: brightness(1.1);
        box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
        transform: translateY(-1px);
      }
      .run-report-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        box-shadow: none;
      }

      /* ── Immersive Data Canvas ────────────────────── */
      .immersive-data-canvas {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .idle-placeholder,
      .select-placeholder {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 60px 40px;
        background: transparent !important;
        border: 2px dashed #e2e8f0 !important;
        border-radius: 16px;
        box-shadow: none !important;
        margin: 20px;
      }
      .placeholder-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .placeholder-title {
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
        margin: 0 0 8px 0;
      }
      .placeholder-desc {
        font-size: 13px;
        color: #64748b;
        margin: 0;
        max-width: 320px;
      }

      .loading-state-canvas {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 60px 40px;
        border: 2px dashed #e2e8f0;
        background: #f8fafc;
        border-radius: 16px;
        margin: 20px;
      }
      .loading-title {
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
        margin: 0 0 4px 0;
      }
      .loading-desc {
        font-size: 13px;
        color: #64748b;
        margin: 0;
      }

      .executed-workspace {
        flex-grow: 1;
        gap: 16px;
      }

      .workspace-header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 16px;
      }

      .export-csv-btn {
        padding: 8px 16px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        color: #334155;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      .export-csv-btn:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
        transform: translateY(-1px);
      }

      /* ── Spreadsheet Grid Table ──────────────────────── */
      .table-wrapper {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        max-width: 100%;
      }

      .spreadsheet-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .spreadsheet-table th {
        background: #f8fafc;
        color: #475569;
        padding: 10px 14px;
        font-size: 10px;
        font-weight: 700;
        border-bottom: 2px solid #e2e8f0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        white-space: nowrap;
      }

      .spreadsheet-table td {
        padding: 8px 14px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
        color: #334155;
      }

      .sticky-col {
        position: sticky;
        left: 0;
        background: #ffffff;
        z-index: 2;
        border-right: 1px solid #e2e8f0;
        font-weight: 600;
      }

      .col-flag-header {
        text-align: center !important;
      }
      .col-flag-cell {
        text-align: center;
        font-family: 'Fira Code', monospace;
        font-weight: 600;
        color: #4f46e5;
      }
      .col-flag-cell.section-cell {
        font-weight: bold;
        color: #1e293b;
        font-family: inherit;
      }

      .preview-col-label {
        font-size: 9px;
        color: #64748b;
        text-transform: none;
        margin-top: 2px;
      }

      /* Row styling matrix */
      .spreadsheet-table tr.row-style-header {
        background: rgba(79, 70, 229, 0.05);
        color: #4f46e5;
        border-bottom: 2px solid rgba(79, 70, 229, 0.2);
      }
      .spreadsheet-table tr.row-style-header .label-cell {
        font-weight: bold;
      }
      .spreadsheet-table tr.row-style-section {
        background: #f8fafc;
        color: #312e81;
      }
      .spreadsheet-table tr.row-style-section .label-cell {
        font-weight: bold;
      }
      .spreadsheet-table tr.row-style-total {
        background: #f1f5f9;
        border-top: 1px solid #cbd5e1;
        border-bottom: 2px double #94a3b8;
        font-weight: bold;
        color: #0f172a;
      }
      .spreadsheet-table tr.row-style-highlight {
        background: rgba(245, 158, 11, 0.05);
        color: #d97706;
      }

      /* ── Empty states, alerts and loading ───────────────── */
      .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(0, 0, 0, 0.1);
        border-top-color: #4f46e5;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .alert {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
      }
      .error-alert {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: #ef4444;
      }
      .alert-icon {
        font-size: 14px;
      }

      .animate-fade-in {
        animation: fadeIn 0.25s ease-out forwards;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* ── Custom Scrollbar Styling ────────────────── */
      .explorer-list::-webkit-scrollbar,
      .table-wrapper::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .explorer-list::-webkit-scrollbar-track,
      .table-wrapper::-webkit-scrollbar-track {
        background: transparent;
      }
      .explorer-list::-webkit-scrollbar-thumb,
      .table-wrapper::-webkit-scrollbar-thumb {
        background: #e2e8f0;
        border-radius: 3px;
      }
      .explorer-list::-webkit-scrollbar-thumb:hover,
      .table-wrapper::-webkit-scrollbar-thumb:hover {
        background: #cbd5e1;
      }

      /* Badge Success & Muted styles */
      .row-type-badge.badge-success {
        background: rgba(16, 185, 129, 0.1);
        color: #059669;
      }
      .row-type-badge.badge-muted {
        background: #f1f5f9;
        color: #64748b;
      }

      /* ── Mobile Layouts ─────────────────────────────── */
      .mobile-topbar {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 200;
        height: 60px;
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        align-items: center;
        padding: 0 16px;
        gap: 14px;
      }
      .topbar-brand {
        font-size: 17px;
        font-weight: 700;
        color: #1e293b;
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
      .hamburger-btn:hover {
        background: #f1f5f9;
      }
      .ham-line {
        display: block;
        width: 22px;
        height: 2px;
        background: #1e293b;
        border-radius: 2px;
      }

      @media (max-width: 1023px) {
        .mobile-topbar {
          display: flex;
        }
        .main-content {
          padding: 80px 20px 32px 20px;
          max-width: 100vw;
        }
        .workspace-layout {
          flex-direction: column;
        }
        .parameter-dock-panel {
          width: 100%;
        }
      }
    `,
  ],
})
export class ReportViewerComponent implements OnInit {
  username = '';

  catalogReports = signal<any[]>([]);
  selectedReportId = signal<string>('');
  selectedReportingDate = signal<string>('');
  availableReportingDates = signal<string[]>([]);
  runtimeQuickFilters = signal<any[]>([]);

  reportConfig = signal<any>(null);
  columns = signal<any[]>([]);
  rows = signal<any[]>([]);
  reportName = signal<string>('');

  loadingConfig = signal<boolean>(false);
  executing = signal<boolean>(false);
  executionError = signal<string | null>(null);
  executedData = signal<Map<string, Map<string, number>> | null>(null);

  sidebarOpen = signal(false);
  isMainMenuCollapsed = signal(false);

  // Search filter box states
  searchQuery = signal<string>('');

  // Custom Popover Calendar States
  isCalendarOpen = signal<boolean>(false);
  calendarYear = signal<number>(new Date().getFullYear());
  calendarMonth = signal<number>(new Date().getMonth());

  filteredReports = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const reports = this.catalogReports();
    if (!query) return reports;
    return reports.filter(r => 
      r.name.toLowerCase().includes(query) || 
      (r.reportId && r.reportId.toLowerCase().includes(query))
    );
  });

  calendarCells = computed(() => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    
    const cells: { dateStr: string; dayNum: number | null; isAvailable: boolean; isSelected: boolean }[] = [];
    
    // Previous month padding cells
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ dateStr: '', dayNum: null, isAvailable: false, isSelected: false });
    }
    
    const availableSet = new Set(this.availableReportingDates());
    const selected = this.selectedReportingDate();
    
    // Month days
    for (let day = 1; day <= numDays; day++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        dateStr: dStr,
        dayNum: day,
        isAvailable: availableSet.has(dStr),
        isSelected: selected === dStr
      });
    }
    
    return cells;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.isCalendarOpen() && !target.closest('.calendar-picker-container')) {
      this.isCalendarOpen.set(false);
    }
  }

  expandedColumns = computed(() => {
    const refDate = this.selectedReportingDate() || new Date().toISOString().split('T')[0];
    const expanded: any[] = [];
    for (const col of this.columns()) {
      if (col.colType === 'ROLLING') {
        const rollingN = col.rollingN || 1;
        const rollingGrain = col.rollingGrain || 'WEEK';
        const subCols = DateFormatter.getRollingSubColumns(refDate, col, rollingN, rollingGrain);
        expanded.push(...subCols);
      } else {
        expanded.push({
          ...col,
          isExpandedSubCol: false,
        });
      }
    }
    return expanded;
  });

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reportService = inject(ReportService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.username = this.authService.getUsername() || 'Guest';

    // 1. Fetch all catalog reports
    this.reportService
      .getReports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reports) => {
          this.catalogReports.set(reports);
        },
      });

    // 2. Fetch reporting dates
    this.reportService
      .getReportingDates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dates) => {
          this.availableReportingDates.set(dates);
          if (dates.length > 0 && !this.selectedReportingDate()) {
            this.selectedReportingDate.set(dates[0]);
            this.syncCalendarToSelectedDate();
          }

          // 3. Check for route params
          this.route.paramMap.subscribe((params) => {
            const id = params.get('id');
            if (id) {
              this.selectedReportId.set(id);
              this.loadReportConfig(id);
            }
          });
        },
      });
  }

  loadReportConfig(id: string): void {
    this.loadingConfig.set(true);
    const refDate = this.selectedReportingDate() || new Date().toISOString().split('T')[0];
    this.reportService
      .getReportConfig(id, refDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => {
          this.reportConfig.set(config);
          this.columns.set(config.columns || []);
          this.rows.set(config.rows || []);
          this.reportName.set(config.name);

          // Parse quick filters from JSON string
          let parsedFilters: any[] = [];
          if (config.quickFilters) {
            try {
              parsedFilters = JSON.parse(config.quickFilters);
            } catch (e) {
              console.warn('Failed to parse quick filters JSON:', e);
            }
          }

          // Initialize runtime filter models
          const filters = parsedFilters.map((f) => {
            const filterObj = {
              dimTable: f.dimTable || '',
              attribute: f.attribute,
              operator: f.operator,
              value: f.value || '',
              displayName: f.attribute,
              tableColumn: f.dimTable ? `${f.dimTable}.${f.attribute}` : f.attribute,
              options: [] as string[],
            };

            const queryTable = f.dimTable ? f.dimTable : config.rows?.[0]?.source?.table || '';
            if (queryTable) {
              this.reportService
                .getDistinctValues(queryTable, f.attribute)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                  next: (vals) => {
                    filterObj.options = vals;
                  },
                });
            }
            return filterObj;
          });

          this.runtimeQuickFilters.set(filters);
          this.loadingConfig.set(false);
          this.executedData.set(null); // clear old execution data
          this.syncCalendarToSelectedDate();
        },
        error: (err) => {
          console.error('Failed to load report config:', err);
          this.loadingConfig.set(false);
        },
      });
  }

  onReportSelected(reportId: string): void {
    if (!reportId) {
      this.selectedReportId.set('');
      this.reportConfig.set(null);
      this.rows.set([]);
      this.columns.set([]);
      this.runtimeQuickFilters.set([]);
      this.executedData.set(null);
      this.router.navigate(['/viewer']);
      return;
    }
    this.selectedReportId.set(reportId);
    this.router.navigate(['/viewer', reportId]);
    this.loadReportConfig(reportId);
  }

  runExecution(): void {
    const reportId = this.selectedReportId();
    if (!reportId) return;

    this.executing.set(true);
    this.executionError.set(null);

    const payload = {
      reportingDate: this.selectedReportingDate(),
      runtimeFilters: this.runtimeQuickFilters().map((rf) => ({
        tableColumn: rf.tableColumn,
        value: rf.value,
      })),
    };

    this.reportService
      .executeReport(reportId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          // Pivot the unpivoted grid array into a map: rowId -> colId -> val
          const gridMap = new Map<string, Map<string, number>>();
          for (const cell of data) {
            if (!gridMap.has(cell.rowId)) {
              gridMap.set(cell.rowId, new Map<string, number>());
            }
            gridMap.get(cell.rowId)!.set(cell.colId, cell.val);
          }
          this.executedData.set(gridMap);
          this.executing.set(false);
        },
        error: (err) => {
          console.error('Execution failed:', err);
          const msg = err.error?.message || err.message || 'Report execution failed.';
          this.executionError.set(msg);
          this.executing.set(false);
        },
      });
  }

  sanitizeForCsv(val: any): string {
    if (val === null || val === undefined) return '';
    let strVal = String(val).trim();

    // Formula Injection Triggers
    const formulaTriggers = ['=', '+', '-', '@'];
    if (formulaTriggers.some((char) => strVal.startsWith(char))) {
      strVal = `'${strVal}`;
    }

    // Standard CSV escaping
    if (
      strVal.includes(',') ||
      strVal.includes('"') ||
      strVal.includes('\n') ||
      strVal.includes('\r')
    ) {
      strVal = `"${strVal.replace(/"/g, '""')}"`;
    }

    return strVal;
  }

  exportToCsv(): void {
    const data = this.executedData();
    if (!data) return;

    const cols = this.expandedColumns();
    const headers = [
      this.sanitizeForCsv('Label'),
      this.sanitizeForCsv('ID'),
      this.sanitizeForCsv('Type'),
      ...cols.map((c) => this.sanitizeForCsv(`${c.label} (${c.colId})`)),
    ];

    const csvRows = [headers.join(',')];

    for (const row of this.rows()) {
      const rowCells = [
        this.sanitizeForCsv(row.label || ''),
        this.sanitizeForCsv(row.rowId || ''),
        this.sanitizeForCsv(row.rowType || ''),
      ];

      for (const col of cols) {
        if (row.rowType === 'blank') {
          rowCells.push('');
        } else {
          rowCells.push(this.sanitizeForCsv(this.getCellValue(row.rowId, col.colId)));
        }
      }
      csvRows.push(rowCells.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${this.selectedReportId() || 'export'}_${this.selectedReportingDate() || 'data'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getCellValue(rowId: string, colId: string): string {
    const grid = this.executedData();
    if (!grid) return '';
    const row = grid.get(rowId);
    if (!row) return '-';
    let val = row.get(colId);
    if (val === undefined || val === null) {
      // Fallback to parentColId if this is an expanded subcolumn
      const colMeta = this.expandedColumns().find((c) => c.colId === colId);
      if (colMeta && colMeta.parentColId) {
        val = row.get(colMeta.parentColId.toUpperCase());
      }
    }
    if (val === undefined || val === null) return '-';

    const rowMeta = this.rows().find((r) => r.rowId === rowId);
    const label = rowMeta ? rowMeta.label : '';
    return this.formatCellMetric(val, label);
  }

  formatCellMetric(val: number, label: string): string {
    if (isNaN(val)) return '-';
    const lowerLabel = label.toLowerCase();

    if (
      lowerLabel.includes('%') ||
      lowerLabel.includes('percent') ||
      lowerLabel.includes('rate') ||
      lowerLabel.includes('margin') ||
      lowerLabel.includes('pct')
    ) {
      const isFraction = Math.abs(val) <= 1.0 && val !== 0;
      const percentVal = isFraction ? val * 100 : val;
      return (
        new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(percentVal) + '%'
      );
    }

    if (
      lowerLabel.includes('amount') ||
      lowerLabel.includes('revenue') ||
      lowerLabel.includes('price') ||
      lowerLabel.includes('cost') ||
      lowerLabel.includes('fee') ||
      lowerLabel.includes('sales') ||
      lowerLabel.includes('profit') ||
      lowerLabel.includes('income') ||
      lowerLabel.includes('value') ||
      lowerLabel.includes('$')
    ) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val);
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleMainMenu(): void {
    this.isMainMenuCollapsed.update((v) => !v);
  }

  getMonthName(monthIndex: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }

  prevMonth(): void {
    if (this.calendarMonth() === 0) {
      this.calendarMonth.set(11);
      this.calendarYear.update(y => y - 1);
    } else {
      this.calendarMonth.update(m => m - 1);
    }
  }

  nextMonth(): void {
    if (this.calendarMonth() === 11) {
      this.calendarMonth.set(0);
      this.calendarYear.update(y => y + 1);
    } else {
      this.calendarMonth.update(m => m + 1);
    }
  }

  toggleCalendarPopover(event: Event): void {
    event.stopPropagation();
    this.isCalendarOpen.update(v => !v);
    this.syncCalendarToSelectedDate();
  }

  selectCalendarDate(dateStr: string): void {
    this.selectedReportingDate.set(dateStr);
    this.isCalendarOpen.set(false);
  }

  syncCalendarToSelectedDate(): void {
    const selected = this.selectedReportingDate();
    if (selected) {
      const parts = selected.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          this.calendarYear.set(y);
          this.calendarMonth.set(m);
        }
      }
    }
  }
}
