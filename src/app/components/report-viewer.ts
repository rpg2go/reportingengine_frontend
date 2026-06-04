import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { DateFormatter } from '../utils/date-formatter';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-report-viewer',
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
        <span class="topbar-brand">Reports Execution Hub</span>
      </div>
      <!-- Sidebar overlay backdrop -->
      <div class="sidebar-overlay" [class.visible]="sidebarOpen()" (click)="closeSidebar()"></div>

      <!-- ════════════════════════════════════════════ SIDEBAR -->
      <aside class="sidebar" [class.open]="sidebarOpen()" [class.collapsed]="isMainMenuCollapsed()">
        <button class="sidebar-close-btn" (click)="closeSidebar()" aria-label="Close navigation">✕</button>
        <div class="sidebar-brand">
          <span class="brand-icon">👁️</span>
          <span class="brand-text">Execution Hub</span>
          <button class="menu-collapse-btn" (click)="toggleMainMenu()" [title]="isMainMenuCollapsed() ? 'Expand Menu' : 'Collapse Menu'">
            {{ isMainMenuCollapsed() ? '➔' : '«' }}
          </button>
        </div>

        <nav class="sidebar-menu">
          <a routerLink="/dashboard" class="menu-item" [title]="isMainMenuCollapsed() ? 'Reports Catalog' : ''">
            <span class="menu-icon">📁</span>
            <span class="menu-text">Reports Catalog</span>
          </a>
          <a routerLink="/viewer" class="menu-item active" [title]="isMainMenuCollapsed() ? 'Reports Execution Hub' : ''">
            <span class="menu-icon">👁️</span>
            <span class="menu-text">Reports Execution Hub</span>
          </a>
          <a routerLink="/semantic" class="menu-item" [title]="isMainMenuCollapsed() ? 'Semantic Layer' : ''">
            <span class="menu-icon">🧠</span>
            <span class="menu-text">Semantic Layer</span>
          </a>
        </nav>

        <div class="sidebar-user">
          <div class="user-info" *ngIf="!isMainMenuCollapsed()">
            <span class="user-avatar">👤</span>
            <div class="user-details">
              <span class="user-name">{{ username }}</span>
              <span class="user-role">Consumer</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- ══════════════════════════════════════════ MAIN CONTENT -->
      <main class="main-content animate-fade-in">
        <header class="detail-header">
          <div>
            <div class="breadcrumbs">
              <a routerLink="/dashboard">Reports</a> / <span>Execution Hub</span>
            </div>
            <h1>📈 Reports Execution Hub</h1>
            <p class="report-subtitle">Run published reports, override runtime parameters, and analyze tabular data models.</p>
          </div>
        </header>

        <!-- Template Selector Panel -->
        <section class="config-panel card">
          <div class="form-group">
            <label for="template-select">Select Report Template</label>
            <select id="template-select" [ngModel]="selectedReportId()" (ngModelChange)="onReportSelected($event)" class="form-select select-template-dropdown">
              <option value="">-- Choose a report template --</option>
              @for (rep of catalogReports(); track rep.reportId) {
                <option [value]="rep.reportId">{{ rep.name }} ({{ rep.reportId }})</option>
              }
            </select>
          </div>
        </section>

        <!-- Execution Filter Control Bar -->
        @if (selectedReportId() && !loadingConfig()) {
          <section class="config-panel card animate-fade-in">
            <div class="flex-header-row">
              <h3 class="section-title">⚡ Runtime Parameters for "{{ reportName() }}"</h3>
            </div>
            
            <div class="filter-controls-grid">
              <!-- Reporting Date Selector -->
              <div class="form-group">
                <label for="reporting-date-select">Reporting Date*</label>
                <select id="reporting-date-select" [(ngModel)]="selectedReportingDate" class="form-select">
                  <option value="">-- Select Date --</option>
                  @for (d of availableReportingDates(); track d) {
                    <option [value]="d">{{ d }}</option>
                  }
                </select>
              </div>

              <!-- Quick Filters Runtime Inputs -->
              @for (filter of runtimeQuickFilters(); track filter.tableColumn) {
                <div class="form-group">
                  <label>{{ filter.dimTable ? filter.dimTable + '.' : '' }}{{ filter.attribute }} ({{ filter.operator }})</label>
                  
                  @if (filter.options.length > 0) {
                    <select [(ngModel)]="filter.value" class="form-select">
                      <option value="">-- All Values --</option>
                      @for (opt of filter.options; track opt) {
                        <option [value]="opt">{{ opt }}</option>
                      }
                    </select>
                  } @else {
                    <input type="text" [(ngModel)]="filter.value" placeholder="Enter filter value..." class="form-input" />
                  }
                </div>
              }
            </div>

            <!-- Run execution button -->
            <div class="btn-container-align">
              <button (click)="runExecution()" [disabled]="executing() || !selectedReportingDate()" class="run-report-btn">
                @if (executing()) {
                  <span class="spinner"></span> Executing...
                } @else {
                  <span>⚡ Run Report</span>
                }
              </button>
            </div>
          </section>
        }

        <!-- Loading Configuration State -->
        @if (loadingConfig()) {
          <div class="loading-state card">
            <span class="spinner"></span> Loading report template layout config...
          </div>
        }

        <!-- Execution Error Alert -->
        @if (executionError()) {
          <div class="alert error-alert animate-fade-in">
            <span class="alert-icon">🛑</span>
            <span>{{ executionError() }}</span>
          </div>
        }

        <!-- ══════════════════════════════════════════ GRID DATA MATRIX CANVAS -->
        @if (selectedReportId() && !loadingConfig()) {
          <section class="preview-section card animate-fade-in">
            <h3 class="section-title">📊 Publication-Ready Data Grid</h3>
            <p class="section-desc">Pivoted spreadsheet matrix displaying calculated indicators and row formulas.</p>
            
            <div class="table-wrapper rows-table-wrapper" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;">
              @if (executedData()) {
                <table class="spreadsheet-table">
                  <thead>
                    <tr>
                      <th class="sticky-col">Label</th>
                      <th>ID</th>
                      <th>Type</th>
                      @for (col of expandedColumns(); track col.colId) {
                        <th class="col-flag-header">
                          <div><code>{{ col.colId }}</code></div>
                          <div class="preview-col-label">{{ col.label }}</div>
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of rows(); track row.rowId) {
                      <tr [class]="'row-style-' + (row.style || 'normal').toLowerCase()">
                        <td class="sticky-col label-cell" [style.padding-left.px]="20 + row.indentLevel * 16">
                          @if (row.rowType === 'section' || row.style?.toLowerCase() === 'section' || row.style?.toLowerCase() === 'header') {
                            📂 <strong>{{ row.label }}</strong>
                          } @else if (row.rowType === 'calc') {
                            🧮 <strong>{{ row.label }}</strong>
                          } @else if (row.rowType === 'data') {
                            📊 {{ row.label }}
                          } @else {
                            &nbsp;
                          }
                        </td>
                        <td><code>{{ row.rowId }}</code></td>
                        <td>
                          <span class="row-type-badge" [class]="row.rowType">{{ row.rowType }}</span>
                        </td>
                        @for (col of expandedColumns(); track col.colId) {
                          <td class="col-flag-cell" [class.section-cell]="row.rowType === 'section'">
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
              } @else {
                <div class="empty-state-hub">
                  <span class="empty-icon">📈</span>
                  <p>Click "Run Report" above to compile the query matrix and display data.</p>
                </div>
              }
            </div>
          </section>
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
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1), gap 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      transition: gap 0.3s cubic-bezier(0.4, 0, 0.2, 1), flex-direction 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .brand-icon { font-size: 28px; }
    .brand-text {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
      transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      max-width: 180px;
      opacity: 1;
      overflow: hidden;
    }

    .menu-collapse-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      margin-left: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      border-radius: 6px;
    }
    .menu-collapse-btn:hover {
      color: white;
      background: rgba(255, 255, 255, 0.08);
    }

    .sidebar-menu { display: flex; flex-direction: column; gap: 8px; flex-grow: 1; width: 100%; }

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
      border: 1px solid transparent;
    }
    .menu-item:hover { color: #f8fafc; background: rgba(255,255,255,0.05); }
    .menu-item.active {
      color: #f8fafc;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.25);
    }
    .menu-icon { font-size: 18px; }
    .menu-text {
      white-space: nowrap;
      transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      max-width: 180px;
      opacity: 1;
      overflow: hidden;
    }

    .sidebar-user { width: 100%; display: flex; flex-direction: column; }
    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.03);
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .user-avatar { font-size: 20px; }
    .user-details { display: flex; flex-direction: column; }
    .user-name { font-size: 13px; font-weight: 600; color: #f8fafc; }
    .user-role { font-size: 11px; color: #64748b; }

    @media (min-width: 1024px) {
      .sidebar.collapsed {
        width: 64px;
        padding: 24px 8px;
        align-items: center;
        gap: 20px;
      }
      .sidebar.collapsed .sidebar-brand {
        flex-direction: column;
        gap: 8px;
        align-items: center;
      }
      .sidebar.collapsed .brand-text {
        opacity: 0;
        max-width: 0;
        pointer-events: none;
      }
      .sidebar.collapsed .menu-collapse-btn {
        margin-left: 0;
      }
      .sidebar.collapsed .menu-text {
        opacity: 0;
        max-width: 0;
        pointer-events: none;
      }
      .sidebar.collapsed .menu-item {
        justify-content: center;
        padding: 12px;
      }
      .sidebar.collapsed + .main-content {
        max-width: calc(100vw - 64px);
      }
    }

    /* ── Main Content ───────────────────────────────── */
    .main-content {
      flex-grow: 1;
      padding: 40px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 32px;
      transition: max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

    .section-title { font-size: 18px; font-weight: 700; margin: 0; color: #f8fafc; }
    .section-desc  { font-size: 14px; color: #94a3b8; margin: 4px 0 16px 0; }

    /* ── Form Elements ──────────────────────────────── */
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-group label {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
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
      box-sizing: border-box;
      width: 100%;
    }
    .form-input:focus, .form-select:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
    }
    .form-input::placeholder { color: #475569; }

    .select-template-dropdown {
      max-width: 500px;
    }

    .filter-controls-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
    }

    .btn-container-align {
      display: flex;
      justify-content: flex-start;
      margin-top: 10px;
    }

    /* ── Run Button ─────────────────────────────────── */
    .run-report-btn {
      padding: 12px 28px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border: none;
      border-radius: 10px;
      color: white;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      transition: all 0.2s ease;
    }
    .run-report-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
      transform: translateY(-1px);
    }
    .run-report-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    /* ── Spreadsheet Grid Table ──────────────────────── */
    .table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.05);
      background: rgba(15,23,42,0.4);
    }

    .rows-table-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      max-width: 100%;
      position: relative;
    }

    .spreadsheet-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .spreadsheet-table th {
      background: rgba(15,23,42,0.9);
      color: #94a3b8;
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 600;
      border-bottom: 2px solid rgba(255,255,255,0.08);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .spreadsheet-table td {
      padding: 10px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      vertical-align: middle;
      color: #cbd5e1;
    }

    .sticky-col {
      position: sticky;
      left: 0;
      background: #1e293b;
      z-index: 2;
      border-right: 1px solid rgba(255,255,255,0.08);
      font-weight: 500;
    }

    .col-flag-header { text-align: center !important; }
    .col-flag-cell { text-align: center; font-family: 'Fira Code', monospace; font-weight: 600; color: #38bdf8; }
    .col-flag-cell.section-cell { font-weight: bold; color: #cbd5e1; font-family: inherit; }

    .preview-col-label { font-size: 9px; color: #64748b; text-transform: none; margin-top: 2px; }

    /* Row styling matrix */
    .spreadsheet-table tr.row-style-header { background: rgba(27,79,114,0.3); color: white; border-bottom: 2px solid #1B4F72; }
    .spreadsheet-table tr.row-style-header .label-cell { font-weight: bold; }
    .spreadsheet-table tr.row-style-section { background: rgba(214,234,248,0.1); color: #a5b4fc; }
    .spreadsheet-table tr.row-style-section .label-cell { font-weight: bold; }
    .spreadsheet-table tr.row-style-total { background: rgba(235,245,251,0.05); border-top: 1px solid rgba(255,255,255,0.2); border-bottom: 2px double rgba(255,255,255,0.3); font-weight: bold; }
    .spreadsheet-table tr.row-style-highlight { background: rgba(255,220,0,0.05); color: #fbbf24; }

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

    /* ── Empty states, alerts and loading ───────────────── */
    .empty-state-hub {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #64748b;
      gap: 12px;
      text-align: center;
    }
    .empty-icon { font-size: 40px; }
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
    @keyframes spin { to { transform: rotate(360deg); } }

    .alert {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
    }
    .error-alert   { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
    .alert-icon    { font-size: 16px; }

    .animate-fade-in {
      animation: fadeIn 0.25s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Mobile Layouts ─────────────────────────────── */
    .mobile-topbar {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 200;
      height: 60px;
      background: rgba(15, 23, 42, 0.97);
      backdrop-filter: blur(12px);
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
      z-index: 10;
    }
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 149;
      backdrop-filter: blur(2px);
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
    }
  `]
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
          isExpandedSubCol: false
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
    this.reportService.getReports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reports) => {
          this.catalogReports.set(reports);
        }
      });

    // 2. Fetch reporting dates
    this.reportService.getReportingDates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dates) => {
          this.availableReportingDates.set(dates);
          if (dates.length > 0 && !this.selectedReportingDate()) {
            this.selectedReportingDate.set(dates[0]);
          }
          
          // 3. Check for route params
          this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            if (id) {
              this.selectedReportId.set(id);
              this.loadReportConfig(id);
            }
          });
        }
      });
  }

  loadReportConfig(id: string): void {
    this.loadingConfig.set(true);
    const refDate = this.selectedReportingDate() || new Date().toISOString().split('T')[0];
    this.reportService.getReportConfig(id, refDate)
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
          const filters = parsedFilters.map(f => {
            const filterObj = {
              dimTable: f.dimTable || '',
              attribute: f.attribute,
              operator: f.operator,
              value: f.value || '',
              displayName: f.attribute,
              tableColumn: f.dimTable ? `${f.dimTable}.${f.attribute}` : f.attribute,
              options: [] as string[]
            };
            
            // If table has schema name, resolve it or use whitelist
            const queryTable = f.dimTable ? f.dimTable : config.rows?.[0]?.source?.table || '';
            if (queryTable) {
              this.reportService.getDistinctValues(queryTable, f.attribute)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                  next: (vals) => {
                    filterObj.options = vals;
                  }
                });
            }
            return filterObj;
          });
          
          this.runtimeQuickFilters.set(filters);
          this.loadingConfig.set(false);
          this.executedData.set(null); // clear old execution data
        },
        error: (err) => {
          console.error('Failed to load report config:', err);
          this.loadingConfig.set(false);
        }
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
      runtimeFilters: this.runtimeQuickFilters().map(rf => ({
        tableColumn: rf.tableColumn,
        value: rf.value
      }))
    };

    this.reportService.executeReport(reportId, payload)
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
        }
      });
  }

  getCellValue(rowId: string, colId: string): string {
    const grid = this.executedData();
    if (!grid) return '';
    const row = grid.get(rowId);
    if (!row) return '-';
    const val = row.get(colId);
    if (val === undefined || val === null) return '-';
    
    const rowMeta = this.rows().find(r => r.rowId === rowId);
    const label = rowMeta ? rowMeta.label : '';
    return this.formatCellMetric(val, label);
  }

  formatCellMetric(val: number, label: string): string {
    if (isNaN(val)) return '-';
    const lowerLabel = label.toLowerCase();
    
    if (lowerLabel.includes('%') || lowerLabel.includes('percent') || lowerLabel.includes('rate') || lowerLabel.includes('margin') || lowerLabel.includes('pct')) {
      const isFraction = Math.abs(val) <= 1.0 && val !== 0;
      const percentVal = isFraction ? val * 100 : val;
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(percentVal) + '%';
    }
    
    if (lowerLabel.includes('amount') || lowerLabel.includes('revenue') || lowerLabel.includes('price') || lowerLabel.includes('cost') || lowerLabel.includes('fee') || lowerLabel.includes('sales') || lowerLabel.includes('profit') || lowerLabel.includes('income') || lowerLabel.includes('value') || lowerLabel.includes('$')) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(val);
    }
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(val);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleMainMenu(): void {
    this.isMainMenuCollapsed.update(v => !v);
  }
}
