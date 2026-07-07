import { Component, OnInit, signal, DestroyRef, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './sidebar';
import { CalendarPickerComponent } from './calendar-picker';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SidebarComponent, CalendarPickerComponent],
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
        [showUser]="true"
        [mobileOpen]="sidebarOpen()"
        (mobileOpenChange)="sidebarOpen.set($event)"
      ></app-sidebar>

      <!-- Main Content Container with Split Layout -->
      <main class="main-content no-scrollbar" style="padding: 0; overflow: hidden; display: flex; flex-grow: 1;">
        <div class="dashboard-split-layout" style="display: flex; width: 100%; height: 100%; overflow: hidden;">
          
          <!-- Middle Pane: High-Density Catalog List -->
          <div class="middle-pane">
            <div class="pane-header">
              <div class="pane-title-row">
                <h1>Reports Catalog</h1>
                <button routerLink="/reports/new/edit" class="create-btn">
                  <span>+ Create Report</span>
                </button>
              </div>

              <!-- Search input wrapper -->
              <div class="search-input-wrapper" style="width: 100%;">
                <span class="search-icon">🔍</span>
                <input 
                  type="text" 
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event); onSearchChange()"
                  placeholder="Search templates..." 
                  class="search-input"
                  style="min-height: 36px; padding: 6px 12px 6px 32px; border-radius: 8px; font-size: 12px;"
                />
                @if (searchQuery()) {
                  <button (click)="searchQuery.set(''); onSearchChange()" class="clear-search-btn" style="right: 8px;">✕</button>
                }
              </div>

              <!-- Filter status chips -->
              <div class="filter-chips" style="gap: 6px;">
                <button 
                  class="filter-chip-btn" 
                  [class.active]="filterStatus() === 'all'" 
                  (click)="setFilterStatus('all')"
                  style="padding: 4px 10px; font-size: 11px;"
                >
                  All ({{ getReportsCountByStatus('all') }})
                </button>
                <button 
                  class="filter-chip-btn" 
                  [class.active]="filterStatus() === 'published'" 
                  (click)="setFilterStatus('published')"
                  style="padding: 4px 10px; font-size: 11px;"
                >
                  Published ({{ getReportsCountByStatus('published') }})
                </button>
                <button 
                  class="filter-chip-btn" 
                  [class.active]="filterStatus() === 'draft'" 
                  (click)="setFilterStatus('draft')"
                  style="padding: 4px 10px; font-size: 11px;"
                >
                  Drafts ({{ getReportsCountByStatus('draft') }})
                </button>
              </div>
            </div>

            <!-- Scrollable Card list -->
            <div class="high-density-list no-scrollbar">
              @if (loading()) {
                <div class="loading-state" style="padding: 40px 20px; border: none; background: transparent;">
                  <span class="spinner large" style="width: 28px; height: 28px;"></span>
                  <p style="font-size: 12px; color: var(--color-apple-grey);">Loading templates...</p>
                </div>
              } @else if (filteredReports.length === 0) {
                <div class="empty-state" style="padding: 40px 20px; border: none; background: transparent;">
                  <span class="empty-icon" style="width: 40px; height: 40px; font-size: 18px;">🔍</span>
                  <h3 style="font-size: 14px; margin-top: 8px;">No templates found</h3>
                  <p style="font-size: 12px; color: var(--color-apple-grey);">Try adjusting your search query.</p>
                </div>
              } @else {
                @for (report of filteredReports; track report.reportId || $index) {
                  <div 
                    class="hd-card" 
                    [class.active]="selectedReportId() === report.reportId"
                    (click)="viewReportCard(report.reportId)"
                  >
                    <div class="hd-card-header">
                      <span class="hd-badge" [class.published]="report.status === 'published'" [class.draft]="report.status === 'draft'">
                        {{ report.status }}
                      </span>
                    </div>
                    <h3 class="hd-card-title">{{ report.reportName }}</h3>
                    <p class="hd-card-desc">{{ report.description || 'No description provided.' }}</p>
                    <div class="hd-card-footer">
                      <span>Table: {{ report.sourceTable ? (report.sourceTable.includes('.') ? report.sourceTable.split('.')[1] : report.sourceTable) : 'N/A' }}</span>
                      <span class="hd-card-version">v{{ report.version }}</span>
                    </div>
                  </div>
                }
              }
            </div>
          </div>

          <!-- Right Pane: Contextual Inspector Panel -->
          <div class="right-pane no-scrollbar">
            @if (selectedReportLoading()) {
              <div class="inspector-empty-state">
                <span class="spinner large spinner-blue" style="width: 36px; height: 36px;"></span>
                <p class="empty-title" style="margin-top: 12px;">Loading Details...</p>
                <p class="empty-desc">Fetching layout parameters, DWH targets, and relationship joins...</p>
              </div>
            } @else if (!selectedReportId() || !selectedReportConfig()) {
              <div class="inspector-empty-state animate-fade-in">
                <div class="empty-graphic">📊</div>
                <h3 class="empty-title">Inspect Template Profile</h3>
                <p class="empty-desc">
                  Select a template from the catalog list to inspect its compilation models, DWH schemas, target databases, and database schema relationship networks.
                </p>
              </div>
            } @else {
              @let report = selectedReportConfig();
              <div class="inspector-container animate-fade-in">
                
                <!-- Inspector Header -->
                <div class="inspector-header-block">
                  <div class="inspector-title-row">
                    <div>
                      <span class="badge" [class.badge-success]="report.status === 'published'" [class.badge-warning]="report.status === 'draft'">
                        {{ report.status }}
                      </span>
                      <h2 style="margin-top: 8px;">{{ report.reportName }}</h2>
                    </div>
                    <div style="font-size: 12px; color: var(--color-apple-grey); text-align: right;">
                      <span>Version: <strong>v{{ report.version }}</strong></span>
                      <br>
                      <span>Granularity: <strong>{{ report.granularity || 'Not set' }}</strong></span>
                    </div>
                  </div>
                  <p class="inspector-desc">{{ report.description || 'This report is configured to aggregate transactional rows and present financial indicator summaries in a standard spreadsheet format.' }}</p>
                </div>

                <!-- Alert Messages inside Inspector -->
                @if (successMessage()) {
                  <div class="alert alert-success animate-fade-in">
                    <span class="alert-icon">✓</span>
                    <span>{{ successMessage() }}</span>
                  </div>
                }
                @if (errorMessage()) {
                  <div class="alert alert-error animate-fade-in">
                    <span class="alert-icon">⚠️</span>
                    <span>{{ errorMessage() }}</span>
                  </div>
                }

                <!-- Delete Confirmation dialog -->
                @if (showDeleteConfirm()) {
                  <div class="delete-confirm-block animate-fade-in">
                    <span class="delete-confirm-msg">⚠️ Delete this template definition? This action is permanent and cannot be undone.</span>
                    <div class="delete-confirm-actions">
                      <button (click)="showDeleteConfirm.set(false)" class="btn-secondary" style="min-height: 32px; padding: 4px 12px; font-size: 12px; border-radius: 6px;">Cancel</button>
                      <button (click)="deleteReport(report.reportId)" [disabled]="deleting()" class="btn-danger" style="min-height: 32px; padding: 4px 12px; font-size: 12px; border-radius: 6px;">
                        @if (deleting()) { Deleting... } @else { Yes, Delete }
                      </button>
                    </div>
                  </div>
                }

                <!-- Action Bar -->
                <div class="inspector-actions-bar">
                  <div class="inspector-date-box" style="position: relative;">
                    <label>Ref Date</label>
                    <button
                      type="button"
                      class="inspector-date-input"
                      style="display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; text-align: left; min-width: 135px; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--color-apple-text); border-radius: 8px; padding: 6px 12px; font-size: 13px; font-family: inherit;"
                      (click)="toggleDatePicker($event)"
                    >
                      <span>📅 {{ referenceDate() || 'Select Date' }}</span>
                      <span style="font-size: 10px; color: var(--color-apple-grey);">▼</span>
                    </button>
                    
                    @if (showDatePicker()) {
                      <app-calendar-picker
                        [availableDates]="availableReportingDates()"
                        [(selectedDate)]="referenceDate"
                        (dateSelected)="onDateSelectedFromPicker($event)"
                        (click)="$event.stopPropagation()"
                      ></app-calendar-picker>
                    }
                  </div>
                  <div class="inspector-action-buttons">
                    <button (click)="viewReport(report.reportId)" class="btn-secondary" style="min-height: 38px; padding: 8px 16px; font-size: 13px; border-radius: 8px;">
                      👁️ View Definition
                    </button>
                    <button [routerLink]="['/reports', report.reportId, 'edit']" class="btn-secondary" style="min-height: 38px; padding: 8px 16px; font-size: 13px; border-radius: 8px;">
                      ✏️ Edit Definition
                    </button>
                    <button (click)="showDeleteConfirm.set(true)" class="btn-secondary" style="min-height: 38px; padding: 8px 12px; font-size: 13px; border-radius: 8px; color: #f87171;" title="Delete Template">
                      🗑️
                    </button>
                    <button (click)="runReport()" [disabled]="running()" class="btn-primary" style="min-height: 38px; padding: 8px 20px; font-size: 13px; border-radius: 8px;">
                      @if (running()) {
                        <span class="spinner" style="width: 14px; height: 14px;"></span> Running...
                      } @else {
                        <span>⚡ Run & Download</span>
                      }
                    </button>
                  </div>
                </div>

                <!-- Data Preset Overview -->
                <div class="inspector-section">
                  <h3 class="inspector-section-title">📊 Data Preset Overview</h3>
                  <div class="datasource-grid">

                    <!-- Physical Tables column -->
                    <div class="datasource-item">
                      <span class="datasource-label">Physical Tables</span>
                      <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
                        @for (tbl of getPhysicalTables(); track tbl) {
                          <div class="datasource-table-pill">
                            <span class="datasource-table-icon">🗄️</span>
                            <span class="datasource-table-name">{{ tbl }}</span>
                          </div>
                        } @empty {
                          <span class="datasource-empty">No physical tables mapped</span>
                        }
                      </div>
                    </div>

                    <!-- Timeframe timeline capsule -->
                    <div class="datasource-item">
                      <span class="datasource-label">Query Timeframe</span>
                      @if (report.timeframeStart && report.timeframeEnd) {
                        <div class="timeline-capsule">
                          <!-- Start bounds -->
                          <div class="timeline-bound">
                            <span class="timeline-bound-label">Start Bounds</span>
                            <span class="timeline-bound-value">{{ report.timeframeStart }}</span>
                          </div>
                          <!-- Connector -->
                          <div class="timeline-connector">
                            <div class="timeline-line"></div>
                            <span class="timeline-span-badge">{{ getTimeframeSpan(report.timeframeStart, report.timeframeEnd) }}</span>
                            <div class="timeline-line"></div>
                          </div>
                          <!-- End bounds -->
                          <div class="timeline-bound end">
                            <span class="timeline-bound-label">End Bounds</span>
                            <span class="timeline-bound-value">{{ report.timeframeEnd }}</span>
                          </div>
                        </div>
                      } @else {
                        <div class="timeline-dynamic">
                          <span class="timeline-dynamic-icon">♾️</span>
                          <span class="timeline-dynamic-label">Dynamic rolling window</span>
                        </div>
                      }
                    </div>

                  </div>
                </div>

                <div class="inspector-section">
                  <h3 class="inspector-section-title">🗂️ Report Matrix Runtime Layout</h3>
                  <div class="compilation-summary">
                    <span>Columns: <strong>{{ report.columns?.length || 0 }}</strong></span>
                    <span>Rows: <strong>{{ report.rows?.length || 0 }}</strong></span>
                  </div>

                  <div class="compilation-tree no-scrollbar">
                    @for (row of report.rows; track row.rowId) {
                      <div class="tree-row" [style.margin-left.px]="row.indentLevel * 12" [style.opacity]="row.rowType === 'blank' ? 0.4 : 1">

                        <!-- Filter status lane -->
                        <div class="tree-row-filter-lane">
                          @if (rowHasFilter(row)) {
                            <input type="checkbox" checked disabled class="tree-filter-check" />
                            <span class="tree-filter-label active">Filtered</span>
                          } @else {
                            <input type="checkbox" disabled class="tree-filter-check" />
                            <span class="tree-filter-label">Open</span>
                          }
                        </div>

                        <!-- Row type icon + label -->
                        <div class="tree-row-label">
                          <span>
                            @if (row.rowType === 'section') { 📂 }
                            @else if (row.rowType === 'calc') { 🧮 }
                            @else if (row.rowType === 'data') { 📊 }
                            @else { ◽ }
                          </span>
                          <strong>{{ row.label || '[Blank Row]' }}</strong>
                        </div>

                        <!-- Scrollable expression chip -->
                        @if (row.rowType === 'data' || row.rowType === 'calc') {
                          <div class="tree-row-expr-scroll" [title]="getRowSourceLabel(row)">
                            <code class="tree-row-code" [class.data]="row.rowType === 'data'" [class.calc]="row.rowType === 'calc'">{{ getRowSourceLabel(row) }}</code>
                          </div>
                        } @else {
                          <span class="tree-row-expr-empty">—</span>
                        }

                        <!-- Type badge -->
                        <span class="tree-row-type" [class]="row.rowType">{{ row.rowType }}</span>
                      </div>
                    }
                  </div>
                </div>

              </div>
            }
          </div>

        </div>
      </main>
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      min-height: 100dvh;
      background: var(--color-apple-bg);
      color: var(--color-apple-text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Mobile topbar */
    .mobile-topbar {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 200;
      height: 52px;
      background: var(--color-apple-bg);
      -webkit-backdrop-filter: saturate(1.8) blur(20px);
      backdrop-filter: saturate(1.8) blur(20px);
      border-bottom: 1px solid var(--border-color);
      align-items: center;
      padding: 0 16px;
      gap: 14px;
    }

    .topbar-brand {
      font-size: 15px;
      font-weight: 700;
      color: var(--color-apple-text);
      letter-spacing: -0.3px;
    }

    .hamburger-btn {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background var(--transition-fast, 150ms);
    }
    .hamburger-btn:hover { background: var(--input-bg); }

    .ham-line {
      display: block;
      width: 20px;
      height: 1.5px;
      background: var(--color-apple-text);
      border-radius: 2px;
    }

    .main-content {
      flex-grow: 1;
      overflow-y: auto;
    }

    .create-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 24px;
      background: var(--color-apple-blue);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 13px;
      font-weight: 600;
      min-height: 44px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 118, 223, 0.25);
      transition: all var(--transition-base, 300ms);
    }

    .create-btn:hover {
      filter: brightness(1.12);
      box-shadow: 0 6px 20px rgba(0, 118, 223, 0.40);
      transform: translateY(-1px);
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.25);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
      display: inline-block;
    }

    .spinner.large {
      width: 36px;
      height: 36px;
      border-width: 3px;
      border-color: var(--border-color);
      border-top-color: var(--color-apple-blue);
    }

    /* Split Pane Layout */
    .dashboard-split-layout {
      display: flex;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: var(--color-apple-bg);
    }

    .middle-pane {
      width: 380px;
      min-width: 320px;
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      height: 100%;
      flex-shrink: 0;
      background: rgba(15, 23, 42, 0.25);
      backdrop-filter: blur(8px);
    }

    .right-pane {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      background: var(--color-apple-bg);
      position: relative;
    }

    /* Middle Pane Styles */
    .pane-header {
      padding: 24px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .pane-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pane-title-row h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.4px;
      color: var(--color-apple-text);
    }

    .high-density-list {
      flex-grow: 1;
      overflow-y: auto;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* High Density Template Cards */
    .hd-card {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all var(--transition-base, 300ms);
    }

    .hd-card::before {
      content: "";
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: var(--color-apple-blue);
      border-radius: 0 4px 4px 0;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .hd-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
      background: rgba(30, 41, 59, 0.6);
      transform: translateY(-1px);
    }

    .hd-card.active {
      background: rgba(0, 118, 223, 0.08);
      border-color: rgba(0, 118, 223, 0.3);
    }

    .hd-card.active::before {
      opacity: 1;
    }

    .hd-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .hd-card-id {
      font-size: 13px;
      font-weight: 700;
      font-family: monospace;
      color: var(--color-apple-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    .hd-card-version {
      font-size: 10px;
      color: var(--color-apple-grey);
    }

    .hd-card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-apple-text);
      margin: 0 0 6px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hd-card-desc {
      font-size: 11px;
      color: var(--color-apple-grey);
      line-height: 1.4;
      margin: 0 0 10px 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .hd-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: var(--color-apple-grey);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 8px;
    }

    /* Inspector Pane Styles */
    .inspector-container {
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 100%;
      max-width: clamp(720px, 90%, 1600px);
      margin: 0 auto;
    }

    @media (min-width: 2560px) {
      .inspector-container {
        max-width: 1800px;
        padding: 40px 48px;
      }
    }

    .inspector-header-block {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 20px;
    }

    .inspector-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      gap: 16px;
    }

    .inspector-title-row h2 {
      font-size: 28px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.6px;
      color: var(--color-apple-text);
    }

    .inspector-desc {
      font-size: 14px;
      color: var(--color-apple-grey);
      line-height: 1.6;
      margin: 8px 0 0 0;
    }

    /* Inspector Action Bar */
    .inspector-actions-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(30, 41, 59, 0.3);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 16px 24px;
      gap: 20px;
    }

    .inspector-date-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .inspector-date-box label {
      font-size: 10px;
      font-weight: 700;
      color: var(--color-apple-grey);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .inspector-date-input {
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 6px 12px;
      color: var(--color-apple-text);
      outline: none;
      font-size: 13px;
      font-family: inherit;
    }

    .inspector-action-buttons {
      display: flex;
      gap: 10px;
    }

    /* Empty state right pane */
    .inspector-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-grow: 1;
      padding: 48px;
      text-align: center;
      color: var(--color-apple-grey);
    }

    .empty-graphic {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.6;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-apple-text);
      margin: 0 0 8px 0;
    }

    .empty-desc {
      font-size: 13px;
      max-width: 380px;
      line-height: 1.5;
      margin: 0;
    }

    /* Block sections */
    .inspector-section {
      background: rgba(30, 41, 59, 0.2);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 24px;
    }

    .inspector-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-apple-blue);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .datasource-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      align-items: start;
    }

    /* Shrink to single column on narrow right-pane widths */
    @media (max-width: 700px) {
      .datasource-grid { grid-template-columns: 1fr; }
    }

    .datasource-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .datasource-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-apple-grey);
    }

    .datasource-table-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(59, 130, 246, 0.07);
      border: 1px solid rgba(59, 130, 246, 0.15);
      font-family: 'SF Mono', ui-monospace, monospace;
      font-size: 12px;
      color: var(--color-apple-blue);
      font-weight: 600;
    }

    .datasource-table-icon { font-size: 11px; }
    .datasource-table-name { letter-spacing: -0.01em; }

    .datasource-empty {
      font-size: 12px;
      font-style: italic;
      color: var(--color-apple-grey);
      opacity: 0.6;
    }

    .datasource-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-apple-text);
    }

    /* ── Timeline Capsule ─────────────────────────────── */
    .timeline-capsule {
      display: flex;
      align-items: center;
      gap: 0;
      margin-top: 8px;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(30, 41, 59, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .timeline-bound {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex-shrink: 0;
    }

    .timeline-bound.end {
      text-align: right;
    }

    .timeline-bound-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--color-apple-grey);
    }

    .timeline-bound-value {
      font-family: 'SF Mono', ui-monospace, monospace;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-apple-text);
      letter-spacing: -0.01em;
    }

    .timeline-connector {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
      gap: 0;
      padding: 0 8px;
    }

    .timeline-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(148,163,184,0.2), rgba(99,102,241,0.45));
    }

    .timeline-bound.end ~ .timeline-connector .timeline-line:first-child,
    .timeline-connector:last-child .timeline-line {
      background: linear-gradient(90deg, rgba(99,102,241,0.45), rgba(148,163,184,0.2));
    }

    .timeline-span-badge {
      flex-shrink: 0;
      padding: 2px 8px;
      border-radius: 99px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.25);
      font-size: 10px;
      font-weight: 700;
      color: #a5b4fc;
      white-space: nowrap;
      letter-spacing: 0.02em;
      margin: 0 6px;
    }

    .timeline-dynamic {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-top: 8px;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(148, 163, 184, 0.06);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }

    .timeline-dynamic-icon { font-size: 13px; }

    .timeline-dynamic-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-apple-grey);
      font-style: italic;
    }

    /* Model Compilation preview list */
    .compilation-summary {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      font-size: 13px;
      color: var(--color-apple-grey);
    }

    .compilation-summary strong {
      color: var(--color-apple-text);
    }

    .compilation-tree {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 6px;
    }

    /* ── Tree row layout ──────────────────────────────── */
    .tree-row {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 12px;
      gap: 10px;
      transition: background 0.15s ease;
    }

    .tree-row:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    /* Filter status lane */
    .tree-row-filter-lane {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      width: 54px;
      flex-shrink: 0;
    }

    .tree-filter-check {
      width: 11px;
      height: 11px;
      accent-color: var(--color-apple-blue);
      cursor: default;
    }

    .tree-filter-label {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-apple-grey);
      white-space: nowrap;
    }

    .tree-filter-label.active {
      color: #60a5fa;
    }

    /* Row label */
    .tree-row-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      min-width: 0;
      flex: 1;
    }

    /* Scrollable expression container */
    .tree-row-expr-scroll {
      flex: 1;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
    }

    .tree-row-expr-scroll::-webkit-scrollbar {
      height: 3px;
    }

    .tree-row-expr-scroll::-webkit-scrollbar-track {
      background: transparent;
    }

    .tree-row-expr-scroll::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.35);
      border-radius: 2px;
    }

    .tree-row-expr-empty {
      flex: 1;
      color: var(--color-apple-grey);
      font-size: 12px;
      text-align: right;
      padding-right: 4px;
    }

    /* Expression code chip — no truncation, scrolls inside parent */
    .tree-row-code {
      font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 6px;
      white-space: nowrap;
      display: inline-block;
    }

    .tree-row-code.data {
      color: #60a5fa;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.18);
    }

    .tree-row-code.calc {
      color: #4ade80;
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.18);
    }

    .tree-row-type {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .tree-row-type.section { background: rgba(255, 255, 255, 0.08); color: var(--color-apple-text); }
    .tree-row-type.data { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
    .tree-row-type.calc { background: rgba(34, 197, 94, 0.1); color: #4ade80; }

    /* Delete Confirmation block */
    .delete-confirm-block {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .delete-confirm-msg {
      font-size: 13px;
      color: #fca5a5;
      font-weight: 500;
    }

    .delete-confirm-actions {
      display: flex;
      gap: 10px;
    }

    /* High Density Badge overriding styles */
    .hd-badge {
      font-size: 8px;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .hd-badge.published { background: rgba(16, 185, 129, 0.1); color: #34d399; }
    .hd-badge.draft { background: rgba(245, 158, 11, 0.1); color: #fbbf24; }

    .search-filter-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 14px 20px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      backdrop-filter: blur(20px) saturate(180%);
    }

    .search-input-wrapper {
      position: relative;
      width: 100%;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-apple-grey);
      pointer-events: none;
      display: flex;
      align-items: center;
      font-size: 12px;
    }

    .search-input {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      color: var(--color-apple-text);
      outline: none;
      transition: all var(--transition-fast, 150ms);
      font-family: inherit;
    }

    .search-input:hover { border-color: var(--text-secondary); }

    .search-input:focus {
      border-color: rgba(0, 118, 223, 0.45);
      box-shadow: 0 0 0 3px rgba(0, 118, 223, 0.15);
      background: var(--card-bg);
    }

    .clear-search-btn {
      position: absolute;
      background: none;
      border: none;
      color: var(--color-apple-grey);
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast, 150ms);
      font-size: 10px;
      top: 50%;
      transform: translateY(-50%);
    }

    .clear-search-btn:hover {
      color: var(--color-apple-text);
      background: var(--input-bg);
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .filter-chip-btn {
      padding: 6px 14px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-apple-grey);
      cursor: pointer;
      transition: all var(--transition-fast, 150ms);
      white-space: nowrap;
    }

    .filter-chip-btn:hover {
      background: var(--card-bg);
      color: var(--color-apple-text);
      border-color: var(--text-secondary);
    }

    .filter-chip-btn.active {
      background: rgba(0, 118, 223, 0.12);
      color: var(--color-apple-blue);
      border-color: rgba(0, 118, 223, 0.30);
      font-weight: 600;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .animate-fade-in {
      animation: fadeIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }

    /* ═══════════════ LIGHT THEME REFINEMENT ═══════════════ */
    :host-context(html.light) .middle-pane {
      background: #FFFFFF;
      border-right-color: #E2E8F0;
    }

    :host-context(html.light) .right-pane {
      background: #F8FAFC;
    }

    :host-context(html.light) .pane-header {
      border-bottom-color: #E2E8F0;
    }

    :host-context(html.light) .pane-title-row h1,
    :host-context(html.light) .inspector-title-row h2,
    :host-context(html.light) .empty-title,
    :host-context(html.light) .tree-row-label strong {
      color: #0F172A;
    }

    :host-context(html.light) .hd-card {
      background: #FFFFFF;
      border-color: #E2E8F0;
    }

    :host-context(html.light) .hd-card-id,
    :host-context(html.light) .hd-card-title {
      color: #334155;
    }

    :host-context(html.light) .hd-card-desc {
      color: #64748B;
    }

    :host-context(html.light) .hd-card-footer {
      color: #64748B;
      border-top-color: #F1F5F9;
    }

    :host-context(html.light) .hd-card:hover {
      background: #F8FAFC;
      border-color: #CBD5E1;
    }

    :host-context(html.light) .hd-card.active {
      background: #F5F3FF;
      border-color: #C7D2FE;
    }

    :host-context(html.light) .hd-card.active::before {
      background: #4F46E5;
    }

    :host-context(html.light) .hd-card.active .hd-card-id {
      color: #4F46E5;
    }

    :host-context(html.light) .inspector-empty-state {
      color: #64748B;
    }

    :host-context(html.light) .inspector-desc {
      color: #475569;
    }

    :host-context(html.light) .inspector-actions-bar {
      background: #FFFFFF;
      border-color: #E2E8F0;
    }

    :host-context(html.light) .inspector-date-input {
      background: #FFFFFF;
      border-color: #E2E8F0;
      color: #0F172A;
    }

    :host-context(html.light) .inspector-date-input:focus {
      border-color: #818CF8;
    }

    :host-context(html.light) .btn-primary,
    :host-context(html.light) .upload-label {
      background: #4F46E5;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
    }

    :host-context(html.light) .btn-primary:hover,
    :host-context(html.light) .upload-label:hover {
      background: #4338CA;
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
    }

    :host-context(html.light) .btn-secondary {
      background: #FFFFFF;
      border-color: #E2E8F0;
      color: #475569;
    }

    :host-context(html.light) .btn-secondary:hover {
      background: #F8FAFC;
      border-color: #CBD5E1;
      color: #0F172A;
    }

    :host-context(html.light) .inspector-section {
      background: #FFFFFF;
      border-color: #E2E8F0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }

    :host-context(html.light) .inspector-section-title {
      color: #4F46E5;
    }

    :host-context(html.light) .datasource-label {
      color: #64748B;
    }

    :host-context(html.light) .datasource-value {
      color: #0F172A;
    }

    :host-context(html.light) .datasource-table-pill {
      background: rgba(37, 99, 235, 0.05);
      border-color: rgba(37, 99, 235, 0.15);
      color: #1d4ed8;
    }

    :host-context(html.light) .datasource-empty {
      color: #94a3b8;
    }

    :host-context(html.light) .timeline-capsule {
      background: #F8FAFC;
      border-color: #E2E8F0;
    }

    :host-context(html.light) .timeline-bound-label {
      color: #94a3b8;
    }

    :host-context(html.light) .timeline-bound-value {
      color: #0f172a;
    }

    :host-context(html.light) .timeline-span-badge {
      background: rgba(79, 70, 229, 0.08);
      border-color: rgba(79, 70, 229, 0.2);
      color: #4f46e5;
    }

    :host-context(html.light) .timeline-line {
      background: linear-gradient(90deg, rgba(203,213,225,0.6), rgba(99,102,241,0.35));
    }

    :host-context(html.light) .timeline-dynamic {
      background: rgba(241, 245, 249, 0.8);
      border-color: #E2E8F0;
    }

    :host-context(html.light) .timeline-dynamic-label {
      color: #64748B;
    }

    :host-context(html.light) .compilation-summary {
      color: #64748B;
    }

    :host-context(html.light) .compilation-summary strong {
      color: #0F172A;
    }

    :host-context(html.light) .tree-row {
      background: #FFFFFF;
      border-color: #E2E8F0;
    }

    :host-context(html.light) .tree-row:hover {
      background: #F8FAFC;
    }

    :host-context(html.light) .tree-row-expr code {
      background: #F1F5F9;
      border-color: #E2E8F0;
      color: #334155;
    }

    :host-context(html.light) .tree-row-code.data {
      color: #1d4ed8;
      background: rgba(29, 78, 216, 0.06);
      border-color: rgba(29, 78, 216, 0.18);
    }

    :host-context(html.light) .tree-row-code.calc {
      color: #15803d;
      background: rgba(21, 128, 61, 0.06);
      border-color: rgba(21, 128, 61, 0.18);
    }

    :host-context(html.light) .tree-filter-label {
      color: #94a3b8;
    }

    :host-context(html.light) .tree-filter-label.active {
      color: #2563eb;
    }

    :host-context(html.light) .tree-row-expr-empty {
      color: #94a3b8;
    }

    :host-context(html.light) .tree-row-expr-scroll::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.35);
    }

    :host-context(html.light) .search-input {
      background: #FFFFFF;
      border-color: #E2E8F0;
      color: #0F172A;
    }

    :host-context(html.light) .search-input:focus {
      border-color: #818CF8;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
      background: #FFFFFF;
    }

    :host-context(html.light) .clear-search-btn:hover {
      background: #F1F5F9;
    }

    :host-context(html.light) .filter-chip-btn {
      background: #FFFFFF;
      border-color: #E2E8F0;
      color: #64748B;
    }

    :host-context(html.light) .filter-chip-btn:hover {
      background: #F8FAFC;
      color: #0F172A;
    }

    :host-context(html.light) .filter-chip-btn.active {
      background: rgba(79, 70, 229, 0.08);
      color: #4F46E5;
      border-color: rgba(79, 70, 229, 0.25);
    }

    /* ═══════════════ MOBILE RESPONSIVE ═══════════════ */
    @media (max-width: 1023px) {
      .mobile-topbar { display: flex; }
      .main-content {
        padding: 52px 0 0 0 !important;
      }
      .middle-pane {
        width: 100%;
        border-right: none;
      }
      .right-pane {
        display: none;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  reports = signal<any[]>([]);
  loading = signal(true);
  uploading = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  username = '';

  // Search & Filter signals
  searchQuery = signal('');
  filterStatus = signal('all'); // 'all', 'draft', 'published'
  sidebarOpen = signal(false);

  // Inspector & selection signals
  selectedReportId = signal<string | null>(null);
  selectedReportConfig = signal<any | null>(null);
  selectedReportLoading = signal(false);
  referenceDate = signal<string>('2025-12-31');
  availableReportingDates = signal<string[]>([]);
  showDatePicker = signal<boolean>(false);
  running = signal<boolean>(false);
  deleting = signal<boolean>(false);
  showDeleteConfirm = signal<boolean>(false);

  private destroyRef = inject(DestroyRef);
  private reportService = inject(ReportService);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.username = this.authService.getUsername();
  }

  /**
   * Computes a human-readable duration between two date strings.
   * Returns strings like "12 Months Span", "3 Days Span", "2 Years Span".
   */
  getTimeframeSpan(start: string, end: string): string {
    if (!start || !end) return '';
    try {
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
      const diffMs = e.getTime() - s.getTime();
      if (diffMs < 0) return '';
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 31)  return `${diffDays} Day${diffDays !== 1 ? 's' : ''} Span`;
      const diffMonths = Math.round(diffDays / 30.44);
      if (diffMonths < 24) return `${diffMonths} Month${diffMonths !== 1 ? 's' : ''} Span`;
      const diffYears = Math.round(diffMonths / 12);
      return `${diffYears} Year${diffYears !== 1 ? 's' : ''} Span`;
    } catch {
      return '';
    }
  }

  /**
   * Returns true when a row carries active query filter constraints.
   * Checks `filterExpr` (raw backend DTO field) and the already-parsed
   * `rowFilters` property (present after report-builder hydration).
   */
  rowHasFilter(row: any): boolean {
    // Raw backend field: a non-empty, non-trivial JSON string
    const expr = row?.filterExpr;
    if (expr && typeof expr === 'string') {
      const trimmed = expr.trim();
      if (trimmed && trimmed !== '[]' && trimmed !== '{}' && trimmed !== 'null') {
        return true;
      }
    }
    // Hydrated in-memory field (report-builder sets this after parsing)
    if (row?.rowFilters) {
      if (Array.isArray(row.rowFilters) && row.rowFilters.length > 0) return true;
      if (
        typeof row.rowFilters === 'object' &&
        ((row.rowFilters.rules?.length > 0) || (row.rowFilters.childGroups?.length > 0))
      ) return true;
    }
    // Legacy raw expression
    if (row?.legacyFilterExpr && row.legacyFilterExpr.trim()) return true;
    return false;
  }

  /**
   * Safely resolves a human-readable expression string from row.source,
   * which may arrive as a plain string or as a backend JSON object:
   *   { aggregation, targetColumn, sourceTable, rawExpression }
   */
  getRowSourceLabel(row: any): string {
    const src = row?.source;
    if (!src) return '';

    // Already a plain string — return as-is
    if (typeof src === 'string') {
      // Could still be a JSON string from serialization
      if (src.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(src);
          return this.resolveSourceObject(parsed);
        } catch { /* fall through */ }
      }
      return src;
    }

    // Backend JSON object
    if (typeof src === 'object') {
      return this.resolveSourceObject(src);
    }

    return String(src);
  }

  private resolveSourceObject(obj: any): string {
    // Raw SQL / formula expression takes priority
    if (obj.rawExpression) return obj.rawExpression;
    if (obj.rawSql) return obj.rawSql;
    // Structured: AGG(column)
    const agg = obj.aggregation || obj.aggregationFunction || 'SUM';
    const col = obj.targetColumn || obj.measureCol || '';
    const tbl = obj.sourceTable || obj.table || '';
    if (col) return tbl ? `${agg}(${tbl}.${col})` : `${agg}(${col})`;
    return '';
  }

  getPhysicalTables(): string[] {
    const config = this.selectedReportConfig();
    if (!config || !config.rows) return [];
    const tables = new Set<string>();
    config.rows.forEach((row: any) => {
      if (row.rowType === 'data' && row.source) {
        const tbl = row.source.table || row.source.sourceTable;
        if (tbl && tbl.trim()) {
          tables.add(tbl.trim());
        }
      }
    });
    if (tables.size === 0 && config.sourceTable) {
      tables.add(config.sourceTable.trim());
    }
    return Array.from(tables).sort();
  }

  ngOnInit(): void {
    this.loadCatalog();
    this.reportService.getReportingDates().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (dates) => {
        this.availableReportingDates.set(dates);
        if (dates.length > 0) {
          if (!dates.includes(this.referenceDate())) {
            this.referenceDate.set(dates[0]);
          }
        }
      }
    });
  }

  loadCatalog(): void {
    this.loading.set(true);
    this.reportService.getReports().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.reports.set(data);
        this.loading.set(false);
        
        // Auto-select first report if desktop and nothing is selected yet
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
        if (data.length > 0 && !this.selectedReportId() && isDesktop) {
          const filtered = this.filteredReports;
          if (filtered.length > 0) {
            this.selectReport(filtered[0].reportId);
          }
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Failed to load report templates catalog.');
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.uploading.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.reportService.importTemplate(file).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.successMessage.set('Template Excel configurations imported successfully!');
        this.loadCatalog();
      },
      error: (err) => {
        this.uploading.set(false);
        this.errorMessage.set(err.error?.message || 'Error occurred during template ingestion.');
      }
    });
  }

  viewReport(reportId: string): void {
    this.router.navigate(['/reports', reportId, 'edit'], { queryParams: { view: 'true' } });
  }

  editReport(reportId: string, event: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/reports', reportId, 'edit']);
  }

  viewReportCard(reportId: string): void {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    if (isDesktop) {
      this.selectReport(reportId);
    } else {
      this.viewReport(reportId);
    }
  }

  selectReport(id: string | null): void {
    if (!id) {
      this.selectedReportId.set(null);
      this.selectedReportConfig.set(null);
      return;
    }

    this.selectedReportId.set(id);
    this.selectedReportLoading.set(true);
    this.showDeleteConfirm.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.reportService.getReportConfig) {
      this.reportService.getReportConfig(id, this.referenceDate()).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (config) => {
          this.selectedReportConfig.set(config);
          this.selectedReportLoading.set(false);
        },
        error: (err) => {
          this.selectedReportLoading.set(false);
          this.selectedReportConfig.set(null);
          this.errorMessage.set(`Failed to load configuration for report ${id}`);
        }
      });
    } else {
      this.selectedReportLoading.set(false);
    }
  }

  onDateChange(newDate: string): void {
    this.referenceDate.set(newDate);
    const currentId = this.selectedReportId();
    if (currentId) {
      // Reload config with new date
      this.selectReport(currentId);
    }
  }

  toggleDatePicker(event: Event): void {
    event.stopPropagation();
    this.showDatePicker.update(v => !v);
  }

  onDateSelectedFromPicker(newDate: string): void {
    this.showDatePicker.set(false);
    this.onDateChange(newDate);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.showDatePicker() && !target.closest('.inspector-date-box')) {
      this.showDatePicker.set(false);
    }
  }

  runReport(): void {
    const reportId = this.selectedReportId();
    if (!reportId) return;

    this.running.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.reportService.runReport) {
      this.reportService.runReport(reportId, this.referenceDate()).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (blob) => {
          this.running.set(false);
          this.successMessage.set(`Report ${reportId} generated successfully!`);
          // Trigger browser download
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${reportId}_${this.referenceDate()}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          this.running.set(false);
          // The error body arrives as a Blob when responseType is 'blob'.
          // Read it asynchronously to extract the backend message.
          const raw = err?.error;
          if (raw instanceof Blob) {
            raw.text().then(text => {
              let msg = 'Report execution failed.';
              try {
                const parsed = JSON.parse(text);
                msg = parsed.message || parsed.error || text || msg;
              } catch {
                if (text && text.trim()) msg = text.trim();
              }
              this.errorMessage.set(msg);
            }).catch(() => {
              this.errorMessage.set('Report execution failed. Check the analytical database configuration.');
            });
          } else {
            const msg = err?.error?.message || err?.error?.error || err?.message
              || 'Failed to generate report. Make sure the analytical database is correctly seeded.';
            this.errorMessage.set(msg);
          }
        }
      });
    } else {
      this.running.set(false);
    }
  }

  deleteReport(reportId: string): void {
    this.deleting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.reportService.deleteReport) {
      this.reportService.deleteReport(reportId).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => {
          this.deleting.set(false);
          this.showDeleteConfirm.set(false);
          this.successMessage.set(`Report configuration ${reportId} deleted successfully.`);
          
          // Remove from list and update selection
          const oldReports = this.reports();
          const updatedReports = oldReports.filter(r => r.reportId !== reportId);
          this.reports.set(updatedReports);
          
          // Auto-select first of remaining
          const filtered = this.filteredReports;
          if (filtered.length > 0) {
            this.selectReport(filtered[0].reportId);
          } else {
            this.selectReport(null);
          }
        },
        error: (err) => {
          this.deleting.set(false);
          this.errorMessage.set(err.error?.message || `Failed to delete report ${reportId}.`);
        }
      });
    } else {
      this.deleting.set(false);
    }
  }

  // Filter calculations & helper actions
  get filteredReports(): any[] {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.filterStatus();
    
    return this.reports().filter((report: any) => {
      // Status match
      if (status !== 'all' && report.status !== status) {
        return false;
      }
      
      // Query match
      return !query || 
        report.reportId.toLowerCase().includes(query) || 
        report.reportName.toLowerCase().includes(query) || 
        (report.description && report.description.toLowerCase().includes(query)) ||
        (report.exploreId && String(report.exploreId).toLowerCase().includes(query)) ||
        (report.sourceTable && report.sourceTable.toLowerCase().includes(query));
    });
  }

  getReportsCountByStatus(status: string): number {
    if (status === 'all') return this.reports().length;
    return this.reports().filter(r => r.status === status).length;
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterStatus.set('all');
    this.autoSelectFirst();
  }

  setFilterStatus(status: string): void {
    this.filterStatus.set(status);
    this.autoSelectFirst();
  }

  onSearchChange(): void {
    this.autoSelectFirst();
  }

  autoSelectFirst(): void {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    if (!isDesktop) return;

    setTimeout(() => {
      const filtered = this.filteredReports;
      if (filtered.length > 0) {
        const currentId = this.selectedReportId();
        const exists = filtered.some(r => r.reportId === currentId);
        if (!exists) {
          this.selectReport(filtered[0].reportId);
        }
      } else {
        this.selectReport(null);
      }
    });
  }

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  closeSidebar(): void { this.sidebarOpen.set(false); }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
