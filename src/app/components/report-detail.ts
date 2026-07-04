import { Component, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './sidebar';

@Component({
  selector: 'app-report-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SidebarComponent],
  template: `
    <div class="dashboard-container">
      <!-- Mobile topbar -->
      <div class="mobile-topbar">
        <button class="hamburger-btn" (click)="toggleSidebar()" aria-label="Toggle navigation">
          <span class="ham-line"></span>
          <span class="ham-line"></span>
          <span class="ham-line"></span>
        </button>
        <span class="topbar-brand">Reporting Engine</span>
      </div>
      <app-sidebar
        brandIcon="📊"
        brandText="Reporting Engine"
        [showBackButton]="true"
        backButtonText="← Back to Catalog"
        collapsedBackButtonText="←"
        [mobileOpen]="sidebarOpen()"
        (mobileOpenChange)="sidebarOpen.set($event)"
        (backClick)="goBack()"
      ></app-sidebar>

      <!-- Main Content -->
      <main class="main-content">
        @if (loading()) {
          <div class="loading-state">
            <span class="spinner large"></span>
            <p>Loading report layout configuration...</p>
          </div>
        } @else if (config(); as report) {
          <header class="detail-header animate-fade-in">
            <div>
              <div class="breadcrumbs">
                <a routerLink="/dashboard">Reports</a> / <span>{{ report.reportId }}</span>
              </div>
              <h1 style="display: flex; align-items: center; gap: 8px;">
                {{ report.reportId }}
                @if (running()) {
                  <span class="status-lozenge running font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border border-blue-500 text-blue-400 bg-blue-500/10">
                    <span class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></span> Running
                  </span>
                } @else {
                  <span class="status-lozenge font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border" [ngClass]="(report.status || 'draft').toLowerCase()">
                    {{ report.status }}
                  </span>
                }
              </h1>
              <p class="report-subtitle">{{ report.reportName }}</p>
            </div>

            <!-- Running Action Bar -->
            <div class="run-bar">
              <div class="date-selector">
                <label for="ref-date">Reference Date</label>
                <input 
                  type="date" 
                  id="ref-date" 
                  [(ngModel)]="referenceDate" 
                  (change)="onDateChange()"
                  class="date-input"
                />
              </div>
              <button 
                [routerLink]="['/reports', reportId, 'edit']"
                class="edit-btn-link"
              >
                <span>✏️ Edit Definition</span>
              </button>
              <button 
                (click)="runReport()" 
                [disabled]="running()" 
                class="run-btn"
              >
                @if (running()) {
                  <span class="spinner"></span> Generating...
                } @else {
                  <span>⚡ Run & Download</span>
                }
              </button>
            </div>
          </header>

          @if (errorMessage()) {
            <div class="alert error-alert animate-fade-in">
              <span class="alert-icon">⚠️</span>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <!-- Tabs -->
          <div class="tabs-container animate-fade-in">
            @if (running()) {
              <div class="running-overlay">
                <span class="spinner large"></span>
                <p>Generating report spreadsheet...</p>
              </div>
            }
            <div class="tabs-header">
              <button 
                [class.active]="activeTab() === 'columns'" 
                (click)="activeTab.set('columns')"
                class="tab-btn"
              >
                Section A: Columns ({{ report.columns.length }})
              </button>
              <button 
                [class.active]="activeTab() === 'rows'" 
                (click)="activeTab.set('rows')"
                class="tab-btn"
              >
                Section B: Rows & Layout ({{ report.rows.length }})
              </button>
            </div>

            <div class="tab-body">
              <!-- Section A: Columns -->
              @if (activeTab() === 'columns') {
                <div class="table-wrapper animate-fade-in">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Label</th>
                        <th>Type</th>
                        <th>Offset</th>
                        <th>Rolling N</th>
                        <th>Formula Expression</th>
                        <th>Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (col of report.columns; track col.colId) {
                        <tr>
                          <td><code>{{ col.colId }}</code></td>
                          <td class="font-bold">{{ col.label }}</td>
                          <td>
                            <span class="col-type-badge" [class]="col.colType.toLowerCase()">
                              {{ col.colType }}
                            </span>
                          </td>
                          <td>{{ col.periodOffset }}</td>
                          <td>{{ col.rollingN != null ? col.rollingN : '-' }}</td>
                          <td><code class="formula">{{ col.formulaExpr || '-' }}</code></td>
                          <td>{{ col.displayOrder }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- Section B: Rows -->
              @if (activeTab() === 'rows') {
                <div class="spreadsheet-container animate-fade-in">
                  <div class="table-wrapper">
                    <table class="spreadsheet-table">
                      <thead>
                        <tr>
                          <th class="sticky-col">Report Row / Label</th>
                          <th>ID</th>
                          <th>Type</th>
                          <th>Source / Formula</th>
                          <th>Style</th>
                          @for (col of report.columns; track col.colId) {
                            <th class="col-flag-header"><code>{{ col.colId }}</code></th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of report.rows; track row.rowId) {
                          <tr [class]="'row-style-' + row.style.toLowerCase()">
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
                            <td>
                              <span class="row-type-badge" [class]="row.rowType">
                                {{ row.rowType }}
                              </span>
                            </td>
                            <td>
                              @if (row.rowType === 'data') {
                                <code class="metric-source">{{ row.source }}</code>
                              } @else if (row.rowType === 'calc') {
                                <code class="formula">{{ row.source }}</code>
                              } @else {
                                -
                              }
                            </td>
                            <td><code>{{ row.style }}</code></td>
                            <!-- Active Column Flags Grid -->
                            @for (col of report.columns; track col.colId) {
                              <td class="col-flag-cell">
                                @if (isEnabledFor(row, col.colId)) {
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
                </div>
              }
            </div>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      min-height: 100vh;
      background: var(--color-apple-bg);
      color: var(--color-apple-text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Sidebar */
    .sidebar {
      width: 260px;
      background: var(--card-bg);
      border-right: 1px solid var(--border-color);
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      padding: 24px;
      gap: 32px;
      flex-shrink: 0;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      font-size: 28px;
    }

    .brand-text {
      font-size: 20px;
      font-weight: 700;
      color: var(--color-apple-text);
    }

    .sidebar-menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-grow: 1;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      color: var(--color-apple-grey);
      text-decoration: none;
      border-radius: 12px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .menu-item:hover, .menu-item.active {
      color: var(--color-apple-text);
      background: var(--input-bg);
    }

    .menu-item.active {
      background: linear-gradient(135deg, rgba(0, 118, 223, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%);
      border: 1px solid rgba(0, 118, 223, 0.2);
      color: var(--color-apple-blue);
    }

    .menu-icon {
      font-size: 18px;
    }

    .back-btn {
      width: 100%;
      padding: 12px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--color-apple-text);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .back-btn:hover {
      background: var(--border-color);
      border-color: var(--border-color);
    }

    /* Main Content */
    .main-content {
      flex-grow: 1;
      padding: 40px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 24px;
    }

    .breadcrumbs {
      font-size: 13px;
      color: var(--color-apple-grey);
      margin-bottom: 8px;
    }

    .breadcrumbs a {
      color: var(--color-apple-blue);
      text-decoration: none;
    }

    .breadcrumbs a:hover {
      text-decoration: underline;
    }

    h1 {
      font-size: 36px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -1px;
    }

    .report-subtitle {
      font-size: 16px;
      color: var(--color-apple-grey);
      margin: 4px 0 0 0;
    }

    /* Execution Bar */
    .run-bar {
      display: flex;
      align-items: center;
      gap: 20px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 16px 24px;
    }

    .date-selector {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .date-selector label {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-apple-grey);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .date-input {
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px 12px;
      color: var(--color-apple-text);
      outline: none;
      font-size: 14px;
      font-family: inherit;
    }

    .date-input:focus {
      border-color: var(--color-apple-blue);
    }

    .edit-btn-link {
      padding: 12px 24px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--color-apple-text);
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      transition: all 0.2s ease;
      align-self: flex-end;
      text-decoration: none;
    }

    .edit-btn-link:hover {
      background: var(--border-color);
      border-color: rgba(0, 118, 223, 0.4);
    }

    .run-btn {
      padding: 12px 24px;
      background: linear-gradient(135deg, var(--color-apple-blue) 0%, var(--color-apple-blue) 100%);
      border: none;
      border-radius: 10px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0, 118, 223, 0.3);
      transition: all 0.2s ease;
      align-self: flex-end;
    }

    .run-btn:hover:not(:disabled) {
      background: var(--color-apple-blue);
      box-shadow: 0 6px 16px rgba(0, 118, 223, 0.4);
    }

    .run-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid var(--border-color);
      border-top-color: var(--color-apple-text);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .spinner.large {
      width: 45px;
      height: 45px;
      border-width: 3px;
      border-top-color: var(--color-apple-blue);
    }

    /* Alerts */
    .alert {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 14px;
    }

    .error-alert {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }

    .alert-icon {
      font-size: 18px;
      font-weight: bold;
    }

    /* Tabs */
    .tabs-container {
      position: relative;
      display: flex;
      flex-direction: column;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      overflow: hidden;
    }

    .running-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      animation: fadeIn 0.2s ease-out;
    }

    .running-overlay p {
      color: white;
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }

    .tabs-header {
      display: flex;
      background: var(--color-apple-bg);
      border-bottom: 1px solid var(--border-color);
    }

    .tab-btn {
      padding: 16px 24px;
      background: none;
      border: none;
      color: #94a3b8;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }

    .tab-btn:hover {
      color: var(--color-apple-text);
    }

    .tab-btn.active {
      color: var(--color-apple-blue);
      border-bottom-color: var(--color-apple-blue);
    }

    .tab-body {
      padding: 24px;
    }

    /* Table Styles */
    .table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid var(--border-color);
    }

    .data-table, .spreadsheet-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      text-align: left;
    }

    .data-table th, .spreadsheet-table th {
      background: var(--color-apple-bg);
      color: var(--color-apple-grey);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-color);
    }

    .data-table td, .spreadsheet-table td {
      padding: 12px 18px;
      border-bottom: 1px solid var(--input-bg);
    }

    .font-bold {
      font-weight: 600;
    }

    code {
      background: var(--input-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Fira Code', monospace;
      color: var(--color-apple-text);
      border: 1px solid var(--border-color);
    }

    code.formula {
      color: #22c55e;
    }

    code.metric-source {
      color: #38bdf8;
    }

    .col-type-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
    }

    .col-type-badge.week { background: rgba(0, 118, 223, 0.15); color: var(--color-apple-blue); }
    .col-type-badge.mtd { background: rgba(234, 179, 8, 0.15); color: #facc15; }
    .col-type-badge.ytd { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .col-type-badge.rolling { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
    .col-type-badge.calc { background: rgba(236, 72, 153, 0.15); color: #f472b6; }

    .row-type-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .row-type-badge.section { background: var(--color-apple-card); color: var(--color-apple-text); }
    .row-type-badge.data { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
    .row-type-badge.calc { background: rgba(34, 197, 94, 0.1); color: #4ade80; }
    .row-type-badge.blank { background: transparent; color: var(--color-apple-grey); }

    /* Status Badges */
    .report-status-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .report-status-badge.draft { background: rgba(234, 179, 8, 0.15); color: #facc15; }
    .report-status-badge.published { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .report-status-badge.running { background: rgba(0, 118, 223, 0.15); color: var(--color-apple-blue); }

    /* Spreadsheet View Styles */
    .spreadsheet-container {
      margin-top: 10px;
    }

    .spreadsheet-table tr.row-style-header {
      background: rgba(27, 79, 114, 0.3);
      color: white;
      border-bottom: 2px solid #1B4F72;
    }

    .spreadsheet-table tr.row-style-section {
      background: rgba(214, 234, 248, 0.1);
      color: #a5b4fc;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .spreadsheet-table tr.row-style-total {
      background: rgba(235, 245, 251, 0.05);
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      border-bottom: 2px double rgba(255, 255, 255, 0.3);
      font-weight: bold;
    }

    .spreadsheet-table tr.row-style-highlight {
      background: rgba(255, 220, 0, 0.05);
      color: #fbbf24;
      border-top: 1px dashed rgba(251, 191, 36, 0.3);
      border-bottom: 1px dashed rgba(251, 191, 36, 0.3);
    }

    .sticky-col {
      position: sticky;
      left: 0;
      background: var(--color-apple-card);
      z-index: 2;
      box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
    }

    .spreadsheet-table tr.row-style-header .sticky-col { background: #1B4F72; }
    .spreadsheet-table tr.row-style-section .sticky-col { background: #23354f; }
    .spreadsheet-table tr.row-style-total .sticky-col { background: #272f3d; }
    .spreadsheet-table tr.row-style-highlight .sticky-col { background: #332d1b; }

    .col-flag-header {
      text-align: center !important;
    }

    .col-flag-cell {
      text-align: center;
    }

    .flag-dot {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
      font-size: 11px;
      font-weight: bold;
    }

    .flag-dash {
      color: #334155;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 120px 40px;
      gap: 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate-fade-in {
      animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    /* ═══════════════ MOBILE RESPONSIVE ═══════════════ */

    .mobile-topbar {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 200;
      height: 60px;
      background: var(--color-apple-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      align-items: center;
      padding: 0 16px;
      gap: 14px;
    }

    .topbar-brand {
      font-size: 17px;
      font-weight: 700;
      color: var(--color-apple-text);
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
    .hamburger-btn:hover { background: var(--border-color); }

    .ham-line {
      display: block;
      width: 22px;
      height: 2px;
      background: var(--color-apple-text);
      border-radius: 2px;
    }

    .sidebar-close-btn {
      display: none;
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--color-apple-text);
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
        border-right: 1px solid var(--border-color);
      }
      .sidebar.open {
        transform: translateX(0);
        box-shadow: 4px 0 32px rgba(0, 0, 0, 0.5);
      }

      .main-content {
        padding: 80px 20px 32px 20px;
      }
    }

    @media (max-width: 767px) {
      .main-content {
        padding: 76px 16px 24px 16px;
        gap: 20px;
      }
      .detail-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
      h1 {
        font-size: 26px;
      }
      .run-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        padding: 14px 16px;
      }
      .run-btn, .edit-btn-link {
        width: 100%;
        justify-content: center;
        align-self: auto;
      }
      .tabs-header {
        overflow-x: auto;
        white-space: nowrap;
        padding-bottom: 0;
      }
      .tab-btn {
        white-space: nowrap;
      }
    }
  `]
})
export class ReportDetailComponent implements OnInit {
  reportId = '';
  referenceDate = '2025-12-31'; // Default matching analytical seed
  config = signal<any | null>(null);
  loading = signal(true);
  running = signal(false);
  errorMessage = signal<string | null>(null);
  activeTab = signal<'columns' | 'rows'>('rows');
  sidebarOpen = signal(false);

  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private reportService = inject(ReportService);
  private router = inject(Router);

  constructor() {}

  ngOnInit(): void {
    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      this.reportId = params['id'];
      this.loadConfig();
    });
  }

  loadConfig(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.reportService.getReportConfig(this.reportId, this.referenceDate).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.config.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Failed to load report definition layout.');
      }
    });
  }

  onDateChange(): void {
    this.loadConfig();
  }

  isEnabledFor(row: any, colId: string): boolean {
    return row.activeCols && row.activeCols.includes(colId.toUpperCase());
  }

  runReport(): void {
    this.running.set(true);
    this.errorMessage.set(null);

    this.reportService.runReport(this.reportId, this.referenceDate).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (blob) => {
        this.running.set(false);
        // Trigger browser download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.reportId}_${this.referenceDate}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.running.set(false);
        this.errorMessage.set('Failed to generate report. Make sure the analytical database is correctly seeded.');
      }
    });
  }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  closeSidebar(): void { this.sidebarOpen.set(false); }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
