import { Component, OnInit, signal, computed, effect, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { forkJoin, combineLatest } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  parseMeasure,
  serializeMeasure,
  parseRowFilterExpr,
  serializeRowFilters,
  formatDateForInput,
  dateOffsetString,
} from '../utils/report-parser';
import { DateFormatter } from '../utils/date-formatter';
import { FieldPickerComponent } from './field-picker';
import { SidebarComponent } from './sidebar';
import { RowFilterComponent } from './row-filter';
import { CalendarPickerComponent } from './calendar-picker';
import { GranularityPickerComponent } from './granularity-picker';
import { GeneralFilterModalComponent } from './general-filter-modal';
import { TableFilterScope } from '../interfaces/general-filter.interface';
import { LiveLayoutPreviewComponent } from './live-layout-preview';
interface CalendarDay {
  date: Date;
  dayNum: number;
  isCurrentMonth: boolean;
  formattedStr: string;
  isEnabled: boolean;
}

export interface ValidationError {
  elementId: string;
  fieldContext: string;
  errorSeverity: 'CRITICAL' | 'WARNING';
  displayMessage: string;
}

/** Base quick/general filter condition (used on the report header scope). */
interface FilterCondition {
  attribute: string; // column name (plain for fact, "dim.col" style not used here — dimTable is separate)
  operator: string;
  value: string;
  dimTable?: string; // empty → fact table; set → dimension view name
  conjunction?: 'AND' | 'OR';
  availableValues?: string[];
  showDropdown?: boolean;
  selectedValue?: string;
}

/** A runtime-exposed filter condition (shown to users at report run time). */
interface QuickFilterCondition {
  dimTable: string; // '' = fact table; otherwise dim view name
  attribute: string; // column name within that table
  operator: string;
  value: string;
  conjunction: 'AND' | 'OR'; // how this condition joins the NEXT one (ignored for last)
  availableValues?: string[];
  showDropdown?: boolean;
  selectedValue?: string;
}

/** Structured condition attached to a single row's measure definition. */
interface RowFilterCondition {
  dimTable: string; // '' = fact table; otherwise the dim view name (e.g. 'dim_relationship_manager')
  attribute: string; // column name within that table
  operator: string;
  value: string;
}

export interface DwhField {
  name: string;
  displayName: string;
  sourceTable: string;
  type?: string;
}

export interface FieldGroup {
  category: string;
  sourceTable: string;
  fields: DwhField[];
}

@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    FieldPickerComponent,
    SidebarComponent,
    RowFilterComponent,
    CalendarPickerComponent,
    GranularityPickerComponent,
    GeneralFilterModalComponent,
    LiveLayoutPreviewComponent,
  ],

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
      <!-- Sidebar / Header -->
      <app-sidebar
        brandIcon="🛠️"
        brandText="Report Builder"
        [showBackButton]="true"
        backButtonText="← Cancel & Exit"
        collapsedBackButtonText="✕"
        [mobileOpen]="sidebarOpen()"
        (mobileOpenChange)="sidebarOpen.set($event)"
        (backClick)="goBack()"
      ></app-sidebar>

      <!-- ══════════════════════════════════════════ MAIN CONTENT -->
      <main class="main-content animate-fade-in">
        <!-- Top sticky action bar -->
        <header class="detail-header">
          <div>
            <div class="breadcrumbs">
              <a routerLink="/dashboard">Reports</a> / <span>Builder</span>
            </div>
            <h1>{{ isNewReport ? 'Create New Report' : 'Update Existing Report' }}</h1>
            <p class="report-subtitle">
              Define structural configurations, formulas, and filter details.
            </p>
          </div>

          <div class="action-buttons">
            <button (click)="togglePreview()" class="preview-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span>{{ showPreview() ? 'Hide Preview' : 'Preview Layout' }}</span>
            </button>
            <button (click)="previewSql()" class="btn-preview-sql">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
              <span>Preview SQL</span>
            </button>
            @if (viewOnlyMode) {
              @if (status === 'published') {
                <span class="status-lozenge published font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border border-emerald-500 text-emerald-400 bg-emerald-500/10">
                  👁️ View Only Mode (PUBLISHED v{{ reportVersion }})
                </span>
              } @else if (status === 'in_review') {
                <span class="status-lozenge in-review font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border border-amber-500 text-amber-400 bg-amber-500/10">
                  👁️ View Only Mode (IN REVIEW v{{ reportVersion }})
                </span>
              } @else {
                <span class="status-lozenge draft font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border border-slate-500 text-slate-400 bg-slate-500/10">
                  👁️ View Only Mode (DRAFT v{{ reportVersion }})
                </span>
              }
            } @else {
              @if (status === 'draft') {
                <button (click)="saveConfig()" [disabled]="saving()" class="save-btn">
                  @if (saving()) {
                    <span class="spinner"></span> Saving...
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <span>Save Definition</span>
                  }
                </button>
                <button (click)="submitForReview()" [disabled]="saving()" class="save-btn font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border" style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #fbbf24; cursor: pointer;">
                  <span>Submit for Review</span>
                </button>
              }

              @if (status === 'in_review') {
                <button (click)="rejectReport()" [disabled]="saving()" class="save-btn font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #f87171; cursor: pointer; margin-right: 8px;">
                  <span>Reject to Draft</span>
                </button>
                <button (click)="publishReport()" [disabled]="saving()" class="save-btn font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; cursor: pointer;">
                  <span>Publish Release</span>
                </button>
              }

              @if (status === 'published') {
                <span class="status-lozenge published font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border border-emerald-500 text-emerald-400 bg-emerald-500/10" style="margin-right: 8px;">
                  🔒 Published & Frozen (v{{ reportVersion }})
                </span>
                <button (click)="createDraftFromPublished()" [disabled]="saving()" class="save-btn font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; cursor: pointer;">
                  <span>✏️ Create New Draft Version</span>
                </button>
              }
            }
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
            <h3 class="section-title">
              🛑 Validation Diagnostics ({{ validationErrors().length }} Issues Found)
            </h3>
            <p class="section-desc">
              Resolve these logical, formula, or database catalog mismatch errors to ensure query
              and process safety.
            </p>
            <div class="diagnostics-grid">
              @for (
                err of validationErrors();
                track err.elementId + '-' + err.fieldContext + '-' + err.displayMessage
              ) {
                <div
                  class="diagnostic-item"
                  [class.critical]="err.errorSeverity === 'CRITICAL'"
                  [class.warning]="err.errorSeverity === 'WARNING'"
                >
                  <span class="item-icon">{{
                    err.errorSeverity === 'CRITICAL' ? '🛑' : '⚠️'
                  }}</span>
                  <div class="item-body">
                    <strong>{{ err.elementId }}</strong> ({{ err.fieldContext }}):
                    {{ err.displayMessage }}
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- ── Preview Modal ───────────────────────────────────── -->
        @if (showPreview()) {
          <app-live-layout-preview
            [columns]="columns"
            [rows]="rows"
            [reportingDate]="reportingDate"
            [granularities]="granularities()"
            [compiledSql]="compiledSql()"
            [isLoadingSql]="isLoadingSql()"
            [(activePreviewTab)]="activePreviewTab"
            [previewTrigger]="previewTrigger()"
          ></app-live-layout-preview>
        }

        <!-- ══════════════════════════════════════════════════════
             SECTION 1 — CORE REPORT DETAILS
        ═══════════════════════════════════════════════════════════ -->
        <section class="config-panel card">
          <h3 class="section-title">⚙️ Core Report Details</h3>

          <!-- Basic identity fields -->
          <div class="form-grid">
            <input
              type="hidden"
              id="report-id"
              [(ngModel)]="reportId"
            />

            <div class="form-group">
              <label for="report-name">Report Name*</label>
              <input
                type="text"
                id="report-name"
                [(ngModel)]="reportName"
                (ngModelChange)="triggerValidationDebounced()"
                [disabled]="isLocked"
                placeholder="e.g. Sales Weekly Report"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="report-version">Version</label>
              <input
                type="number"
                id="report-version"
                [(ngModel)]="reportVersion"
                readonly
                class="form-input bg-slate-900/50 cursor-not-allowed text-slate-400"
                title="Automatically versioned on publishing"
              />
            </div>

            <div class="form-group">
              <label>Report Status</label>
              <div class="status-badge-container" style="margin-top: 6px;">
                @if (status === 'published') {
                  <span class="status-lozenge published font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border">
                    🔒 Published
                  </span>
                } @else if (status === 'in_review' || status === 'in-review') {
                  <span class="status-lozenge in-review font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border">
                    ⏳ In Review
                  </span>
                } @else {
                  <span class="status-lozenge draft font-bold uppercase tracking-wider text-xs px-2.5 py-1 rounded-lg border">
                    📝 Draft
                  </span>
                }
              </div>
            </div>

            <!-- Granularity (bound to conformed keys / dynamic granularity fields) -->
            <div [formGroup]="reportForm" class="form-group">
              <label for="granularity" class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Report Granularity*</label>
              <div class="w-full">
                <app-granularity-picker
                  id="granularity"
                  [options]="dynamicGranularityOptions()"
                  formControlName="granularity"
                ></app-granularity-picker>
              </div>
            </div>

            <!-- Time Information Row -->
            <div class="time-information-row">
              <!-- Reporting Date (guarded database calendar picker) -->
              <div class="form-group reporting-date-group">
                <label for="reporting-date"
                  >Reporting Date <span class="label-hint">(from dim_date)</span></label
                >
                <div class="custom-datepicker-wrapper">
                  <!-- Trigger button showing current value or placeholder -->
                  <button
                    type="button"
                    id="reporting-date"
                    class="datepicker-trigger-btn"
                    [class.active]="showDatePicker()"
                    (click)="!isLocked && toggleDatePicker()"
                    [disabled]="isLocked"
                  >
                    <span>{{ reportingDate || '— select a reporting date —' }}</span>
                    <span class="calendar-icon">📅</span>
                  </button>

                  <!-- Click-outside handler backdrop -->
                  @if (showDatePicker()) {
                    <div class="datepicker-backdrop" (click)="showDatePicker.set(false)"></div>
                  }

                  <!-- Datepicker Dropdown Grid overlay -->
                  @if (showDatePicker()) {
                    <app-calendar-picker
                      [availableDates]="availableReportingDates"
                      [(selectedDate)]="reportingDate"
                      (dateSelected)="showDatePicker.set(false)"
                      (click)="$event.stopPropagation()"
                    ></app-calendar-picker>
                  }
                </div>
              </div>

              <!-- Timeframe Limit (redesigned with mode buttons) -->
              <div class="form-group timeframe-group-inline">
                <label>Timeframe Limit</label>
                <div class="timeframe-row">
                  <!-- Start Date Custom Calendar Picker -->
                  <div class="custom-datepicker-wrapper tf-start">
                    <button
                      type="button"
                      class="datepicker-trigger-btn"
                      [class.active]="showTimeframeStartDatePicker()"
                      (click)="!isLocked && showTimeframeStartDatePicker.set(!showTimeframeStartDatePicker())"
                      [disabled]="isLocked"
                    >
                      <span>{{ timeframeStart || '— select start date —' }}</span>
                      <span class="calendar-icon">📅</span>
                    </button>

                    @if (showTimeframeStartDatePicker()) {
                      <div class="datepicker-backdrop" (click)="showTimeframeStartDatePicker.set(false)"></div>
                    }

                    @if (showTimeframeStartDatePicker()) {
                      <app-calendar-picker
                        [availableDates]="availableReportingDates"
                        [(selectedDate)]="timeframeStart"
                        (dateSelected)="showTimeframeStartDatePicker.set(false)"
                        (click)="$event.stopPropagation()"
                      ></app-calendar-picker>
                    }
                  </div>
                  <span class="tf-arrow">→</span>
                  <div class="tf-end-group">
                    <div class="mode-btn-group" role="group">
                      <button
                        type="button"
                        class="mode-btn"
                        [class.active]="timeframeMode === 'today_minus_2'"
                        (click)="!isLocked && setTimeframeMode('today_minus_2')"
                        [disabled]="isLocked"
                        title="Today minus 2 calendar days"
                      >
                        Today − 2
                      </button>
                      <button
                        type="button"
                        class="mode-btn"
                        [class.active]="timeframeMode === 'today_minus_1'"
                        (click)="!isLocked && setTimeframeMode('today_minus_1')"
                        [disabled]="isLocked"
                        title="Today minus 1 calendar day"
                      >
                        Today − 1
                      </button>
                      <button
                        type="button"
                        class="mode-btn"
                        [class.active]="timeframeMode === 'today'"
                        (click)="!isLocked && setTimeframeMode('today')"
                        [disabled]="isLocked"
                        title="Today (current date)"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        class="mode-btn"
                        [class.active]="timeframeMode === 'custom'"
                        (click)="!isLocked && setTimeframeMode('custom')"
                        [disabled]="isLocked"
                        title="Pick a specific date from dim_date or calendar"
                      >
                        Custom ▾
                      </button>
                    </div>
                    @if (timeframeMode === 'custom') {
                      <div class="custom-datepicker-wrapper">
                        <!-- Trigger button showing current value or placeholder -->
                        <button
                          type="button"
                          class="datepicker-trigger-btn"
                          [class.active]="showTimeframeEndDatePicker()"
                          (click)="!isLocked && toggleTimeframeEndDatePicker()"
                          [disabled]="isLocked"
                        >
                          <span>{{ timeframeEnd || '— select end date —' }}</span>
                          <span class="calendar-icon">📅</span>
                        </button>

                        <!-- Click-outside handler backdrop -->
                        @if (showTimeframeEndDatePicker()) {
                          <div class="datepicker-backdrop" (click)="showTimeframeEndDatePicker.set(false)"></div>
                        }

                        <!-- Datepicker Dropdown Grid overlay -->
                        @if (showTimeframeEndDatePicker()) {
                          <app-calendar-picker
                            [availableDates]="availableReportingDates"
                            [(selectedDate)]="timeframeEnd"
                            (dateSelected)="showTimeframeEndDatePicker.set(false)"
                            (click)="$event.stopPropagation()"
                          ></app-calendar-picker>
                        }
                      </div>
                    } @else {
                      <span class="computed-date-badge">{{ computedTimeframeEnd }}</span>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Consolidated Filters Row ── -->
          <div class="filters-row-container">
            <!-- ── Quick Filters ──────────────────────────────────────────────── -->
            <div [formGroup]="reportForm" class="form-group filters-builder">
              <div class="flex-header">
                <label for="quickFiltersPicker" class="font-sans text-xs font-bold text-slate-800 tracking-tight uppercase">
                  Quick Filters
                  <span class="text-[11px] text-slate-400 font-medium font-sans lowercase normal-case tracking-normal ml-1">(runtime-exposed filter dimensions)</span>
                </label>
              </div>
              <div class="w-full mt-2">
                <app-granularity-picker
                  id="quickFiltersPicker"
                  [options]="dynamicGranularityOptions()"
                  formControlName="quickFilters"
                ></app-granularity-picker>
              </div>
            </div>

            <!-- ── General Filters ───────────────────────────────────────────── -->
            <div class="form-group filters-builder">
              <div class="flex-header">
                <label class="font-sans text-xs font-bold text-slate-800 tracking-tight uppercase">
                  General Filters
                  <span class="text-[11px] text-slate-400 font-medium font-sans lowercase normal-case tracking-normal ml-1">(multi-table query constraints modal)</span>
                </label>
              </div>
              <div class="row-filter-wrapper flex flex-col gap-2 mt-2">
                <div class="flex items-center justify-between">
                  <button type="button" 
                          (click)="isGeneralFilterModalOpen.set(true)" 
                          [disabled]="isLocked"
                          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Configure General Filters
                  </button>
                  <span *ngIf="isGeneralFilterRawMode" class="font-sans text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full uppercase tracking-wider ml-2">
                    Custom SQL Mode Active
                  </span>
                </div>

                <!-- Display active scopes summary -->
                <div class="active-scopes-list grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <ng-container *ngIf="!isGeneralFilterRawMode && generalFilterScopes().length > 0">
                    <div *ngFor="let sc of generalFilterScopes()" 
                         class="border border-slate-200 bg-slate-50/40 rounded-xl p-3 flex flex-col gap-1 shadow-sm hover:shadow-md transition-all duration-200 ease-out">
                      <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span class="text-xs font-bold text-slate-800 font-sans tracking-tight uppercase">
                          {{ sc.tableName.replace('analytics.', '') }}
                        </span>
                      </div>
                      <div class="font-mono text-[11px] text-indigo-600 bg-white border border-slate-150 rounded-lg px-2.5 py-1.5 font-medium tracking-tight whitespace-pre-wrap leading-relaxed">
                        {{ getGeneralFilterSummary(sc.filtersGroup) }}
                      </div>
                    </div>
                  </ng-container>
                  
                  <div *ngIf="isGeneralFilterRawMode && generalFilterExpr" 
                       class="col-span-full border border-slate-200 bg-slate-50/40 rounded-xl p-3 flex flex-col gap-1 shadow-sm hover:shadow-md transition-all duration-200 ease-out">
                    <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span class="text-xs font-bold text-slate-800 font-sans tracking-tight uppercase">
                        CUSTOM SQL FORMULA
                      </span>
                      <span class="font-sans text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Raw SQL
                      </span>
                    </div>
                    <div class="font-mono text-[11px] text-indigo-600 bg-white border border-slate-150 rounded-lg px-2.5 py-1.5 font-medium tracking-tight whitespace-pre-wrap leading-relaxed">
                      {{ generalFilterExpr }}
                    </div>
                  </div>

                  <div *ngIf="!isGeneralFilterRawMode && generalFilterScopes().length === 0" 
                       class="col-span-full p-6 text-center text-xs text-slate-400 italic bg-slate-50/30 border border-dashed border-slate-200 rounded-xl font-sans">
                    No active general filter scopes configured.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ══════════════════════════════════════════════════════
             SECTION 2 — ROWS SETUP (Step 1)
        ═══════════════════════════════════════════════════════════ -->
        <section class="rows-section card">
          <div class="flex-header">
            <div>
              <h3 class="section-title">Rows Setup (Step 1)</h3>
              <p class="section-desc">
                Define rows, labels, visual measure builders, and row-level filter conditions.
              </p>
            </div>
            <div class="table-actions">
              <button (click)="addRow()" [disabled]="isLocked" class="action-btn-sm add">+ Add Row</button>
              <button (click)="deleteSelectedRows()" [disabled]="isLocked" class="action-btn-sm delete-selected">
                🗑️ Delete Selected
              </button>
              <button (click)="resetRows()" [disabled]="isLocked" class="action-btn-sm reset">↻ Reset</button>
              <button (click)="duplicateSelectedRow()" [disabled]="isLocked" class="action-btn-sm duplicate">
                📄 Duplicate
              </button>
              <button (click)="reorderRows()" [disabled]="isLocked" class="action-btn-sm reorder">➔ Reorder</button>
            </div>
          </div>

          <div class="rows-container-layout" [class.picker-closed]="!isFieldPickerOpen()">
            <!-- Left Side: Searchable DWH Catalog Tree -->
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
            <!-- Stable Fixed-Width Worksheet Layout -->
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
                  @for (row of rows; track row.rowId; let idx = $index) {
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
                        <input type="checkbox" [(ngModel)]="row.selected" [disabled]="isLocked" />
                      </td>

                      <!-- Track 2: Row ID -->
                      <td class="col-row-id sticky-col-2">
                        <div class="row-id-cell">
                          <input
                            type="text"
                            [(ngModel)]="row.rowId"
                            [disabled]="isLocked"
                            (ngModelChange)="triggerValidationDebounced()"
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
                            (click)="changeIndent(row, -1); triggerValidationDebounced()"
                            [disabled]="isLocked"
                            class="indent-btn"
                            title="Decrease indent"
                          >
                            «
                          </button>
                          <button
                            (click)="changeIndent(row, 1); triggerValidationDebounced()"
                            [disabled]="isLocked"
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
                            [disabled]="isLocked"
                            (ngModelChange)="triggerValidationDebounced()"
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
                            [disabled]="isLocked"
                            (change)="onRowTypeChange(row); triggerValidationDebounced()"
                            class="cell-select"
                          >
                            <option value="data">📊 data</option>
                            <option value="calc">🧮 calc</option>
                            <option value="section">📂 section</option>
                            <option value="blank">🫙 blank</option>
                          </select>
                          <select
                            [(ngModel)]="row.style"
                            [disabled]="isLocked"
                            (ngModelChange)="triggerValidationDebounced()"
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
                          <div class="flex items-center gap-2 w-full">
                            <select
                              [(ngModel)]="row.aggregation"
                              class="w-[140px] border border-slate-700 rounded-lg bg-slate-950 px-2 py-1"
                              [disabled]="isLocked"
                            >
                              @for (opt of aggregationOptions; track opt.value) {
                                <option [value]="opt.value">{{ opt.label }}</option>
                              }
                            </select>

                            <span class="text-xs text-slate-500">of</span>

                            <app-field-picker
                              [dwhCatalog]="dwhCatalogCache()"
                              [selectedValue]="row.targetField"
                              [disabled]="isLocked"
                              (onSelect)="updateRowField(row.rowId, $event)"
                            >
                            </app-field-picker>
                          </div>
                        } @else if (row.type === 'calc') {
                          <input
                            type="text"
                            [(ngModel)]="row.formulaExpr"
                            class="w-full font-mono text-sm bg-slate-950 rounded-lg border border-slate-700 px-3 py-1 text-blue-400"
                            [disabled]="isLocked"
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
                              [dwhCatalog]="dwhCatalogCache()"
                              [linkedDimensions]="linkedDimensions"
                              [columnTypes]="columnTypesCache"
                              [rowFilters]="row.rowFilters"
                              [(legacyFilterExpr)]="row.legacyFilterExpr"
                              [(isRawMode)]="row.isFilterRawMode"
                              [disabled]="isLocked"
                              (onChange)="row.rowFilters = $event; triggerValidationDebounced()"
                              (legacyFilterExprChange)="triggerValidationDebounced()"
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
                        <div class="col-enable-toggles" [style.pointer-events]="isLocked ? 'none' : 'auto'">
                          @for (col of columns; track col.colId) {
                            <span
                              class="col-badge"
                              [class.active]="row.activeCols.includes(col.colId.toUpperCase())"
                              [style.opacity]="isLocked ? '0.7' : '1'"
                              (click)="!isLocked && toggleColForRow(row, col.colId)"
                              >{{ col.colId }}</span>
                          }
                        </div>
                      </td>

                      <!-- Actions -->
                      <td class="col-actions" style="text-align:center">
                        <button (click)="deleteRow(idx)" [disabled]="isLocked" class="remove-btn" title="Delete Row">
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

        <!-- ══════════════════════════════════════════════════════
             SECTION 3 — COLUMNS SETUP (Step 2)  — unchanged
        ═══════════════════════════════════════════════════════════ -->
        <section class="columns-section card">
          <div class="flex-header">
            <div>
              <h3 class="section-title">Columns Setup (Step 2)</h3>
              <p class="section-desc">
                Define column headers, level layouts, timeframe types, rolling offsets, and
                formulas.
              </p>
            </div>
            <div class="table-actions">
              <button (click)="addColumn()" [disabled]="isLocked" class="action-btn-sm add">+ Add Col</button>
              <button (click)="deleteSelectedCols()" [disabled]="isLocked" class="action-btn-sm delete-selected">
                🗑️ Delete Selected
              </button>
              <button (click)="resetColumns()" [disabled]="isLocked" class="action-btn-sm reset">↻ Reset</button>
              <button (click)="duplicateSelectedColumn()" [disabled]="isLocked" class="action-btn-sm duplicate">
                📄 Duplicate
              </button>
              <button (click)="reorderColumns()" [disabled]="isLocked" class="action-btn-sm reorder">➔ Reorder</button>
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
                  <th style="width:140px">Parent L1</th>
                  <th style="width:150px">Formula / Expression</th>
                  <th style="width:130px">Header Style</th>
                  <th style="width:90px">Period Offset</th>
                  <th style="width:120px">Timeframe Length</th>
                  <th style="width:130px">Period Type</th>
                  <th style="width:180px">Math Formula / Calc Expression</th>
                  <th style="width:60px;text-align:center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (col of columns; track col.colId; let idx = $index) {
                  <tr
                    [class.selected]="col.selected"
                    [class.has-critical]="hasError(col.colId, 'CRITICAL')"
                    [class.has-warning]="hasError(col.colId, 'WARNING')"
                    [title]="hasError(col.colId) ? getErrorMessage(col.colId) : ''"
                    [style.background]="col.tierLevel === 'L2' ? 'rgba(99, 102, 241, 0.08)' : ''"
                  >
                    <td><input type="checkbox" [(ngModel)]="col.selected" [disabled]="isLocked" /></td>
                    <td>
                      <div class="row-id-cell">
                        <input
                          type="text"
                          [(ngModel)]="col.colId"
                          [disabled]="isLocked"
                          (ngModelChange)="triggerValidationDebounced()"
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
                          [disabled]="isLocked"
                          (ngModelChange)="triggerValidationDebounced()"
                          placeholder="Column Header Label"
                          class="cell-input"
                          [style.padding-left]="col.tierLevel === 'L2' ? '32px' : '8px'"
                        />
                      </div>
                    </td>
                    <td>
                      <select
                        [(ngModel)]="col.tierLevel"
                        [disabled]="isLocked"
                        (ngModelChange)="onTierLevelChange(col); triggerValidationDebounced()"
                        class="cell-select"
                      >
                        <option value="L1">L1 Parent</option>
                        <option value="L2">L2 Child</option>
                      </select>
                    </td>
                    <td>
                      <select
                        [(ngModel)]="col.parentId"
                        [disabled]="col.tierLevel !== 'L2' || isLocked"
                        (ngModelChange)="triggerValidationDebounced()"
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
                        [disabled]="isLocked"
                        (ngModelChange)="onColTypeChange(col); triggerValidationDebounced()"
                        class="cell-select"
                      >
                        <option value="WTD">WTD</option>
                        <option value="MTD">MTD</option>
                        <option value="YTD">YTD</option>
                        <option value="ROLLING">ROLLING</option>
                        <option value="CALC">CALC</option>
                        <option value="HEADER">HEADER</option>
                      </select>
                    </td>
                    <td>
                      <select
                        [(ngModel)]="col.headerLayout"
                        [disabled]="isLocked"
                        (ngModelChange)="triggerValidationDebounced()"
                        class="cell-select"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold, Center</option>
                        <option value="border">Bold, Border</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        [(ngModel)]="col.periodOffset"
                        (ngModelChange)="triggerValidationDebounced()"
                        [disabled]="col.colType === 'CALC' || col.colType === 'HEADER' || isLocked"
                        class="cell-input center"
                      />
                    </td>
                    <td>
                      <div class="rolling-cell" style="display: flex; align-items: center; gap: 4px;">
                        <input
                          type="number"
                          [(ngModel)]="col.rollingN"
                          (ngModelChange)="triggerValidationDebounced()"
                          [disabled]="col.colType === 'CALC' || col.colType === 'HEADER' || isLocked"
                          placeholder="1"
                          class="cell-input center rolling-n-input"
                          style="width: 45px;"
                          title="Timeframe length count"
                        />
                        @if (col.colType === 'WTD') {
                          <span style="font-size: 11px; color: #94A3B8;">wks</span>
                        } @else if (col.colType === 'MTD') {
                          <span style="font-size: 11px; color: #94A3B8;">mos</span>
                        } @else if (col.colType === 'YTD') {
                          <span style="font-size: 11px; color: #94A3B8;">yrs</span>
                        } @else if (col.colType === 'ROLLING') {
                          <select
                            [(ngModel)]="col.rollingGrain"
                            (ngModelChange)="triggerValidationDebounced()"
                            class="cell-select rolling-grain-select"
                            title="Time grain for this rolling window"
                            [disabled]="isLocked"
                            style="width: 65px; font-size: 11px; padding: 2px;"
                          >
                            <option value="DAY">Days</option>
                            <option value="WEEK">Weeks</option>
                            <option value="MONTH">Months</option>
                            <option value="YEAR">Years</option>
                          </select>
                        }
                      </div>
                    </td>
                    <td>
                      <select
                        [(ngModel)]="col.periodType"
                        [disabled]="isLocked"
                        (ngModelChange)="triggerValidationDebounced()"
                        class="cell-select"
                      >
                        <option value="">-- None --</option>
                        <option value="CURRENT_YEAR">Current Year</option>
                        <option value="PREVIOUS_YEAR">Previous Year</option>
                        <option value="BOTH_YEARS">Both Years</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        [(ngModel)]="col.formulaExpr"
                        (ngModelChange)="triggerValidationDebounced()"
                        [placeholder]="col.colType === 'CALC' ? 'e.g. (C1-C2)/C2' : '-'"
                        [disabled]="col.tierLevel === 'L1' || col.colType !== 'CALC' || isLocked"
                        class="cell-input code"
                      />
                    </td>
                    <td style="text-align:center">
                      <button (click)="deleteColumn(idx)" [disabled]="isLocked" class="remove-btn" title="Delete Column">
                        🗑️
                      </button>
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
                  <p class="modal-subtitle">
                    Dry-run matrix compilation. View query before saving configuration.
                  </p>
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
                    <pre><code class="language-sql" [innerHTML]="getHighlightedSql(previewSqlText())"></code></pre>
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
      <!-- Global General Filters Modal Overlay -->
      <app-general-filter-modal
        [(isOpen)]="isGeneralFilterModalOpen"
        [(scopes)]="generalFilterScopes"
        [(isRawMode)]="isGeneralFilterRawMode"
        [(legacyFilterExpr)]="generalFilterExpr"
        [dwhCatalog]="dwhCatalogCache()"
        [linkedDimensions]="conformedDimensions()"
        [columnTypes]="columnTypesCache"
        [disabled]="isLocked"
        (onApply)="triggerValidationDebounced()"
      ></app-general-filter-modal>
    </div>
  `,
  styles: [
    `
      .builder-container {
        display: flex;
        min-height: 100vh;
        background: var(--color-apple-bg);
        color: var(--color-apple-text);
        font-family: 'Inter', sans-serif;
      }

      /* ── Sidebar ────────────────────────────────────── */
      .sidebar {
        width: 260px;
        background: var(--color-apple-card);
        border-right: 1px solid var(--border-color);
        backdrop-filter: blur(12px);
        display: flex;
        flex-direction: column;
        padding: 24px;
        gap: 32px;
        flex-shrink: 0;
        transition:
          width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          padding 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          gap 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          background 0.3s ease;
      }

      .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        transition:
          gap 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          flex-direction 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .brand-icon {
        font-size: 28px;
        transition: transform 0.3s ease-in-out;
      }
      .brand-text {
        font-size: 20px;
        font-weight: 700;
        color: var(--color-apple-text);
        white-space: nowrap;
        transition:
          opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
          max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 180px;
        opacity: 1;
        overflow: hidden;
      }

      .menu-collapse-btn {
        background: none;
        border: none;
        color: var(--color-apple-grey);
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
        color: var(--color-apple-text);
        background: var(--border-color);
      }

      .sidebar-menu {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-grow: 1;
        width: 100%;
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
      .menu-item:hover {
        color: var(--color-apple-text);
        background: var(--border-color);
      }
      .menu-icon {
        font-size: 18px;
      }
      .menu-text {
        white-space: nowrap;
        transition:
          opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
          max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 180px;
        opacity: 1;
        overflow: hidden;
      }

      .sidebar-user {
        width: 100%;
        display: flex;
        justify-content: center;
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
        white-space: nowrap;
      }
      .back-btn:hover {
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.3);
        color: #fca5a5;
      }

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
        .sidebar.collapsed .back-btn {
          padding: 10px;
          font-size: 14px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        app-sidebar.collapsed + .main-content {
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
        font-size: 32px;
        font-weight: 800;
        margin: 0;
        letter-spacing: -1px;
      }
      .report-subtitle {
        font-size: 15px;
        color: var(--color-apple-grey);
        margin: 4px 0 0 0;
      }

      .action-buttons {
        display: flex;
        gap: 12px;
      }

      .preview-btn {
        padding: 12px 24px;
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        color: var(--color-apple-text);
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
      }
      .btn-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        stroke-width: 2px;
      }
      .preview-btn:hover {
        background: var(--border-color);
        border-color: var(--color-apple-blue);
      }

      .save-btn {
        padding: 12px 24px;
        background: var(--color-apple-blue);
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
      }
      .save-btn:hover:not(:disabled) {
        background: var(--color-apple-blue);
        box-shadow: 0 6px 16px rgba(0, 118, 223, 0.4);
      }
      .save-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* ── Cards ──────────────────────────────────────── */
      .card {
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        padding: 32px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .section-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0;
        color: var(--color-apple-text);
      }
      .section-desc {
        font-size: 14px;
        color: var(--color-apple-grey);
        margin: 4px 0 0 0;
      }

      /* ── Form elements ──────────────────────────────── */
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-group label {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-apple-grey);
      }

      .label-hint {
        font-size: 11px;
        font-weight: 400;
        color: var(--color-apple-grey);
        margin-left: 4px;
      }

      .field-hint {
        font-size: 11px;
        color: var(--color-apple-grey);
        font-style: italic;
      }

      .form-input,
      .form-select {
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px 14px;
        color: var(--color-apple-text);
        outline: none;
        font-size: 14px;
        font-family: inherit;
        transition: all 0.2s ease;
      }
      .form-input:focus,
      .form-select:focus {
        border-color: var(--color-apple-blue);
        box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.2);
      }
      .form-input:disabled,
      .form-select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .form-select.sm,
      .form-input.sm {
        padding: 6px 10px;
        font-size: 12px;
      }

      /* ── Time Information Row ────────────────────────── */
      .time-information-row {
        grid-column: 1 / -1;
        display: flex;
        align-items: flex-start;
        gap: 24px;
        width: 100%;
      }

      .reporting-date-group {
        flex: 0 0 300px;
      }

      .timeframe-group-inline {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      @media (max-width: 1024px) {
        .time-information-row {
          flex-direction: column;
          gap: 16px;
        }
        .reporting-date-group {
          flex: 1 1 auto;
          width: 100%;
        }
      }

      .timeframe-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .tf-start {
        flex: 0 0 180px;
      }
      .tf-arrow {
        color: var(--color-apple-grey);
        font-size: 18px;
      }

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
        border: 1px solid var(--border-color);
      }

      .mode-btn {
        padding: 8px 14px;
        background: var(--input-bg);
        border-right: 1px solid var(--border-color);
        color: var(--color-apple-grey);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
      }
      .mode-btn:last-child {
        border-right: none;
      }
      .mode-btn:hover {
        background: rgba(0, 118, 223, 0.1);
        color: var(--color-apple-blue);
      }
      .mode-btn.active {
        background: rgba(0, 118, 223, 0.25);
        color: var(--color-apple-blue);
        box-shadow: inset 0 1px 0 rgba(0, 118, 223, 0.3);
      }

      .tf-end {
        flex: 0 0 160px;
      }

      .tf-end-select {
        min-width: 200px;
      }

      .computed-date-badge {
        padding: 8px 14px;
        background: var(--input-bg);
        border: 1px solid rgba(0, 118, 223, 0.2);
        border-radius: 8px;
        color: var(--color-apple-blue);
        font-size: 13px;
        font-weight: 600;
        font-family: 'Fira Code', monospace;
        white-space: nowrap;
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
        background: rgba(0, 118, 223, 0.1);
        border: 1px dashed rgba(0, 118, 223, 0.3);
        border-radius: 8px;
        color: var(--color-apple-blue);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .add-sub-btn:hover {
        background: rgba(0, 118, 223, 0.2);
        border-color: var(--color-apple-blue);
        color: var(--color-apple-text);
      }

      .empty-filters {
        font-size: 13px;
        color: var(--color-apple-grey);
        margin: 4px 0;
        font-style: italic;
      }

      .filters-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .filter-row {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--input-bg);
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        flex-wrap: wrap;
      }

      .dim-select {
        max-width: 160px;
        color: #d8b4fe;
        font-weight: 600;
      }
      .form-select.sm.operator {
        width: 180px;
        color: var(--color-apple-blue);
        font-weight: 600;
        text-align: center;
      }

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
      .remove-btn:hover {
        background: rgba(239, 68, 68, 0.1);
      }

      /* ── Grid tables (rows/columns) ─────────────────── */
      .table-wrapper {
        overflow-x: auto;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        background: var(--input-bg);
      }

      .rows-table-wrapper {
        overflow-x: auto;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        max-width: 100%;
        position: relative;
        height: auto;
        min-height: 450px;
        max-height: 860px;
      }

      .grid-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 13px;
        text-align: left;
      }

      .grid-table th {
        background: var(--color-apple-bg);
        color: var(--color-apple-grey);
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.5px;
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
        white-space: nowrap;
      }

      .grid-table td {
        padding: 8px 10px;
        border-bottom: 1px solid var(--border-color);
        vertical-align: middle;
      }

      .grid-table tr.selected {
        background: rgba(0, 118, 223, 0.05);
      }

      /* ═══════════════════════════════════════════════════════════════════════
       Static-Width Layout Pattern for Rows Setup worksheet.
       Uses exact, unyielding pixel dimensions across all headers and rows
       via the .worksheet-fixed-row class to enforce absolute vertical alignment.

       Track layout:
         1  32px   — Checkbox (.col-checkbox)
         2  64px   — Row ID (.col-row-id)
         3  64px   — Hierarchy (.col-hierarchy)
         4  240px  — Row Name (.col-row-name)
         5  190px  — Style / Layout (.col-style-layout)
         6  460px  — Measure Definition (.col-measure-def)
         7  340px  — Conditions (.col-conditions)
         8  200px  — Active Columns (.col-active-cols)
         9  42px   — Actions (.col-actions)
    ═══════════════════════════════════════════════════════════════════════ */
      .rows-grid {
        width: 100%;
        border-collapse: collapse;
      }

      .worksheet-fixed-row {
        display: flex;
        width: 100%;
        min-width: max-content; /* Guarantees the row container never snaps or compresses prematurely */
        align-items: center;
        gap: 16px; /* Clean, uniform horizontal separation between inputs */
      }

      .col-checkbox {
        width: 32px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .col-row-id {
        width: 64px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .col-hierarchy {
        width: 64px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .col-row-name {
        width: 240px;
        flex-shrink: 0;
        flex-grow: 1;
        display: flex;
        align-items: center;
        box-sizing: border-box;
      }
      .col-style-layout {
        width: 190px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        box-sizing: border-box;
      }
      .col-measure-def {
        width: 480px;
        flex-shrink: 0;
        flex-grow: 2;
        display: flex;
        align-items: center;
        box-sizing: border-box;
      }
      .col-conditions {
        width: 260px;
        flex-shrink: 0;
        flex-grow: 1;
        display: flex;
        align-items: center;
        box-sizing: border-box;
      }
      .col-active-cols {
        width: 200px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        box-sizing: border-box;
      }
      .col-actions {
        width: 42px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }

      /* All th/td inside the rows grid: flex, min-width:0, overflow hidden */
      .rows-grid .worksheet-fixed-row > th,
      .rows-grid .worksheet-fixed-row > td {
        display: flex;
        align-items: center;
        box-sizing: border-box;
        min-width: 0; /* critical: prevents cells from overflowing their track */
        overflow: hidden;
        padding: 0 2px;
      }

      /* Enforce strict containment on every column cell wrapper div container */
      .row-id-cell,
      .indent-btns-cell,
      .label-cell-inner,
      .style-cell,
      .measure-custom-row,
      .measure-builder-row,
      .row-filter-wrapper,
      .col-enable-toggles {
        min-width: 0 !important;
        overflow: hidden !important;
        width: 100%;
        box-sizing: border-box;
      }

      /* Sticky left columns — Tracks 1, 2 (checkbox, row-id) */
      .rows-grid .sticky-col-1 {
        position: sticky;
        left: 0;
        z-index: 10;
        background: var(--color-apple-card);
        justify-content: center;
        border-right: 1px solid var(--border-color);
      }
      .rows-grid .sticky-col-2 {
        position: sticky;
        left: 48px; /* col-checkbox (32px) + gap (16px) */
        z-index: 10;
        background: var(--color-apple-card);
        border-right: 1px solid var(--border-color);
      }
      /* Elevate header sticky cells above body sticky cells and align background */
      .rows-grid thead .sticky-col-1,
      .rows-grid thead .sticky-col-2 {
        z-index: 12;
        background: var(--color-apple-card) !important;
      }
      .rows-grid tr:hover td.sticky-col-1,
      .rows-grid tr:hover td.sticky-col-2 {
        background: var(--border-color) !important;
      }
      .rows-grid tr.selected td.sticky-col-1,
      .rows-grid tr.selected td.sticky-col-2 {
        background: rgba(0, 118, 223, 0.15) !important;
      }

      /* Enhanced Header Row Prominence Styling */
      .rows-grid thead tr.worksheet-fixed-row {
        background: var(--color-apple-card) !important;
        border-bottom: 2px solid var(--border-color) !important;
      }
      .rows-grid thead tr.worksheet-fixed-row th {
        background: var(--color-apple-card) !important;
        color: var(--color-apple-text) !important;
        font-weight: 800 !important;
        font-size: 11px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        border-right: 1px solid var(--border-color);
        border-bottom: 2px solid var(--border-color);
      }
      .rows-grid thead tr.worksheet-fixed-row th:last-child {
        border-right: none;
      }

      .w-full {
        width: 100% !important;
      }

      .overflow-x-auto {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
      }

      /* Allow dropdown popover to overflow cells when active or open */
      .rows-grid td.col-measure-def:focus-within,
      .rows-grid td.col-measure-def:has(app-field-picker.is-open),
      .rows-grid td.col-conditions:focus-within,
      .rows-grid td.col-conditions:has(app-row-filter.is-open) {
        overflow: visible !important;
        z-index: 100 !important;
      }
      .rows-grid td.col-conditions:has(app-row-filter.is-open) .row-filter-wrapper {
        overflow: visible !important;
      }

      .rows-grid tbody tr:focus-within,
      .rows-grid tbody tr:has(app-field-picker.is-open),
      .rows-grid tbody tr:has(app-row-filter.is-open),
      .rows-grid .worksheet-fixed-row:focus-within,
      .rows-grid .worksheet-fixed-row:has(app-field-picker.is-open),
      .rows-grid .worksheet-fixed-row:has(app-row-filter.is-open) {
        position: relative;
        z-index: 50 !important;
        overflow: visible !important;
      }

      /* Bug fix #4: label inner wrapper fills its track and lets input grow */
      .label-cell-inner {
        display: flex;
        align-items: center;
        width: 100%;
        min-width: 0;
      }
      .label-cell-inner .cell-input {
        flex: 1 1 0;
        min-width: 0;
        width: 100%;
      }

      /* Indent buttons cell: centered, does not grow */
      .indent-btns-cell {
        display: flex;
        align-items: center;
        gap: 4px;
        justify-content: center;
      }

      /* Track-specific alignment overrides */
      .rows-grid .rg-col-check {
        justify-content: center;
      }
      .rows-grid .rg-col-actions {
        justify-content: center;
      }
      .rows-grid .rg-col-active {
        flex-wrap: wrap;
        gap: 4px;
      }

      /* Standard column constraints (preserved for Step 2) */
      .columns-section .grid-table td:nth-child(4) {
        width: 170px;
        min-width: 170px;
      }
      .columns-section .grid-table td:nth-child(7) {
        width: 200px;
        min-width: 160px;
      }
      .columns-section .grid-table td:nth-child(8) {
        width: 60px;
        min-width: 60px;
        text-align: center;
      }

      /* Global drag cursors and body override */
      body.col-resizing,
      body.col-resizing * {
        cursor: col-resize !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }

      .cell-input,
      .cell-select {
        width: 100%;
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 6px 10px;
        color: var(--color-apple-text);
        outline: none;
        font-size: 12px;
        font-family: inherit;
        box-sizing: border-box;
        transition: all 0.15s ease;
      }
      .cell-input:focus,
      .cell-select:focus {
        border-color: var(--color-apple-blue);
        background: var(--input-bg);
        box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.25);
      }
      .cell-input.center {
        text-align: center;
      }
      .cell-input.code {
        font-family: 'Fira Code', monospace;
        color: var(--color-apple-blue);
      }

      .grid-table .sticky-col-2 .cell-input {
        min-width: 60px;
      }

      .indent-wrapper {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .indent-btn {
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        color: var(--color-apple-grey);
        cursor: pointer;
        font-size: 10px;
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.15s ease;
      }
      .indent-btn:hover {
        color: var(--color-apple-text);
        background: rgba(0, 118, 223, 0.2);
        border-color: rgba(0, 118, 223, 0.4);
      }

      .style-cell {
        display: flex;
        gap: 6px;
      }
      .style-cell .cell-select {
        flex: 1 1 80px;
        min-width: 75px;
      }

      .cell-na {
        font-size: 12px;
        color: var(--color-apple-grey);
        font-style: italic;
      }

      /* ── Measure builder ────────────────────────────── */
      .measure-td {
        min-width: 300px;
      }

      .measure-builder-row {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
      }

      .measure-custom-row {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
      }

      .agg-select {
        flex: 0 0 85px;
        font-weight: 700;
        color: #34d399;
        background: rgba(16, 185, 129, 0.08);
        border-color: rgba(16, 185, 129, 0.2);
      }

      .measure-of {
        font-size: 11px;
        color: var(--color-apple-grey);
        font-style: italic;
        flex-shrink: 0;
        margin: 0 2px;
      }

      .col-select {
        flex: 1 1 140px;
        min-width: 110px;
        color: var(--color-apple-blue);
        text-overflow: ellipsis;
        overflow: hidden;
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
        background: rgba(0, 118, 223, 0.08);
        border-color: rgba(0, 118, 223, 0.25);
        color: var(--color-apple-blue);
      }
      .mode-toggle-btn.sql:hover {
        background: rgba(0, 118, 223, 0.18);
        color: var(--color-apple-text);
      }
      .mode-toggle-btn.visual {
        background: rgba(16, 185, 129, 0.08);
        border-color: rgba(16, 185, 129, 0.25);
        color: #34d399;
      }
      .mode-toggle-btn.visual:hover {
        background: rgba(16, 185, 129, 0.18);
        color: var(--color-apple-text);
      }

      /* AND / OR conjunction row between quick-filter conditions */
      .conjunction-row {
        display: flex;
        align-items: center;
        padding: 4px 0 4px 10px;
      }
      .conjunction-toggle-pill {
        display: inline-flex;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        overflow: hidden;
        background: transparent;
      }
      .conj-btn {
        padding: 4px 12px;
        background: transparent;
        border: none;
        color: var(--color-apple-grey);
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s ease;
        letter-spacing: 0.5px;
      }
      .conj-btn:hover {
        background: rgba(0, 118, 223, 0.1);
        color: var(--color-apple-blue);
      }
      .conj-btn.active {
        background: rgba(0, 118, 223, 0.22);
        color: var(--color-apple-blue);
      }

      /* ── Filter row (shared by Quick Filters & General Filters) ── */
      .filters-builder {
      }

      .filter-td {
        min-width: 240px;
        vertical-align: top;
      }

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
        background: rgba(0, 118, 223, 0.1);
        border: 1px solid rgba(0, 118, 223, 0.2);
        border-radius: 12px;
        font-size: 11px;
        color: var(--color-apple-blue);
        white-space: nowrap;
      }

      .ft-dim {
        color: #d8b4fe;
        font-weight: 700;
      }
      .ft-attr {
        color: var(--color-apple-blue);
        font-weight: 600;
      }
      .ft-op {
        color: var(--color-apple-grey);
        font-style: italic;
        margin: 0 2px;
      }
      .ft-val {
        color: var(--color-apple-text);
      }
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
        background: rgba(0, 118, 223, 0.08);
        border: 1px dashed rgba(0, 118, 223, 0.25);
        border-radius: 6px;
        color: var(--color-apple-blue);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .add-row-filter-btn:hover {
        background: rgba(0, 118, 223, 0.18);
        border-color: var(--color-apple-blue);
        color: var(--color-apple-text);
      }

      /* Inline row filter builder */
      .row-filter-builder {
        background: var(--color-apple-card);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      }

      .rfb-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        width: 100%;
      }

      .rfb-table {
        grid-column: span 1;
        color: #d8b4fe;
        font-weight: 600;
      }
      .rfb-attr {
        grid-column: span 1;
      }
      .rfb-op {
        grid-column: span 1;
        color: var(--color-apple-blue);
        font-weight: 600;
      }
      .rfb-val {
        grid-column: span 1;
      }

      .rfb-actions {
        display: flex;
        gap: 6px;
      }

      .rfb-confirm-btn {
        padding: 5px 12px;
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 6px;
        color: #34d399;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .rfb-confirm-btn:hover {
        background: rgba(16, 185, 129, 0.25);
        color: white;
      }

      .rfb-cancel-btn {
        padding: 5px 12px;
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--color-apple-grey);
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .rfb-cancel-btn:hover {
        color: var(--color-apple-text);
        background: var(--border-color);
      }

      /* Legacy filter badge */
      .legacy-filter-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(234, 179, 8, 0.08);
        border: 1px solid rgba(234, 179, 8, 0.2);
        border-radius: 8px;
        font-size: 11px;
        color: #fde68a;
      }
      .legacy-icon {
        font-size: 11px;
      }
      .legacy-filter-badge code {
        font-family: 'Fira Code', monospace;
        color: #fde68a;
        background: none;
        border: none;
        padding: 0;
      }

      /* ── Grid Action buttons ────────────────────────── */
      .table-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .action-btn-sm {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        color: var(--color-apple-text);
        transition: all 0.2s ease;
        font-family: inherit;
      }
      .action-btn-sm:hover {
        background: var(--border-color);
      }

      .action-btn-sm.add {
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.3);
        color: #4ade80;
      }
      .action-btn-sm.add:hover {
        background: rgba(34, 197, 94, 0.2);
      }

      .action-btn-sm.delete-selected {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        color: #fca5a5;
      }
      .action-btn-sm.delete-selected:hover {
        background: rgba(239, 68, 68, 0.2);
        border-color: #ef4444;
      }

      /* ── Column toggles ─────────────────────────────── */
      .col-enable-toggles {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }

      .col-badge {
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        color: var(--color-apple-grey);
        cursor: pointer;
        font-size: 10px;
        font-weight: bold;
        transition: all 0.15s ease;
      }
      .col-badge.active {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border-color: rgba(34, 197, 94, 0.3);
      }

      /* ── Preview table ──────────────────────────────── */
      .preview-section {
      }

      .spreadsheet-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      .spreadsheet-table th {
        background: var(--color-apple-bg);
        color: var(--color-apple-grey);
        padding: 10px 14px;
        font-size: 11px;
        border-bottom: 1px solid var(--border-color);
      }

      .spreadsheet-table td {
        padding: 10px 14px;
        border-bottom: 1px solid var(--input-bg);
      }

      .preview-col-label {
        font-size: 9px;
        color: var(--color-apple-grey);
        text-transform: none;
        margin-top: 2px;
      }

      .spreadsheet-table tr.row-style-header {
        background: rgba(27, 79, 114, 0.3);
        color: white;
        border-bottom: 2px solid #1b4f72;
      }
      .spreadsheet-table tr.row-style-section {
        background: rgba(214, 234, 248, 0.1);
        color: #a5b4fc;
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
      }

      .sticky-col {
        position: sticky;
        left: 0;
        background: var(--color-apple-card);
        z-index: 2;
      }

      /* ── Granularity sub-rows ─────────────────────────────────── */
      .gran-subrow {
        background: transparent;
      }

      .gran-subrow td {
        padding: 3px 14px;
        border-bottom: none;
      }

      /* Last sub-row of a group gets a faint bottom separator */
      .gran-subrow:has(+ tr:not(.gran-subrow)) td,
      .gran-subrow:last-child td {
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 6px;
      }

      .gran-subrow-label {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--color-apple-card);
      }

      .gran-subrow-connector {
        font-size: 11px;
        color: var(--border-color);
        font-family: monospace;
        flex-shrink: 0;
        line-height: 1;
      }

      .gran-subrow-key {
        font-size: 11px;
        font-family: monospace;
        font-weight: 600;
        color: var(--color-apple-blue);
        flex-shrink: 0;
      }

      .gran-subrow-path {
        font-size: 10px;
        font-family: monospace;
        color: var(--color-apple-grey);
        opacity: 0.7;
      }

      .gran-subrow-badge {
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-apple-blue);
        background: rgba(0, 118, 223, 0.10);
        border: 1px solid rgba(0, 118, 223, 0.20);
        border-radius: 3px;
        padding: 1px 5px;
        white-space: nowrap;
      }

      .gran-subrow-cell {
        background: transparent !important;
        border-bottom: none !important;
      }

      /* Light theme overrides */
      :host-context(html.light) .gran-subrow-label {
        background: #FFFFFF;
      }
      :host-context(html.light) .gran-subrow-key { color: #4F46E5; }
      :host-context(html.light) .gran-subrow-connector { color: #CBD5E1; }
      :host-context(html.light) .gran-subrow-badge {
        color: #4F46E5;
        background: rgba(79, 70, 229, 0.08);
        border-color: rgba(79, 70, 229, 0.20);
      }

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
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(34, 197, 94, 0.2);
        color: #4ade80;
        font-weight: bold;
        font-size: 10px;
      }
      .flag-dash {
        color: #334155;
      }

      .row-type-badge {
        font-size: 9px;
        font-weight: 700;
        padding: 1px 4px;
        border-radius: 3px;
        text-transform: uppercase;
      }
      .row-type-badge.section {
        background: var(--color-apple-card);
        color: var(--color-apple-text);
      }
      .row-type-badge.data {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
      }
      .row-type-badge.calc {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
      }
      .row-type-badge.blank {
        background: transparent;
        color: var(--color-apple-grey);
      }

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
      .success-alert {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #a7f3d0;
      }
      .error-alert {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
      }
      .alert-icon {
        font-size: 16px;
      }
      .form-input.invalid-input {
        border-color: #ef4444 !important;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
      }
      .invalid-filter-tag {
        background: rgba(239, 68, 68, 0.15) !important;
        border-color: rgba(239, 68, 68, 0.3) !important;
        color: #fca5a5 !important;
      }

      /* ── Spinner ────────────────────────────────────── */
      .spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid var(--border-color);
        border-top-color: var(--color-apple-blue);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .animate-fade-in {
        animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      /* ═══════════════ MOBILE RESPONSIVE ═══════════════ */

      .mobile-topbar {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
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
      .hamburger-btn:hover {
        background: var(--border-color);
      }

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
      .sidebar-overlay.visible {
        display: block;
      }

      @media (max-width: 1023px) {
        .mobile-topbar {
          display: flex;
        }
        .sidebar-close-btn {
          display: flex;
        }

        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
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
        .preview-btn,
        .save-btn {
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
        background: var(--input-bg) !important;
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
        background: var(--border-color);
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
        background: var(--input-bg);
        padding: 4px;
        border-radius: 10px;
        width: fit-content;
        border: 1px solid var(--border-color);
      }
      .tab-btn {
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        background: transparent;
        border: none;
        color: var(--color-apple-grey);
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tab-btn:hover {
        color: var(--color-apple-text);
        background: var(--border-color);
      }
      .tab-btn.active {
        background: var(--color-apple-card);
        color: var(--color-apple-text);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .sql-preview-container {
        background: var(--color-apple-bg);
        border-radius: 12px;
        border: 1px solid var(--border-color);
        padding: 20px;
        margin-top: 12px;
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      .sql-code-block {
        margin: 0;
        font-family: 'Fira Code', 'Courier New', Courier, monospace;
        font-size: 13px;
        color: var(--color-apple-text);
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
        color: var(--color-apple-grey);
        font-size: 14px;
        padding: 40px 0;
      }
      .spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid var(--border-color);
        border-top-color: var(--color-apple-blue);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
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
        background: var(--color-apple-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .sql-modal-header {
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .sql-modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-apple-text);
      }
      .modal-subtitle {
        margin: 4px 0 0 0;
        font-size: 13px;
        color: var(--color-apple-grey);
      }
      .modal-close-btn {
        background: transparent;
        border: none;
        color: var(--color-apple-grey);
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: all 0.2s ease;
      }
      .modal-close-btn:hover {
        color: var(--color-apple-text);
        background: var(--border-color);
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
        color: var(--color-apple-grey);
        font-size: 14px;
      }
      .sql-viewer-wrapper {
        display: flex;
        flex-direction: column;
        background: #0f172a; /* Force dark background */
        border-radius: 12px;
        border: 1px solid #1e293b;
        overflow: hidden;
      }
      .sql-viewer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        background: #1e293b; /* Dark bar */
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .file-tag {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #818cf8; /* Indigo accent */
        background: rgba(99, 102, 241, 0.15);
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .copy-btn {
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        color: #e2e8f0;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .copy-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }
      .sql-viewer-wrapper pre {
        margin: 0;
        padding: 16px 20px;
        overflow-x: auto;
        max-height: 400px;
        background: #0f172a;
      }
      .sql-viewer-wrapper code {
        font-family: 'Fira Code', 'Courier New', Courier, monospace;
        font-size: 13px;
        color: #cbd5e1;
        line-height: 1.6;
        white-space: pre;
      }
      /* Syntax highlighting styles (Option A Dark Theme) */
      .sql-viewer-wrapper code .sql-keyword {
        color: #38bdf8; /* bright neon blue for keywords */
        font-weight: 700;
      }
      .sql-viewer-wrapper code .sql-string {
        color: #fbbf24; /* amber/yellow for strings */
      }
      .sql-viewer-wrapper code .sql-number {
        color: #fb7185; /* rose/pink for numbers */
      }
      .sql-viewer-wrapper code .sql-comment {
        color: #64748b; /* slate gray for comments */
        font-style: italic;
      }
      .sql-viewer-wrapper code .sql-table {
        color: #34d399; /* emerald green for tables */
        font-weight: 600;
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
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes scaleUp {
        from {
          transform: scale(0.95);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }

      /* ── Rows layout ── */
      .rows-container-layout {
        display: flex;
        gap: 20px;
        margin-top: 10px;
        position: relative;
        transition: gap 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        align-items: stretch;
      }
      .rows-container-layout.picker-closed {
        gap: 0px;
      }
      @media (max-width: 1024px) {
        .rows-container-layout {
          flex-direction: column;
        }
      }

      /* Premium subtle scroll tracks */
      .catalog-tree::-webkit-scrollbar,
      .rows-table-wrapper::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      .catalog-tree::-webkit-scrollbar-track,
      .rows-table-wrapper::-webkit-scrollbar-track {
        background: rgba(15, 23, 42, 0.4);
        border-radius: 5px;
      }
      .catalog-tree::-webkit-scrollbar-thumb,
      .rows-table-wrapper::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.25);
        border: 2px solid rgba(15, 23, 42, 0.4);
        border-radius: 5px;
        transition: background 0.2s ease;
      }
      .catalog-tree::-webkit-scrollbar-thumb:hover,
      .rows-table-wrapper::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.45);
      }
      .catalog-tree::-webkit-scrollbar-thumb:active,
      .rows-table-wrapper::-webkit-scrollbar-thumb:active {
        background: rgba(255, 255, 255, 0.6);
      }

      /* ── Catalog Panel Placeholder ── */
      .catalog-panel-placeholder {
        width: 280px;
        flex-shrink: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        height: 0;
        min-height: 0;
        align-self: stretch;
      }
      .catalog-panel-placeholder.collapsed {
        width: 0;
        margin: 0;
      }

      /* ── Catalog Panel ── */
      .catalog-panel {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        width: 280px;
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 1;
        flex-shrink: 0;
        z-index: 10;
        box-sizing: border-box;
      }
      .catalog-panel.collapsed {
        width: 0;
        padding: 0;
        border: none;
        opacity: 0;
        pointer-events: none;
        margin: 0;
      }
      @media (max-width: 1024px) {
        .catalog-panel-placeholder {
          display: none;
        }
        .catalog-panel {
          position: relative !important;
          top: auto !important;
          bottom: auto !important;
          left: auto !important;
          width: 100% !important;
          max-height: 400px !important;
          height: auto !important;
        }
        .catalog-panel.collapsed {
          display: none;
        }
        .rows-table-wrapper {
          max-height: none !important;
        }
      }

      /* Collapsible DWH Catalog Toggle Handle */
      .picker-toggle-handle {
        position: absolute;
        left: 290px; /* Centered on the divider line between 280px catalog and 20px gap */
        top: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 50px;
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        display: none; /* Only display on desktop layout */
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 100;
        color: #94a3b8;
        font-size: 14px;
        transition:
          left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          background 0.2s ease,
          color 0.2s ease,
          border-color 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        user-select: none;
        backdrop-filter: blur(8px);
      }
      @media (min-width: 1025px) {
        .picker-toggle-handle {
          display: flex;
        }
      }
      .picker-toggle-handle:hover {
        color: white;
        background: #6366f1;
        border-color: rgba(255, 255, 255, 0.25);
      }
      .rows-container-layout.picker-closed .picker-toggle-handle {
        left: 0px;
      }
      .catalog-search-box {
        position: relative;
        flex-shrink: 0;
      }
      .catalog-search-box .search-input {
        width: 100%;
        padding-left: 12px;
        box-sizing: border-box;
      }
      .catalog-tree {
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        flex-grow: 1;
        padding-right: 4px;
        overscroll-behavior: contain;
      }
      .category-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .category-title {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        user-select: none;
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }
      .category-title:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(99, 102, 241, 0.2);
      }
      .cat-name {
        font-weight: 700;
        color: #f8fafc;
        flex-grow: 1;
      }
      .table-badge {
        font-size: 9px;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
        border: 1px solid rgba(99, 102, 241, 0.25);
      }
      .fields-list-mini {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-left: 14px;
        margin-top: 4px;
        border-left: 1px dashed rgba(255, 255, 255, 0.1);
      }
      .field-item-draggable {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: rgba(15, 23, 42, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 6px;
        cursor: grab;
        font-size: 11px;
        transition: all 0.15s ease;
        user-select: none;
      }
      .field-item-draggable:hover {
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(99, 102, 241, 0.25);
        color: #a5b4fc;
        transform: translateX(2px);
      }
      .field-item-draggable:active {
        cursor: grabbing;
      }
      .field-name {
        flex-grow: 1;
        color: #cbd5e1;
      }
      .field-type {
        font-size: 9px;
        color: #475569;
        font-family: monospace;
      }
      .catalog-empty {
        font-size: 12px;
        color: #475569;
        text-align: center;
        padding: 20px 0;
        font-style: italic;
      }
      .source-table-indicator {
        font-size: 9px;
        color: #818cf8;
        margin-top: 4px;
      }
      /* Custom date picker widget styling */
      .custom-datepicker-wrapper {
        position: relative;
        width: 100%;
      }
      .datepicker-trigger-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px 14px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
        box-sizing: border-box;
        text-align: left;
      }
      .datepicker-trigger-btn:focus,
      .datepicker-trigger-btn.active {
        border-color: #6366f1;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
      }
      .datepicker-backdrop {
        position: fixed;
        inset: 0;
        z-index: 90;
        background: transparent;
        cursor: default;
      }
      .datepicker-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        z-index: 100;
        width: 320px;
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 16px;
        box-shadow:
          0 10px 25px -5px rgba(0, 0, 0, 0.5),
          0 8px 10px -6px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(12px);
        box-sizing: border-box;
      }
      .datepicker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .datepicker-title {
        font-weight: 700;
        font-size: 14px;
        color: #f8fafc;
      }
      .datepicker-nav-btn {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #94a3b8;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 12px;
      }
      .datepicker-nav-btn:hover {
        background: rgba(99, 102, 241, 0.15);
        border-color: rgba(99, 102, 241, 0.3);
        color: white;
      }
      .datepicker-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        text-align: center;
        margin-bottom: 8px;
      }
      .datepicker-weekday {
        font-size: 11px;
        font-weight: 600;
        color: #475569;
        text-transform: uppercase;
      }
      .datepicker-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }
      .datepicker-day-cell {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
        font-weight: 500;
        box-sizing: border-box;
      }
      .datepicker-day-cell.other-month {
        opacity: 0.35;
      }
      .datepicker-day-cell.enabled {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.03);
      }
      .datepicker-day-cell.enabled:hover {
        background: rgba(99, 102, 241, 0.2);
        color: #c7d2fe;
      }
      .datepicker-day-cell.selected {
        background: #6366f1 !important;
        color: white !important;
        font-weight: 700;
        box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
      }
      .datepicker-day-cell.disabled {
        color: #475569;
        background: transparent;
        cursor: not-allowed;
        opacity: 0.25;
        text-decoration: line-through;
      }

      /* Controlled distinct values combobox styles */
      .custom-combobox-wrapper {
        position: relative;
        width: 180px;
        display: inline-block;
        box-sizing: border-box;
      }
      .combobox-trigger-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 6px 10px;
        color: white;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
        box-sizing: border-box;
        text-align: left;
      }
      .combobox-trigger-btn:focus,
      .combobox-trigger-btn.active {
        border-color: #6366f1;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
      }
      .combobox-backdrop {
        position: fixed;
        inset: 0;
        z-index: 40;
        background: transparent;
        cursor: default;
      }
      .combobox-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 50;
        width: 100%;
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 4px;
        box-shadow:
          0 10px 25px -5px rgba(0, 0, 0, 0.5),
          0 8px 10px -6px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(12px);
        box-sizing: border-box;
      }
      .combobox-options-list {
        max-height: 200px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .combobox-option-item {
        padding: 6px 10px;
        font-size: 11px;
        border-radius: 6px;
        cursor: pointer;
        color: #cbd5e1;
        transition: all 0.15s ease;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .combobox-option-item:hover {
        background: rgba(99, 102, 241, 0.2);
        color: #c7d2fe;
      }
      .combobox-option-item.selected {
        background: #6366f1;
        color: white;
        font-weight: 600;
      }
      .combobox-empty-state {
        padding: 10px;
        font-size: 11px;
        color: #475569;
        text-align: center;
        font-style: italic;
      }

      /* ═══════════════ LIGHT THEME REFINEMENT ═══════════════ */
      :host-context(html.light) .card,
      :host-context(html.light) .config-panel,
      :host-context(html.light) .rows-section,
      :host-context(html.light) .preview-section {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      }

      :host-context(html.light) .main-content h1,
      :host-context(html.light) .section-title {
        color: #0F172A;
      }

      :host-context(html.light) .report-subtitle,
      :host-context(html.light) .section-desc {
        color: #475569;
      }

      :host-context(html.light) .form-input,
      :host-context(html.light) .form-select,
      :host-context(html.light) .datepicker-trigger-btn,
      :host-context(html.light) .combobox-trigger-btn {
        background: #FFFFFF;
        border-color: #CBD5E1;
        color: #0F172A;
      }

      :host-context(html.light) .form-input:focus,
      :host-context(html.light) .form-select:focus,
      :host-context(html.light) .datepicker-trigger-btn.active,
      :host-context(html.light) .combobox-trigger-btn.active {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
      }

      :host-context(html.light) .form-input::placeholder {
        color: #94A3B8;
      }
      /* Step 1 Rows Setup Grid */
      :host-context(html.light) .grid-table.rows-grid {
        border-color: #E2E8F0;
      }

      :host-context(html.light) .rows-grid thead tr.worksheet-fixed-row th {
        background: #F8FAFC;
        border-bottom-color: #E2E8F0;
        color: #475569;
      }

      :host-context(html.light) .rows-grid tbody tr:nth-child(even) {
        background: #F8FAFC;
      }

      :host-context(html.light) .rows-grid tbody tr:nth-child(odd) {
        background: #FFFFFF;
      }

      :host-context(html.light) .rows-grid tbody tr:hover {
        background: #F1F5F9;
      }

      :host-context(html.light) .rows-grid .sticky-col-1 {
        background: #FFFFFF;
        border-right-color: #E2E8F0;
      }

      :host-context(html.light) .rows-grid .sticky-col-2 {
        background: #FFFFFF;
        border-right-color: #E2E8F0;
        color: #0F172A;
      }

      :host-context(html.light) .rows-grid tr:nth-child(even) td.sticky-col-1,
      :host-context(html.light) .rows-grid tr:nth-child(even) td.sticky-col-2 {
        background: #F8FAFC;
      }

      :host-context(html.light) .rows-grid tr:nth-child(odd) td.sticky-col-1,
      :host-context(html.light) .rows-grid tr:nth-child(odd) td.sticky-col-2 {
        background: #FFFFFF;
      }

      :host-context(html.light) .rows-grid tr:hover td.sticky-col-1,
      :host-context(html.light) .rows-grid tr:hover td.sticky-col-2 {
        background: #F1F5F9;
      }

      :host-context(html.light) .rows-grid thead .sticky-col-1,
      :host-context(html.light) .rows-grid thead .sticky-col-2 {
        background: #F8FAFC;
        border-bottom-color: #E2E8F0;
      }

      :host-context(html.light) .rows-grid input,
      :host-context(html.light) .rows-grid select {
        background: #FFFFFF;
        border-color: #CBD5E1;
        color: #0F172A;
      }

      :host-context(html.light) .rows-grid input:focus,
      :host-context(html.light) .rows-grid select:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
      }

      /* Buttons & Actions */
      :host-context(html.light) .add-sub-btn {
        color: #4F46E5;
        background: rgba(79, 70, 229, 0.08);
        border: 1px solid rgba(79, 70, 229, 0.15);
      }

      :host-context(html.light) .add-sub-btn:hover {
        background: rgba(79, 70, 229, 0.15);
        color: #4338CA;
      }

      :host-context(html.light) .action-btn-sm {
        background: #FFFFFF;
        border-color: #CBD5E1;
        color: #475569;
      }

      :host-context(html.light) .action-btn-sm:hover {
        background: #F8FAFC;
        color: #0F172A;
        border-color: #CBD5E1;
      }

      :host-context(html.light) .action-btn-sm.add {
        color: #4F46E5;
        background: rgba(79, 70, 229, 0.08);
        border-color: rgba(79, 70, 229, 0.2);
      }

      :host-context(html.light) .action-btn-sm.add:hover {
        background: rgba(79, 70, 229, 0.15);
        color: #4338CA;
      }

      :host-context(html.light) .btn-preview-sql,
      :host-context(html.light) .preview-btn {
        background: #FFFFFF;
        border-color: #CBD5E1;
        color: #475569;
      }

      :host-context(html.light) .btn-preview-sql:hover,
      :host-context(html.light) .preview-btn:hover {
        background: #F8FAFC;
        color: #0F172A;
        border-color: #CBD5E1;
      }

      :host-context(html.light) .save-btn {
        background: #4F46E5;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
      }

      :host-context(html.light) .save-btn:hover {
        background: #4338CA;
        box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
      }

      /* Left-hand DWH Catalog Sidebar Panel overrides */
      :host-context(html.light) .catalog-panel {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-right: 1px solid #E2E8F0;
        box-shadow: none;
      }

      :host-context(html.light) .picker-toggle-handle {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        color: #64748B;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }

      :host-context(html.light) .picker-toggle-handle:hover {
        color: #4F46E5;
        background: #F8FAFC;
        border-color: #CBD5E1;
      }

      :host-context(html.light) .catalog-search-box .search-input {
        background: #FFFFFF;
        border: 1px solid #CBD5E1;
        color: #0F172A;
      }

      :host-context(html.light) .catalog-search-box .search-input::placeholder {
        color: #94A3B8;
      }

      :host-context(html.light) .category-title {
        background: #FFFFFF;
        border-color: #E2E8F0;
      }

      :host-context(html.light) .category-title:hover {
        background: #F8FAFC;
        border-color: #CBD5E1;
      }

      :host-context(html.light) .cat-name,
      :host-context(html.light) .field-name {
        color: #334155;
      }

      :host-context(html.light) .table-badge {
        background: #EEF2F6;
        color: #475569;
        border: 1px solid #E2E8F0;
      }

      :host-context(html.light) .fields-list-mini {
        border-left-color: #E2E8F0;
      }

      :host-context(html.light) .field-item-draggable {
        background: #FFFFFF;
        border-color: #E2E8F0;
      }

      :host-context(html.light) .field-item-draggable:hover {
        background: #EEF2F6;
        border-color: #CBD5E1;
        color: #4F46E5;
      }

      :host-context(html.light) .field-type {
        color: #64748B;
      }

      :host-context(html.light) .catalog-empty {
        color: #94A3B8;
      }

      :host-context(html.light) .catalog-tree::-webkit-scrollbar-track,
      :host-context(html.light) .rows-table-wrapper::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
      }

      :host-context(html.light) .catalog-tree::-webkit-scrollbar-thumb,
      :host-context(html.light) .rows-table-wrapper::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.25);
        border: 2px solid rgba(243, 244, 246, 1);
        border-radius: 5px;
      }

      :host-context(html.light) .catalog-tree::-webkit-scrollbar-thumb:hover,
      :host-context(html.light) .rows-table-wrapper::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.4);
      }

      :host-context(html.light) .catalog-tree::-webkit-scrollbar-thumb:active,
      :host-context(html.light) .rows-table-wrapper::-webkit-scrollbar-thumb:active {
        background: rgba(0, 0, 0, 0.55);
      }

      /* Steps 1 Grid Typography & Inputs overrides */
      :host-context(html.light) .rows-grid thead tr.worksheet-fixed-row th {
        color: #0F172A;
        font-weight: 700;
      }

      :host-context(html.light) .measure-td span.text-slate-500 {
        color: #334155 !important;
      }

      :host-context(html.light) select option[value=""],
      :host-context(html.light) select option:disabled {
        color: #64748B;
      }

      :host-context(html.light) .col-badge {
        background: #F8FAFC;
        border-color: #E2E8F0;
        color: #64748B;
      }

      :host-context(html.light) .col-badge.active {
        background: #E6F4EA;
        color: #137333;
        border-color: #A3E635;
      }

      /* ── Consolidated Filters Row ── */
      .filters-row-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        align-items: start;
        width: 100%;
      }
      @media (max-width: 1024px) {
        .filters-row-container {
          grid-template-columns: 1fr;
          gap: 16px;
        }
      }

      /* ── Timeframe Row No-Wrap Fix ── */
      .timeframe-row,
      .tf-end-group {
        flex-wrap: nowrap !important;
      }

      /* Timeframe Limit Light Theme overrides */
      :host-context(html.light) .mode-btn-group {
        border-color: #CBD5E1;
      }
      :host-context(html.light) .mode-btn {
        background: #FFFFFF;
        border-right-color: #CBD5E1;
        color: #475569;
      }
      :host-context(html.light) .mode-btn:hover {
        background: #EEF2F6;
        color: #4F46E5;
      }
      :host-context(html.light) .mode-btn.active {
        background: rgba(79, 70, 229, 0.15);
        color: #4F46E5;
        border-color: rgba(79, 70, 229, 0.3);
      }
      :host-context(html.light) .computed-date-badge {
        background: #EEF2F6;
        color: #4338CA;
        border-color: #C7D2FE;
      }

      /* Datepicker Dropdown & Days Light Theme overrides */
      :host-context(html.light) .datepicker-dropdown {
        background: #FFFFFF;
        border: 1px solid #CBD5E1;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      }
      :host-context(html.light) .datepicker-title {
        color: #0F172A;
      }
      :host-context(html.light) .datepicker-nav-btn {
        background: #F8FAFC;
        border-color: #E2E8F0;
        color: #475569;
      }
      :host-context(html.light) .datepicker-nav-btn:hover {
        background: #EEF2F6;
        color: #4F46E5;
        border-color: #CBD5E1;
      }
      :host-context(html.light) .datepicker-weekday {
        color: #64748B;
      }
      :host-context(html.light) .datepicker-day-cell {
        color: #334155;
      }
      :host-context(html.light) .datepicker-day-cell.other-month {
        color: #94A3B8;
        opacity: 0.5;
      }
      :host-context(html.light) .datepicker-day-cell.enabled {
        color: #334155;
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
      }
      :host-context(html.light) .datepicker-day-cell.enabled:hover {
        background: rgba(79, 70, 229, 0.1);
        color: #4F46E5;
        border-color: rgba(79, 70, 229, 0.2);
      }
      :host-context(html.light) .datepicker-day-cell.selected {
        background: #4F46E5 !important;
        color: #FFFFFF !important;
        box-shadow: 0 0 10px rgba(79, 70, 229, 0.3);
        border-color: #4F46E5;
      }
      :host-context(html.light) .datepicker-day-cell.disabled {
        color: #94A3B8;
        background: transparent;
        opacity: 0.3;
        text-decoration: line-through;
        border: none;
      }

      /* Combobox / Distinct Values Dropdown Light Theme overrides */
      :host-context(html.light) .combobox-trigger-btn {
        background: #FFFFFF;
        border-color: #CBD5E1;
        color: #0F172A;
      }
      :host-context(html.light) .combobox-trigger-btn:focus,
      :host-context(html.light) .combobox-trigger-btn.active {
        border-color: #6366F1;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
      }
      :host-context(html.light) .combobox-dropdown {
        background: #FFFFFF;
        border-color: #CBD5E1;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      }
      :host-context(html.light) .combobox-option-item {
        color: #334155;
      }
      :host-context(html.light) .combobox-option-item:hover {
        background: #F8FAFC;
        color: #0F172A;
      }
      :host-context(html.light) .combobox-option-item.selected {
        background: #E0E7FF;
        color: #4338CA;
      }
      :host-context(html.light) .combobox-empty-state {
        color: #64748B;
      }
      :host-context(html.light) .dim-select {
        color: #7C3AED;
      }
      :host-context(html.light) .form-select.sm.operator {
        color: #4F46E5;
      }

      /* Light Theme overrides for Conjunction Toggle Pill */
      :host-context(html.light) .conjunction-toggle-pill {
        border-color: #E2E8F0;
      }
      :host-context(html.light) .conj-btn {
        color: #64748B;
      }
      :host-context(html.light) .conj-btn:hover {
        background: rgba(79, 70, 229, 0.05);
        color: #4F46E5;
      }
      :host-context(html.light) .conj-btn.active {
        background: #EEF2F6;
        color: #4F46E5;
      }

      /* Light Theme overrides for SQL Preview Modal */
      :host-context(html.light) .sql-modal-card {
        background: #FFFFFF;
        border-color: #E2E8F0;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
      }
      :host-context(html.light) .sql-modal-header {
        border-bottom-color: #E2E8F0;
      }
      :host-context(html.light) .sql-modal-header h2 {
        color: #0F172A;
      }
      :host-context(html.light) .modal-subtitle {
        color: #64748B;
      }
      :host-context(html.light) .modal-close-btn {
        color: #64748B;
      }
      :host-context(html.light) .modal-close-btn:hover {
        color: #0F172A;
        background: #F1F5F9;
      }
      :host-context(html.light) .sql-modal-footer {
        border-top-color: #E2E8F0;
        background: #F8FAFC;
      }
      :host-context(html.light) .footer-close-btn {
        color: #475569;
        border-color: #CBD5E1;
        background: #FFFFFF;
      }
      :host-context(html.light) .footer-close-btn:hover {
        background: #F1F5F9;
        color: #0F172A;
        border-color: #94A3B8;
      }
    `,
  ],
})
export class ReportBuilderComponent implements OnInit {
  isNewReport = true;
  isLocked = false;
  viewOnlyMode = false;
  aggregationOptions = [
    { value: 'SUM', label: 'SUM (Total)' },
    { value: 'AVG', label: 'AVG (Average)' },
    { value: 'COUNT', label: 'COUNT (Total Rows)' },
    { value: 'COUNT_DISTINCT', label: 'COUNT DISTINCT (Unique)' },
    { value: 'MAX', label: 'MAX (Highest)' },
    { value: 'MIN', label: 'MIN (Lowest)' },
  ];
  saving = signal(false);
  showPreview = signal(false);
  previewTrigger = signal<number>(0);

  // ── Date Picker signals & properties ──────────────────────────────
  showDatePicker = signal<boolean>(false);
  calendarYear = signal<number>(new Date().getFullYear());
  calendarMonth = signal<number>(new Date().getMonth());
  readonly monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  calendarDays = computed(() => {
    this.previewTrigger(); // reacts to validation changes
    const year = this.calendarYear();
    const month = this.calendarMonth();

    const days: CalendarDay[] = [];

    // First day of current month (0 = Sunday, 6 = Saturday)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Number of days in current month
    const numDays = new Date(year, month + 1, 0).getDate();

    // Prev month days to pad
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const numDaysPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = numDaysPrevMonth - i;
      const d = new Date(prevMonthYear, prevMonth, dayNum);
      const formattedStr = this.formatDateString(d);
      days.push({
        date: d,
        dayNum,
        isCurrentMonth: false,
        formattedStr,
        isEnabled: true, // Unbounded 100-day constraint removed
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= numDays; dayNum++) {
      const d = new Date(year, month, dayNum);
      const formattedStr = this.formatDateString(d);
      days.push({
        date: d,
        dayNum,
        isCurrentMonth: true,
        formattedStr,
        isEnabled: true, // Unbounded 100-day constraint removed
      });
    }

    // Next month days to pad to a multiple of 7
    const totalCells = 42;
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    let nextMonthDay = 1;
    while (days.length < totalCells) {
      const d = new Date(nextMonthYear, nextMonth, nextMonthDay);
      const formattedStr = this.formatDateString(d);
      days.push({
        date: d,
        dayNum: nextMonthDay,
        isCurrentMonth: false,
        formattedStr,
        isEnabled: true, // Unbounded 100-day constraint removed
      });
      nextMonthDay++;
    }

    return days;
  });

  // ── Timeframe End Date Picker signals & properties ────────────────
  showTimeframeStartDatePicker = signal<boolean>(false);
  showTimeframeEndDatePicker = signal<boolean>(false);
  calendarTimeframeEndYear = signal<number>(new Date().getFullYear());
  calendarTimeframeEndMonth = signal<number>(new Date().getMonth());

  calendarTimeframeEndDays = computed(() => {
    this.previewTrigger(); // reacts to validation changes
    const year = this.calendarTimeframeEndYear();
    const month = this.calendarTimeframeEndMonth();

    const days: CalendarDay[] = [];

    // First day of current month (0 = Sunday, 6 = Saturday)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Number of days in current month
    const numDays = new Date(year, month + 1, 0).getDate();

    // Prev month days to pad
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const numDaysPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = numDaysPrevMonth - i;
      const d = new Date(prevMonthYear, prevMonth, dayNum);
      const formattedStr = this.formatDateString(d);
      days.push({
        date: d,
        dayNum,
        isCurrentMonth: false,
        formattedStr,
        isEnabled: true,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= numDays; dayNum++) {
      const d = new Date(year, month, dayNum);
      const formattedStr = this.formatDateString(d);
      days.push({
        date: d,
        dayNum,
        isCurrentMonth: true,
        formattedStr,
        isEnabled: true,
      });
    }

    // Next month days to pad to a multiple of 7
    const totalCells = 42;
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    let nextMonthDay = 1;
    while (days.length < totalCells) {
      const d = new Date(nextMonthYear, nextMonth, nextMonthDay);
      const formattedStr = this.formatDateString(d);
      days.push({
        date: d,
        dayNum: nextMonthDay,
        isCurrentMonth: false,
        formattedStr,
        isEnabled: true,
      });
      nextMonthDay++;
    }

    return days;
  });


  // ── Dynamic Granularity Options Signal ────────────────────────────
  dynamicGranularityOptions = computed(() => {
    this.previewTrigger(); // reacts to row or table changes

    const options: { value: string; label: string }[] = [];

    // Helper to determine if a DWH catalog column should be excluded from selection options
    const shouldExcludeColumn = (col: string): boolean => {
      const colLower = col.toLowerCase().trim();

      // Rule 1: ID Key Exclusion Rule (ends with or equals id, _id, key, _key)
      if (
        colLower === 'id' ||
        colLower === 'key' ||
        colLower === '_id' ||
        colLower === '_key' ||
        colLower.endsWith('_id') ||
        colLower.endsWith('_key') ||
        colLower.endsWith('id') ||
        colLower.endsWith('key')
      ) {
        return true;
      }

      // Rule 2: Financial/Numeric Figures Exclusion Rule (facts/measures intended for aggregation)
      const financials = new Set([
        'amount',
        'interest_rate',
        'principal_amount',
        'cost',
        'budget',
        'price',
        'revenue',
        'expense',
        'salary',
        'balance',
        'quantity',
        'units',
        'shares',
        'volume',
      ]);
      if (financials.has(colLower)) {
        return true;
      }

      return false;
    };

    // 1. Scan rows to find active fact tables
    const activeFactTables = new Set<string>();
    this.rows.forEach((r) => {
      if (r.rowType === 'data' && r.sourceTable) {
        activeFactTables.add(r.sourceTable);
      }
    });

    // 2. Conformed and Linked dimensions
    const dimensions = Array.from(
      new Set([...(this.conformedDimensions() || []), ...(this.linkedDimensions || [])]),
    );

    // Extract from dimension tables first (prioritizing them)
    dimensions.forEach((dimTable) => {
      const cols = this.dimensionColumnsCache[dimTable] || [];
      cols.forEach((col) => {
        if (shouldExcludeColumn(col)) return;
        const value = `${dimTable}.${col}`;
        options.push({
          value,
          label: `${dimTable}.${col} (Dim)`,
        });
      });
    });

    // Extract from fact tables next
    activeFactTables.forEach((factTable) => {
      const shortFact = factTable.replace(/^analytics\./, '');
      const group = this.dwhFieldsTree().find((g) => g.sourceTable === factTable);
      if (group) {
        group.fields.forEach((f) => {
          if (shouldExcludeColumn(f.name)) return;
          const value = `${shortFact}.${f.name}`;
          // Avoid duplicate options if already added via dimension
          if (!options.some((o) => o.value === value)) {
            options.push({
              value,
              label: `${shortFact}.${f.name} (Fact)`,
            });
          }
        });
      } else {
        // Fallback to columnTypesCache
        const cols = this.columnTypesCache[factTable]
          ? Object.keys(this.columnTypesCache[factTable])
          : [];
        cols.forEach((col) => {
          if (shouldExcludeColumn(col)) return;
          const value = `${shortFact}.${col}`;
          if (!options.some((o) => o.value === value)) {
            options.push({
              value,
              label: `${shortFact}.${col} (Fact)`,
            });
          }
        });
      }
    });

    // Include current granularities if not already present
    this.granularities().forEach((gran) => {
      if (gran && !options.some((o) => o.value === gran)) {
        options.unshift({
          value: gran,
          label: `${gran} (Current)`,
        });
      }
    });

    if (options.length === 0) {
      return this.conformedKeys.map((k) => ({ value: k, label: k }));
    }

    return options;
  });
  expandedColumns = computed(() => {
    this.previewTrigger(); // subscribe to updates
    const refDate = this.reportingDate || new Date().toISOString().split('T')[0];
    const expanded: any[] = [];
    for (const col of this.columns) {
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

  /** Derives one preview-column descriptor per selected granularity value. */
  granularityPreviewCols = computed(() => {
    return this.granularities().map((g) => ({
      value: g,
      // Short label: last segment after the final dot
      shortLabel: g.includes('.') ? g.substring(g.lastIndexOf('.') + 1) : g,
      // Full table.column path for the sub-label
      fullPath: g,
    }));
  });

  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  sidebarOpen = signal(false);
  isMainMenuCollapsed = signal(false);
  isFieldPickerOpen = signal(false);

  // Resizable columns width state (Step 1 Rows Setup)
  // Bug fix #2: columnWidths and computedWidthsString are kept for the
  // col-resizer directive on Step 2 (Columns Setup) but are no longer used
  // by the Rows Setup grid, which now uses the .worksheet-fixed-row CSS class.
  columnWidths = signal<number[]>([40, 80, 80, 320, 140, 360, 240, 200, 50]);

  computedWidthsString = computed(() => {
    return this.columnWidths()
      .map((w) => `${w}px`)
      .join(' ');
  });

  onColumnWidthChanged(index: number, newWidth: number): void {
    this.columnWidths.update((widths) => {
      const updated = [...widths];
      updated[index] = newWidth;
      return updated;
    });
  }

  toggleMainMenu(): void {
    this.isMainMenuCollapsed.set(!this.isMainMenuCollapsed());
  }

  toggleFieldPicker(): void {
    this.isFieldPickerOpen.set(!this.isFieldPickerOpen());
  }

  // SQL Preview State
  activePreviewTab = signal<'grid' | 'sql'>('grid');
  compiledSql = signal<string>('');
  isLoadingSql = signal<boolean>(false);
  isSqlModalOpen = signal<boolean>(false);
  previewSqlText = signal<string>('');
  isCopied = signal<boolean>(false);

  validationErrors = signal<ValidationError[]>([]);
  isValid = computed(() => !this.validationErrors().some((e) => e.errorSeverity === 'CRITICAL'));

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

  private validationTimeout: any;

  triggerValidationDebounced(): void {
    this.previewTrigger.update((v) => v + 1);
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
    this.previewTrigger.update((v) => v + 1);
    if (!this.reportId) return;

    const localErrors: ValidationError[] = [];
    const formulaTriggers = ['=', '+', '-', '@'];

    // Validate column labels
    this.columns.forEach((c, idx) => {
      const label = (c.label || '').trim();
      if (formulaTriggers.some((t) => label.startsWith(t))) {
        localErrors.push({
          elementId: `column-${c.colId || idx}`,
          fieldContext: `Column: ${c.label || c.colId}`,
          errorSeverity: 'CRITICAL',
          displayMessage: `Label "${c.label}" cannot start with formula triggers (=, +, -, @) to prevent formula injection.`,
        });
      }
    });

    // Validate row labels
    this.rows.forEach((r, idx) => {
      const label = (r.label || '').trim();
      if (formulaTriggers.some((t) => label.startsWith(t))) {
        localErrors.push({
          elementId: `row-${r.rowId || idx}`,
          fieldContext: `Row: ${r.label || r.rowId}`,
          errorSeverity: 'CRITICAL',
          displayMessage: `Label "${r.label}" cannot start with formula triggers (=, +, -, @) to prevent formula injection.`,
        });
      }
    });


    // Set local errors immediately
    this.validationErrors.set(localErrors);

    const payload = {
      reportId: this.reportId,
      name: this.reportName,
      version: this.reportVersion,
      exploreId: 1,
      status: this.status,
      granularity: this.granularity,
      reportingDate: this.reportingDate,
      timeframeStart: this.timeframeStart,
      timeframeEnd: this.computedTimeframeEnd,
      timeframeToday: this.timeframeMode === 'today',
      quickFilters: JSON.stringify(this.quickFilters),
      generalFilters: this.serializeGeneralFilters(),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId: c.colId,
        label: c.label,
        colType: c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN: (c.colType === 'WTD' || c.colType === 'MTD' || c.colType === 'YTD' || c.colType === 'ROLLING') ? c.rollingN : null,
        formulaExpr: c.colType === 'CALC' ? c.formulaExpr : '',
        tierLevel: c.tierLevel || 'L1',
        parentId: c.parentId || '',
        periodType: c.periodType || null,
        displayOrder: i + 1,
      })),
      rows: this.rows.map((r, i) => ({
        rowId: r.rowId,
        reportId: this.reportId,
        label: r.label,
        rowType: r.rowType,
        source: this.serializeMeasure(r),
        parentRowId: r.parentRowId || null,
        style: r.style || 'normal',
        indentLevel: r.indentLevel,
        displayOrder: i + 1,
        activeCols: r.activeCols,
        filterExpr: this.serializeRowFilters(r),
      })),
    };

    this.reportService.validateReport(payload).subscribe({
      next: (res: any) => {
        const serverErrors = res.errors || [];
        this.validationErrors.set([...localErrors, ...serverErrors]);
      },
      error: (err) => {
        console.warn('Asynchronous validation call failed:', err);
        this.validationErrors.set(localErrors);
      },
    });
  }

  runSqlPreview(): void {
    if (!this.reportId) {
      this.compiledSql.set('');
      return;
    }
    this.isLoadingSql.set(true);
    const payload = {
      reportId: this.reportId,
      name: this.reportName,
      version: this.reportVersion,
      exploreId: 1,
      status: this.status,
      granularity: this.granularity,
      reportingDate: this.reportingDate,
      timeframeStart: this.timeframeStart,
      timeframeEnd: this.computedTimeframeEnd,
      timeframeToday: this.timeframeMode === 'today',
      quickFilters: JSON.stringify(this.quickFilters),
      generalFilters: this.serializeGeneralFilters(),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId: c.colId,
        label: c.label,
        colType: c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN: (c.colType === 'WTD' || c.colType === 'MTD' || c.colType === 'YTD' || c.colType === 'ROLLING') ? c.rollingN : null,
        rollingGrain: c.colType === 'ROLLING' ? c.rollingGrain : null,
        formulaExpr: c.colType === 'CALC' ? c.formulaExpr : '',
        tierLevel: c.tierLevel || 'L1',
        parentId: c.parentId || '',
        periodType: c.periodType || null,
        displayOrder: i + 1,
      })),
      rows: this.rows.map((r, i) => ({
        rowId: r.rowId,
        reportId: this.reportId,
        label: r.label,
        rowType: r.rowType,
        source: this.serializeMeasure(r),
        parentRowId: r.parentRowId || null,
        style: r.style || 'normal',
        indentLevel: r.indentLevel,
        displayOrder: i + 1,
        activeCols: r.activeCols,
        filterExpr: this.serializeRowFilters(r),
      })),
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
      },
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
      reportId: this.reportId,
      name: this.reportName,
      version: this.reportVersion,
      exploreId: 1,
      status: this.status,
      granularity: this.granularity,
      reportingDate: this.reportingDate,
      timeframeStart: this.timeframeStart,
      timeframeEnd: this.computedTimeframeEnd,
      timeframeToday: this.timeframeMode === 'today',
      quickFilters: JSON.stringify(this.quickFilters),
      generalFilters: this.serializeGeneralFilters(),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId: c.colId,
        label: c.label,
        colType: c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN: (c.colType === 'WTD' || c.colType === 'MTD' || c.colType === 'YTD' || c.colType === 'ROLLING') ? c.rollingN : null,
        rollingGrain: c.colType === 'ROLLING' ? c.rollingGrain : null,
        formulaExpr: c.colType === 'CALC' ? c.formulaExpr : '',
        tierLevel: c.tierLevel || 'L1',
        parentId: c.parentId || '',
        periodType: c.periodType || null,
        displayOrder: i + 1,
      })),
      rows: this.rows.map((r, i) => ({
        rowId: r.rowId,
        reportId: this.reportId,
        label: r.label,
        rowType: r.rowType,
        source: this.serializeMeasure(r),
        parentRowId: r.parentRowId || null,
        style: r.style || 'normal',
        indentLevel: r.indentLevel,
        displayOrder: i + 1,
        activeCols: r.activeCols,
        filterExpr: this.serializeRowFilters(r),
      })),
    };

    this.reportService
      .previewSql(payload)
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
        },
      });
  }

  closeSqlModal(): void {
    this.isSqlModalOpen.set(false);
  }

  copySqlToClipboard(): Promise<void> | void {
    const sqlText = this.previewSqlText();
    if (sqlText) {
      return navigator.clipboard
        .writeText(sqlText)
        .then(() => {
          this.isCopied.set(true);
          setTimeout(() => this.isCopied.set(false), 2000);
        })
        .catch((err) => {
          console.error('Failed to copy text: ', err);
        });
    }
  }

  getHighlightedSql(sql: string): string {
    if (!sql) return '';

    // Escape HTML characters to prevent XSS
    let escaped = sql
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // RegEx patterns
    const commentRegex = /(--.*)/g;
    const stringRegex = /('[^']*'|"[^"]*")/g;
    const numberRegex = /\b(\d+(?:\.\d+)?)\b/g;

    const keywords = [
      'WITH', 'SELECT', 'CAST', 'AS', 'FROM', 'LEFT JOIN', 'JOIN', 'ON', 'GROUP BY',
      'UNION ALL', 'UNION DISTINCT', 'UNION', 'WHERE', 'AND', 'OR', 'COALESCE',
      'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'DOUBLE PRECISION', 'INTEGER', 'NULL', 'FALSE', 'TRUE', 'IS NOT', 'IS', 'LIKE',
      'NOT LIKE', 'DISTINCT'
    ];
    keywords.sort((a, b) => b.length - a.length);
    const keywordsPattern = keywords.map(kw => kw.replace(/ /g, '\\s+')).join('|');
    const keywordRegex = new RegExp(`\\b(${keywordsPattern})\\b`, 'gi');

    const schemaTableRegex = /\b(analytics\.[a-zA-Z0-9_]+|cte_[a-zA-Z0-9_]+)\b/g;

    const placeholders: string[] = [];

    // Replace comments
    escaped = escaped.replace(commentRegex, (match) => {
      placeholders.push(`<span class="sql-comment">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });

    // Replace strings
    escaped = escaped.replace(stringRegex, (match) => {
      placeholders.push(`<span class="sql-string">${match}</span>`);
      return `___PLACEHOLDER_${placeholders.length - 1}___`;
    });

    // Replace keywords
    escaped = escaped.replace(keywordRegex, (match) => {
      return `<span class="sql-keyword">${match.toUpperCase()}</span>`;
    });

    // Replace schema table names
    escaped = escaped.replace(schemaTableRegex, (match) => {
      return `<span class="sql-table">${match}</span>`;
    });

    // Replace numbers
    escaped = escaped.replace(numberRegex, (match) => {
      return `<span class="sql-number">${match}</span>`;
    });

    // Restore placeholders
    for (let i = placeholders.length - 1; i >= 0; i--) {
      escaped = escaped.replace(new RegExp(`___PLACEHOLDER_${i}___`, 'g'), placeholders[i]);
    }

    return escaped;
  }

  // ── DB Metadata ─────────────────────────────────────────────────────────
  dbTables: string[] = [];
  tableColumns: string[] = [];
  distinctValues: { [key: string]: string[] } = {};
  readonly conformedKeys = ['customer_id', 'location_id', 'reporting_date'];

  // Searchable DWH Catalog signals
  dwhFieldsTree = signal<FieldGroup[]>([]);
  dwhCatalogCache = computed(() => this.dwhFieldsTree());
  fieldsSearchQuery = signal<string>('');
  filteredSchemaTree = computed(() => {
    const query = this.fieldsSearchQuery().trim();
    const tree = this.dwhFieldsTree();
    if (!query) return tree;

    const normalize = (str: string) => {
      if (!str) return '';
      return str.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    };

    const normalizedQuery = normalize(query);

    return tree
      .map((group) => {
        const normalizedTable = normalize(group.sourceTable);
        const normalizedCategory = normalize(group.category);

        const tableMatches =
          normalizedTable.includes(normalizedQuery) || normalizedCategory.includes(normalizedQuery);

        if (tableMatches) {
          // Table-level matching cascade: display ALL columns
          return { ...group, fields: group.fields };
        } else {
          // Column-level matching filter: display only matching columns
          const matchedFields = group.fields.filter((f) => {
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
      .filter((group) => group.fields.length > 0);
  });

  expandedCategories = signal<string[]>([]);

  // Context-aware conformed/mismatched dimensions signals
  factToDimensionsMap: { [factTable: string]: string[] } = {};
  conformedDimensions = signal<string[]>([]);
  mismatchedDimensions = signal<string[]>([]);
  allAvailableDimensions = signal<string[]>([]);

  // ── Dimension joins & linked dimensions ─────────────────────────────────
  dimensionJoins: any[] = []; // all joins available for the selected fact table
  linkedDimensions: string[] = []; // user-selected dim views to activate
  dimensionColumnsCache: { [dimView: string]: string[] } = {};
  columnTypesCache: { [tableName: string]: { [columnName: string]: string } } = {};
  loadingDimJoins = false;

  // ── Reporting date ───────────────────────────────────────────────────────
  reportingDate = ''; // default applied at runtime in initializeDefaultCatalog / applyReportConfig
  availableReportingDates: string[] = [];

  // ── Form Fields ──────────────────────────────────────────────────────────
  reportId = '';
  reportName = '';
  reportVersion = 1;
  status = 'draft';
  sourceTable = '';

  private fb = inject(FormBuilder);

  reportForm = this.fb.group({
    granularity: [ [] as string[], [Validators.required, Validators.minLength(1)] ],
    quickFilters: [ [] as string[] ]
  });

  granularities = signal<string[]>([]);

  get granularity(): string {
    const val = this.reportForm.controls.granularity.value;
    return Array.isArray(val) ? val.join(',') : '';
  }
  set granularity(val: string) {
    const parsed = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
    this.reportForm.controls.granularity.setValue(parsed);
    this.granularities.set(parsed);
  }



  getCombinedGranularityLabel(): string {
    const grans = this.granularities();
    if (grans.length === 0) {
      return 'Label';
    }
    const shortGrans = grans.map(g => this.getGranularityLabelShort(g));
    return `Label (${shortGrans.join(', ')})`;
  }

  getGranularityLabelShort(g: string): string {
    if (g.includes('.')) {
      return g.substring(g.lastIndexOf('.') + 1);
    }
    return g;
  }
  timeframeStart = '2022-01-01';
  timeframeEnd = '';
  timeframeMode: 'custom' | 'today_minus_2' | 'today_minus_1' | 'today' = 'today_minus_2';
  quickFilters: QuickFilterCondition[] = [];
  generalFiltersGroup: any = null;
  generalFilterExpr = '';
  isGeneralFilterRawMode = false;
  private _generalFiltersLegacy: FilterCondition[] = [];
  generalFilterScopes = signal<TableFilterScope[]>([]);
  isGeneralFilterModalOpen = signal<boolean>(false);

  getGeneralFilterSummary(group: any): string {
    if (!group) return '—';
    if (Array.isArray(group)) {
      return group.map(f => `${f.dimTable ? f.dimTable + '.' : ''}${f.attribute} ${f.operator} ${f.value}`).join(' AND ');
    }
    
    const parts: string[] = [];
    if (group.rules) {
      for (const rule of group.rules) {
        if (!rule.columnName) continue;
        const col = rule.tableName ? `${rule.tableName}.${rule.columnName}` : rule.columnName;
        const op = rule.operator || 'is';
        const vals = rule.value || [];
        
        let summary = '';
        if (op === 'is blank' || op === 'is not blank' || op === 'is null' || op === 'is not null') {
          summary = `${col} ${op}`;
        } else {
          const displayOp = op === 'is' ? '=' : op;
          const valStr = vals.length > 0 ? (vals.length === 1 ? `'${vals[0]}'` : `('${vals.join("', '")}')`) : 'NULL';
          summary = `${col} ${displayOp} ${valStr}`;
        }
        parts.push(summary);
      }
    }
    if (group.childGroups) {
      for (const child of group.childGroups) {
        const childStr = this.getGeneralFilterSummary(child);
        if (childStr && childStr !== '—') {
          parts.push(childStr);
        }
      }
    }
    if (parts.length === 0) return '—';
    const conj = ` ${group.logicalOperator || 'AND'} `;
    return parts.length === 1 ? parts[0] : `(${parts.join(conj)})`;
  }

  get generalFilters(): FilterCondition[] {
    if (this.isGeneralFilterRawMode) {
      return [];
    }
    const scopes = this.generalFilterScopes();
    if (scopes && scopes.length > 0) {
      const allRules: FilterCondition[] = [];
      const collectRules = (group: any): any[] => {
        if (!group) return [];
        let rules = group.rules ? [...group.rules] : [];
        if (group.childGroups) {
          for (const child of group.childGroups) {
            rules = rules.concat(collectRules(child));
          }
        }
        return rules;
      };
      
      for (const sc of scopes) {
        const flat = collectRules(sc.filtersGroup);
        const mapped = flat.map(r => ({
          dimTable: r.tableName !== undefined ? r.tableName : (sc.tableName || ''),
          attribute: r.columnName || r.attribute || '',
          operator: r.operator || '=',
          value: r.value ? (Array.isArray(r.value) ? r.value.join(', ') : r.value.toString()) : '',
          conjunction: sc.filtersGroup.logicalOperator || 'AND'
        }));
        allRules.push(...mapped);
      }
      return allRules;
    }
    return this._generalFiltersLegacy;
  }

  set generalFilters(val: FilterCondition[]) {
    this._generalFiltersLegacy = val;
    if (val && val.length > 0) {
      const mapOperator = (op: string): string => {
        if (!op) return 'is';
        const clean = op.trim().toLowerCase();
        if (clean === '=' || clean === 'is') return 'is';
        if (clean === 'in') return 'in list';
        if (clean === 'not in') return 'not in list';
        return op;
      };
      const rules = val.map((cond: any) => ({
        tableName: cond.dimTable || '',
        columnName: cond.attribute || '',
        operator: mapOperator(cond.operator),
        value: cond.value ? cond.value.toString().split(',').map((s: string) => s.trim()) : []
      }));
      this.generalFiltersGroup = {
        id: 'root',
        logicalOperator: val[0].conjunction || 'AND',
        rules: rules,
        childGroups: []
      };
      this.generalFilterScopes.set([{
        tableName: val[0].dimTable || this.sourceTable || '',
        filtersGroup: this.generalFiltersGroup
      }]);
      this.isGeneralFilterRawMode = false;
    } else {
      this.generalFiltersGroup = null;
      this.generalFilterScopes.set([]);
    }
  }

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
    { value: '<=', label: 'is less or equal' },
  ];

  getOperatorLabel(op: string): string {
    const found = this.operators.find((o) => o.value === op);
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
  pendingRowFilterValues: string[] = [];
  pendingFilterColumns: string[] = [];

  // ── Rows and Columns Data Models ─────────────────────────────────────────
  rows: any[] = [];
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
      });
    } catch (e) {
      console.warn('Reactivity/Effect context not available. Skipping effect creation.', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  get computedTimeframeEnd(): string {
    if (this.timeframeMode === 'today') return this.dateOffsetString(0);
    if (this.timeframeMode === 'today_minus_1') return this.dateOffsetString(-1);
    if (this.timeframeMode === 'today_minus_2') return this.dateOffsetString(-2);
    return this.timeframeEnd;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.loadReportingDates();

    this.reportForm.controls.granularity.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        this.granularities.set(Array.isArray(val) ? val : []);
        this.triggerValidationDebounced();
      });

    this.reportForm.controls.quickFilters.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        const cols = Array.isArray(val) ? val : [];
        this.updateQuickFiltersFromColumns(cols);
        this.triggerValidationDebounced();
      });

    combineLatest({
      params: this.route.params,
      queryParams: this.route.queryParams
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ params, queryParams }) => {
      const id = params['id'];
      const versionVal = queryParams['version'];
      const version = versionVal ? parseInt(versionVal, 10) : undefined;
      this.viewOnlyMode = queryParams['view'] === 'true' || queryParams['readOnly'] === 'true';

      if (id && id !== 'new') {
        this.isNewReport = false;
        this.reportId = id;
        // Fire both fetches in parallel
        forkJoin({
          tables: this.reportService.getTables(),
          config: this.reportService.getReportConfig(id, '2025-12-31', version),
        })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: ({ tables, config }) => {
              this.dbTables = tables;
              this.applyReportConfig(config);
            },
            error: () => this.errorMessage.set('Failed to load report definition details.'),
          });
      } else {
        this.isNewReport = true;
        this.reportService
          .getTables()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (tbls) => {
              this.dbTables = tbls;
              this.loadDwhFieldsTree();
            },
          });
        this.initializeDefaultCatalog();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT CONFIG — LOAD & APPLY
  // ═══════════════════════════════════════════════════════════════════════════

  applyReportConfig(data: any): void {
    this.reportId = data.reportId;
    this.reportName = data.reportName;
    this.reportVersion = data.version || 1;
    this.status = data.status || 'draft';
    this.isLocked = this.status === 'published' || this.status === 'in_review' || this.viewOnlyMode;
    if (this.isLocked) {
      this.reportForm.disable();
    } else {
      this.reportForm.enable();
    }
    this.sourceTable = data.sourceTable || '';
    this.granularity = data.granularity || '';
    this.reportingDate = data.reportingDate || this.dateOffsetString(-1);

    // Timeframe — restore relative mode or custom date
    const offset: number | null = data.timeframeTodayOffset ?? null;
    if (offset === 0) {
      this.timeframeMode = 'today';
    } else if (offset === -1) {
      this.timeframeMode = 'today_minus_1';
    } else if (offset === -2 || (data.timeframeToday === false && !data.timeframeEnd)) {
      this.timeframeMode = 'today_minus_2';
    } else if (data.timeframeToday) {
      // backward-compat: old boolean flag → today
      this.timeframeMode = 'today';
    } else {
      this.timeframeMode = 'custom';
      this.timeframeEnd = this.formatDateForInput(data.timeframeEnd || '');
    }
    this.timeframeStart = this.formatDateForInput(data.timeframeStart || '2022-01-01');

    // Quick filters — try JSON first (new format), fall back from old CSV column-list
    try {
      this.quickFilters = data.quickFilters ? JSON.parse(data.quickFilters) : [];
      if (!Array.isArray(this.quickFilters)) this.quickFilters = [];
      this.quickFilters.forEach((f) => {
        if (!f.conjunction) {
          f.conjunction = 'AND';
        }
        f.operator = this.normalizeFilterOperator(f.operator);
        this.onFilterFieldChanged(f);
      });
    } catch {
      // Legacy: comma-separated column names — convert to stub conditions with no value
      this.quickFilters = data.quickFilters
        ? data.quickFilters
            .split(',')
            .filter(Boolean)
            .map((col: string) => ({
              dimTable: '',
              attribute: col.includes('.') ? col.split('.')[1] : col,
              operator: '=',
              value: '',
              conjunction: 'AND' as const,
            }))
        : [];
    }

    const initialPickerCols = this.quickFilters.map(f => {
      if (f.dimTable) {
        return `${f.dimTable}.${f.attribute}`;
      } else {
        const shortFact = this.sourceTable ? this.sourceTable.replace(/^analytics\./, '') : '';
        return shortFact ? `${shortFact}.${f.attribute}` : f.attribute;
      }
    });
    this.reportForm.controls.quickFilters.setValue(initialPickerCols, { emitEvent: false });

    try {
      const gFiltersStr = data.generalFilters || '';
      if (gFiltersStr.trim().startsWith('[') && gFiltersStr.trim().endsWith(']')) {
        try {
          const parsedScopes = JSON.parse(gFiltersStr);
          if (Array.isArray(parsedScopes) && parsedScopes.length > 0 && (parsedScopes[0].tableName !== undefined || parsedScopes[0].filtersGroup !== undefined)) {
            this.generalFilterScopes.set(parsedScopes);
            this.isGeneralFilterRawMode = false;
            this.generalFilterExpr = '';
            this.generalFiltersGroup = parsedScopes[0].filtersGroup;
          } else {
            const parsed = parseRowFilterExpr(gFiltersStr);
            this.isGeneralFilterRawMode = parsed.isFilterRawMode;
            this.generalFilterExpr = parsed.legacyFilterExpr;
            if (parsed.rowFilters) {
              this.generalFiltersGroup = parsed.rowFilters;
              this.generalFilterScopes.set([{
                tableName: this.sourceTable || '',
                filtersGroup: parsed.rowFilters
              }]);
            } else {
              this.generalFiltersGroup = null;
              this.generalFilterScopes.set([]);
            }
          }
        } catch {
          const parsed = parseRowFilterExpr(gFiltersStr);
          this.isGeneralFilterRawMode = parsed.isFilterRawMode;
          this.generalFilterExpr = parsed.legacyFilterExpr;
          if (parsed.rowFilters) {
            this.generalFiltersGroup = parsed.rowFilters;
            this.generalFilterScopes.set([{
              tableName: this.sourceTable || '',
              filtersGroup: parsed.rowFilters
            }]);
          } else {
            this.generalFiltersGroup = null;
            this.generalFilterScopes.set([]);
          }
        }
      } else {
        const parsed = parseRowFilterExpr(gFiltersStr);
        this.isGeneralFilterRawMode = parsed.isFilterRawMode;
        this.generalFilterExpr = parsed.legacyFilterExpr;
        if (parsed.rowFilters) {
          this.generalFiltersGroup = parsed.rowFilters;
          this.generalFilterScopes.set([{
            tableName: this.sourceTable || '',
            filtersGroup: parsed.rowFilters
          }]);
        } else {
          this.generalFiltersGroup = null;
          this.generalFilterScopes.set([]);
        }
      }
    } catch {
      this.generalFilterScopes.set([]);
      this.generalFiltersGroup = null;
      this.isGeneralFilterRawMode = false;
      this.generalFilterExpr = '';
    }

    // Linked dimensions
    this.linkedDimensions = data.linkedDimensions
      ? data.linkedDimensions.split(',').filter(Boolean)
      : [];

    // Columns
    this.columns = (data.columns || []).map((c: any) => ({
      colId: c.colId,
      label: c.label,
      colType: c.colType === 'WEEK' ? 'WTD' : c.colType, // backward-compat WEEK -> WTD
      headerLayout: c.headerLayout || 'border',
      periodOffset: c.periodOffset,
      rollingN: c.rollingN,
      rollingGrain: c.rollingGrain ?? null, // null for reports saved before this field existed
      formulaExpr: c.formulaExpr,
      tierLevel: c.tierLevel || 'L1',
      parentId: c.parentId || '',
      periodType: c.periodType || '',
      selected: false,
    }));

    // Rows — parse measure + rowFilters
    this.rows = (data.rows || []).map((r: any) => {
      const measure = this.parseMeasure(r.source);
      const { rowFilters, legacyFilterExpr, isFilterRawMode } = this.parseRowFilterExpr(r.filterExpr || '');
      const normalizeGroupOperators = (group: any) => {
        if (!group) return;
        if (Array.isArray(group)) {
          group.forEach((f) => (f.operator = this.normalizeFilterOperator(f.operator)));
          return;
        }
        if (group.rules) {
          group.rules.forEach((rule: any) => {
            rule.operator = this.normalizeFilterOperator(rule.operator);
          });
        }
        if (group.childGroups) {
          group.childGroups.forEach((child: any) => {
            normalizeGroupOperators(child);
          });
        }
      };
      normalizeGroupOperators(rowFilters);

      let sourceStr = '';
      if (typeof r.source === 'string') {
        sourceStr = r.source;
      } else if (r.source && typeof r.source === 'object') {
        sourceStr = r.source.rawSql || r.source.rawExpression || '';
      }

      const row = {
        rowId: r.rowId,
        label: r.label,
        rowType: r.rowType,
        source: sourceStr,
        parentRowId: r.parentRowId || '',
        style: r.style || 'normal',
        indentLevel: r.indentLevel || 0,
        filterExpr: r.filterExpr || '',
        activeCols: Array.from(r.activeCols || []),
        selected: false,
        // Measure builder
        measureAgg: measure.aggFunction,
        measureCol: measure.measureCol,
        sourceTable: measure.sourceTable,
        customSqlMode: measure.customSqlMode,
        // Row filters
        rowFilters,
        legacyFilterExpr,
        isFilterRawMode,
      };
      return this.initRowSignals(row);
    });

    // Load catalog fields tree and dimensions
    this.loadDwhFieldsTree();

    // Eagerly load cached columns for already-linked dimensions
    this.linkedDimensions.forEach((dim) => this.loadDimensionColumns(dim));
    this.runValidation();
  }

  initializeDefaultCatalog(): void {
    this.reportId = crypto.randomUUID();
    this.reportName = '';
    this.reportVersion = 1;
    this.isLocked = false;
    this.viewOnlyMode = false;
    this.reportForm.enable();
    this.sourceTable = '';
    this.granularity = '';
    this.reportingDate = this.dateOffsetString(-1);
    this.timeframeStart = '2022-01-01';
    this.timeframeMode = 'today_minus_2';
    this.timeframeEnd = this.dateOffsetString(-2);
    this.quickFilters = [];
    this.generalFilters = [];
    this.generalFiltersGroup = null;
    this.generalFilterExpr = '';
    this.isGeneralFilterRawMode = false;
    this.generalFilterScopes.set([]);
    this.linkedDimensions = [];

    // Default columns
    this.columns = [];

    // Default rows
    this.rows = [
      this.makeDefaultRow('R1', 'Report Header', 'section', 'section', 0),
    ];
    this.reportForm.controls.granularity.setValue([], { emitEvent: false });
    this.reportForm.controls.quickFilters.setValue([], { emitEvent: false });
    this.runValidation();
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
        this.triggerValidationDebounced();
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(row, 'targetField', {
      get: () => this.getMeasureColPath(row),
      set: (val: string) => {
        this.setMeasureColPath(row, val);
        this.triggerValidationDebounced();
      },
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(row, 'formulaExpr', {
      get: () => row.source,
      set: (val: string) => {
        row.source = val;
        this.triggerValidationDebounced();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE / DIMENSION LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  onTableChange(): void {
    if (!this.sourceTable) {
      this.tableColumns = [];
      this.granularity = '';
      this.dimensionJoins = [];
      this.linkedDimensions = [];
      this.dimensionColumnsCache = {};
      return;
    }
    this.loadTableMetadata(this.sourceTable);
    this.loadDimensionJoins(this.sourceTable);
  }

  loadTableMetadata(table: string): void {
    this.reportService
      .getTableColumns(table)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cols) => {
          this.tableColumns = cols;
        },
      });

    this.reportService
      .getColumnTypes(table)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => {
          this.columnTypesCache = { ...this.columnTypesCache, [table]: types };
        },
      });
  }

  loadDimensionJoins(factTable: string): void {
    this.loadingDimJoins = true;
    this.dimensionJoins = [];
    this.reportService
      .getDimensionJoins(factTable)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (joins) => {
          this.dimensionJoins = joins || [];
          this.loadingDimJoins = false;
        },
        error: () => {
          this.loadingDimJoins = false;
          // Fail silently — joins panel just won't show
        },
      });
  }

  loadDimensionColumns(dimView: string): void {
    if (this.dimensionColumnsCache[dimView]) return; // already cached
    this.reportService
      .getTableColumns(dimView)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cols) => {
          this.dimensionColumnsCache = { ...this.dimensionColumnsCache, [dimView]: cols };
          this.previewTrigger.update((v) => v + 1); // trigger granularity/options recalculation
        },
      });

    this.reportService
      .getColumnTypes(dimView)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => {
          this.columnTypesCache = { ...this.columnTypesCache, [dimView]: types };
          this.previewTrigger.update((v) => v + 1); // trigger granularity/options recalculation
        },
      });
  }

  getDimColumns(dimView: string): string[] {
    return this.dimensionColumnsCache[dimView] || [];
  }

  isDimensionLinked(dimView: string): boolean {
    return this.linkedDimensions.includes(dimView);
  }

  toggleLinkedDimension(dimView: string): void {
    if (this.mismatchedDimensions().includes(dimView)) {
      this.errorMessage.set(
        `Cannot link mismatched dimension "${dimView}": it is not supported by all active fact tables.`,
      );
      setTimeout(() => this.errorMessage.set(null), 4000);
      return;
    }
    const idx = this.linkedDimensions.indexOf(dimView);
    if (idx === -1) {
      this.linkedDimensions.push(dimView);
      this.loadDimensionColumns(dimView); // lazy-load on first enable
    } else {
      this.linkedDimensions.splice(idx, 1);
    }
  }

  getColumnsForFilterTable(dimTable: string | undefined): string[] {
    if (!dimTable) return this.tableColumns; // fact table
    return this.getDimColumns(dimTable);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMEFRAME
  // ═══════════════════════════════════════════════════════════════════════════

  setTimeframeMode(mode: 'custom' | 'today_minus_2' | 'today_minus_1' | 'today'): void {
    this.timeframeMode = mode;
    if (mode === 'today_minus_2') this.timeframeEnd = this.dateOffsetString(-2);
    if (mode === 'today_minus_1') this.timeframeEnd = this.dateOffsetString(-1);
    if (mode === 'today') this.timeframeEnd = this.dateOffsetString(0);
    // 'custom' leaves timeframeEnd as-is for the user to pick
  }

  private todayString(): string {
    return this.dateOffsetString(0);
  }
  private dateOffsetString(n: number): string {
    return dateOffsetString(n);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTING DATE & CUSTOM CALENDAR WIDGET
  // ═══════════════════════════════════════════════════════════════════════════

  loadReportingDates(): void {
    this.reportService
      .getReportingDates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dates) => {
          this.availableReportingDates = dates || [];
          this.previewTrigger.update((v) => v + 1);
        },
        error: () => {
          /* fail silently — user can still type a date */
        },
      });
  }

  formatDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  toggleDatePicker(): void {
    this.showDatePicker.set(!this.showDatePicker());
    if (this.showDatePicker()) {
      this.initializeCalendarView();
    }
  }

  initializeCalendarView(): void {
    let dateToUse = new Date();
    if (this.reportingDate) {
      const parsed = new Date(this.reportingDate);
      if (!isNaN(parsed.getTime())) {
        dateToUse = parsed;
      }
    } else if (this.availableReportingDates && this.availableReportingDates.length > 0) {
      const sorted = [...this.availableReportingDates].sort();
      const parsed = new Date(sorted[0]);
      if (!isNaN(parsed.getTime())) {
        dateToUse = parsed;
      }
    }
    this.calendarYear.set(dateToUse.getFullYear());
    this.calendarMonth.set(dateToUse.getMonth());
  }

  prevMonth(): void {
    if (this.calendarMonth() === 0) {
      this.calendarMonth.set(11);
      this.calendarYear.update((y) => y - 1);
    } else {
      this.calendarMonth.update((m) => m - 1);
    }
  }

  nextMonth(): void {
    if (this.calendarMonth() === 11) {
      this.calendarMonth.set(0);
      this.calendarYear.update((y) => y + 1);
    } else {
      this.calendarMonth.update((m) => m + 1);
    }
  }

  selectCalendarDay(day: CalendarDay): void {
    if (!day.isEnabled) return;
    this.reportingDate = day.formattedStr;
    this.showDatePicker.set(false);
    this.triggerValidationDebounced();
  }

  prevTimeframeEndMonth(): void {
    if (this.calendarTimeframeEndMonth() === 0) {
      this.calendarTimeframeEndMonth.set(11);
      this.calendarTimeframeEndYear.update((y) => y - 1);
    } else {
      this.calendarTimeframeEndMonth.update((m) => m - 1);
    }
  }

  nextTimeframeEndMonth(): void {
    if (this.calendarTimeframeEndMonth() === 11) {
      this.calendarTimeframeEndMonth.set(0);
      this.calendarTimeframeEndYear.update((y) => y + 1);
    } else {
      this.calendarTimeframeEndMonth.update((m) => m + 1);
    }
  }

  selectTimeframeEndCalendarDay(day: CalendarDay): void {
    if (!day.isEnabled) return;
    this.timeframeEnd = day.formattedStr;
    this.showTimeframeEndDatePicker.set(false);
    this.triggerValidationDebounced();
  }

  toggleTimeframeEndDatePicker(): void {
    this.showTimeframeEndDatePicker.set(!this.showTimeframeEndDatePicker());
    if (this.showTimeframeEndDatePicker()) {
      let dateToUse = new Date();
      if (this.timeframeEnd) {
        const parsed = new Date(this.timeframeEnd);
        if (!isNaN(parsed.getTime())) {
          dateToUse = parsed;
        }
      }
      this.calendarTimeframeEndYear.set(dateToUse.getFullYear());
      this.calendarTimeframeEndMonth.set(dateToUse.getMonth());
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSIONING & LIFECYCLE STATE MACHINE
  // ═══════════════════════════════════════════════════════════════════════════

  onStatusChange(newStatus: string): void {
    const prev = this.status;
    this.status = newStatus;
    if (prev === 'draft' && newStatus === 'published') {
      this.reportVersion = (this.reportVersion || 0) + 1;
    }
    this.triggerValidationDebounced();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  addQuickFilter(): void {
    this.quickFilters.push({
      dimTable: '',
      attribute: '',
      operator: '=',
      value: '',
      conjunction: 'AND',
    });
  }

  removeQuickFilter(index: number): void {
    this.quickFilters.splice(index, 1);
  }

  updateQuickFiltersFromColumns(cols: string[]): void {
    const currentMap = new Map<string, QuickFilterCondition>();
    this.quickFilters.forEach(f => {
      const key = f.dimTable ? `${f.dimTable}.${f.attribute}` : `${this.sourceTable.replace(/^analytics\./, '')}.${f.attribute}`;
      currentMap.set(key, f);
    });

    const updatedFilters: QuickFilterCondition[] = [];
    cols.forEach(col => {
      if (currentMap.has(col)) {
        updatedFilters.push(currentMap.get(col)!);
      } else {
        const parts = col.split('.');
        let dimTable = '';
        let attribute = col;
        if (parts.length > 1) {
          const tablePart = parts[0];
          const colPart = parts.slice(1).join('.');
          const shortFact = this.sourceTable ? this.sourceTable.replace(/^analytics\./, '') : '';
          if (tablePart === shortFact || tablePart === this.sourceTable) {
            dimTable = '';
          } else {
            dimTable = tablePart;
          }
          attribute = colPart;
        }
        updatedFilters.push({
          dimTable,
          attribute,
          operator: '=',
          value: '',
          conjunction: 'AND'
        });
      }
    });

    this.quickFilters = updatedFilters;
  }

  onQuickFilterTableChange(filter: QuickFilterCondition): void {
    filter.attribute = '';
    filter.value = '';
    filter.availableValues = [];
    filter.showDropdown = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAL FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  addGeneralFilter(): void {
    this.generalFilters.push({
      dimTable: '',
      attribute: '',
      operator: '=',
      value: '',
      conjunction: 'AND',
    });
  }

  removeGeneralFilter(index: number): void {
    this.generalFilters.splice(index, 1);
  }

  onGeneralFilterTableChange(filter: FilterCondition): void {
    filter.attribute = '';
    filter.value = '';
    filter.availableValues = [];
    filter.showDropdown = false;
  }

  onFilterFieldChanged(filter: any): void {
    const table = filter.dimTable || this.sourceTable;
    const column = filter.attribute;

    filter.availableValues = [];

    if (!table || !column) {
      return;
    }

    this.reportService.getMetadataDistinctValues(table, column).subscribe({
      next: (values: string[]) => {
        filter.availableValues = values || [];
      },
      error: (err) => {
        console.warn('Failed to fetch metadata distinct values:', err);
        filter.availableValues = [];
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW FILTER BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  openRowFilterBuilder(row: any): void {
    this.activeRowFilterId = row.rowId;
    this.pendingRowFilter = { dimTable: '', attribute: '', operator: '=', value: '' };
    this.pendingRowFilterValues = [];
    this.pendingFilterColumns = row.sourceTable
      ? this.columnTypesCache[row.sourceTable]
        ? Object.keys(this.columnTypesCache[row.sourceTable])
        : []
      : [];
  }

  cancelRowFilter(): void {
    this.activeRowFilterId = '';
    this.pendingRowFilter = { dimTable: '', attribute: '', operator: '=', value: '' };
    this.pendingRowFilterValues = [];
    this.pendingFilterColumns = [];
  }

  onPendingFilterTableChange(row: any): void {
    this.pendingRowFilter.attribute = '';
    this.pendingRowFilter.value = '';
    this.pendingRowFilterValues = [];
    const table = this.pendingRowFilter.dimTable || row.sourceTable;
    if (this.pendingRowFilter.dimTable) {
      this.loadDimensionColumns(this.pendingRowFilter.dimTable);
      // Give the cache update a moment to propagate, then refresh columns
      setTimeout(() => {
        this.pendingFilterColumns = this.getDimColumns(this.pendingRowFilter.dimTable) || [];
      }, 100);
    } else if (row.sourceTable) {
      this.pendingFilterColumns = this.columnTypesCache[row.sourceTable]
        ? Object.keys(this.columnTypesCache[row.sourceTable])
        : [];
    } else {
      this.pendingFilterColumns = [];
    }
  }

  onPendingFilterAttrChange(row: any): void {
    this.pendingRowFilter.value = '';
    const table = this.pendingRowFilter.dimTable || row.sourceTable;
    const attr = this.pendingRowFilter.attribute;
    if (!table || !attr) return;
    const key = `${table}.${attr}`;
    if (this.distinctValues[key]) {
      this.pendingRowFilterValues = this.distinctValues[key];
      return;
    }
    this.reportService
      .getDistinctValues(table, attr)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vals) => {
          this.distinctValues = { ...this.distinctValues, [key]: vals };
          this.pendingRowFilterValues = vals;
        },
      });
  }

  confirmRowFilter(row: any): void {
    if (!this.pendingRowFilter.attribute) return;

    const table = this.pendingRowFilter.dimTable || row.sourceTable;
    const colTypes = this.columnTypesCache[table];
    if (colTypes && this.pendingRowFilter.value && this.pendingRowFilter.value.trim() !== '') {
      const type = colTypes[this.pendingRowFilter.attribute];
      if (type && !this.validateFilterValue(type, this.pendingRowFilter.value)) {
        alert(
          `Validation failed: Value "${this.pendingRowFilter.value}" is not valid for column "${this.pendingRowFilter.attribute}" of type "${type}" in table "${table}".`,
        );
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
    
    if (value.includes(',')) {
      const parts = value.split(',').map(p => p.trim());
      return parts.every(part => {
        let cleanPart = part;
        if (cleanPart.startsWith("'") && cleanPart.endsWith("'") && cleanPart.length >= 2) {
          cleanPart = cleanPart.substring(1, cleanPart.length - 1);
        }
        return this.validateSingleFilterValue(lowerType, cleanPart);
      });
    }

    let cleanVal = value.trim();
    if (cleanVal.startsWith("'") && cleanVal.endsWith("'") && cleanVal.length >= 2) {
      cleanVal = cleanVal.substring(1, cleanVal.length - 1);
    }
    return this.validateSingleFilterValue(lowerType, cleanVal);
  }

  private validateSingleFilterValue(lowerType: string, trimmed: string): boolean {
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

    if (
      lowerType.includes('date') ||
      lowerType.includes('timestamp') ||
      lowerType.includes('time')
    ) {
      if (trimmed === '') return false;
      const timestamp = Date.parse(trimmed);
      if (isNaN(timestamp)) return false;
      if (/^\d+$/.test(trimmed) && trimmed.length < 4) return false;
      return true;
    }

    return true;
  }

  isFilterValueInvalid(filter: any, defaultTable: string = this.sourceTable): boolean {
    if (!filter.attribute || !filter.value || filter.value.trim() === '') return false;
    const table = filter.dimTable || defaultTable;
    if (!table) return false;
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
      row.rowFilters = [];
      row.legacyFilterExpr = '';
      row.sourceTable = '';
    }
    if (row.rowType === 'section' || row.rowType === 'blank') {
      row.source = '';
      row.customSqlMode = false;
    }
    this.updateDimensionStates();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DWH CATALOG & CROSS-FACT DRAG-AND-DROP METRICS
  // ═══════════════════════════════════════════════════════════════════════════

  formatCategory(tableName: string): string {
    const name = tableName.replace(/^analytics\./, '').toLowerCase();
    if (name.includes('sales')) return 'Sales Performance';
    if (name.includes('loan')) return 'Credit Operations';
    if (name.includes('investment')) return 'Investment & Equity Balances';
    if (name.includes('banking_transaction') || name.includes('transaction'))
      return 'Banking Transactions';
    if (name.includes('reconciliation') || name.includes('reconcile'))
      return 'Financial Reconciliation';
    return name
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  loadDwhFieldsTree(): void {
    if (this.dbTables.length === 0) return;

    const tableFetches = this.dbTables.reduce(
      (acc, table) => {
        acc[table] = forkJoin({
          cols: this.reportService.getTableColumns(table),
          types: this.reportService.getColumnTypes(table),
          joins: this.reportService.getDimensionJoins(table),
        });
        return acc;
      },
      {} as { [table: string]: any },
    );

    forkJoin(tableFetches)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const fieldGroups: FieldGroup[] = [];
          this.factToDimensionsMap = {};

          for (const table of this.dbTables) {
            const cols = res[table]?.cols || [];
            const types = res[table]?.types || {};
            const joins = res[table]?.joins || [];

            this.columnTypesCache = { ...this.columnTypesCache, [table]: types };
            this.factToDimensionsMap[table] = joins.map((j: any) => j.dimView);

            // Cache dimension columns and types under their short names for granularity picker lookup
            if (table.includes('dim_') || !table.includes('fact_')) {
              const shortName = table.replace(/^analytics\./, '');
              this.dimensionColumnsCache = { ...this.dimensionColumnsCache, [shortName]: cols };
              this.columnTypesCache = { ...this.columnTypesCache, [shortName]: types };
            }

            const fields = cols.map((col: string) => ({
              name: col,
              displayName: col
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' '),
              sourceTable: table,
              type: types[col] || 'varchar',
            }));

            fieldGroups.push({
              category: this.formatCategory(table),
              sourceTable: table,
              fields,
            });
          }

          this.dwhFieldsTree.set(fieldGroups);
          // Bug fix #1: Boot fully collapsed. Drawers expand only when a search query matches.
          this.expandedCategories.set([]);
          this.updateDimensionStates();
        },
        error: (err) => {
          console.warn('Error loading DWH Fields Tree:', err);
        },
      });
  }

  isCategoryExpanded(table: string): boolean {
    const query = this.fieldsSearchQuery().trim();
    if (query) {
      const group = this.dwhFieldsTree().find((g) => g.sourceTable === table);
      if (group) {
        const normalize = (str: string) => {
          if (!str) return '';
          return str.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        };
        const normalizedQuery = normalize(query);
        const normalizedTable = normalize(group.sourceTable);
        const normalizedCategory = normalize(group.category);
        if (
          normalizedTable.includes(normalizedQuery) ||
          normalizedCategory.includes(normalizedQuery)
        ) {
          return true; // Force expanded
        }
      }
    }
    return this.expandedCategories().includes(table);
  }

  toggleCategoryExpanded(table: string): void {
    const current = this.expandedCategories();
    if (current.includes(table)) {
      this.expandedCategories.set(current.filter((t) => t !== table));
    } else {
      this.expandedCategories.set([...current, table]);
    }
  }

  onFieldDragStart(event: DragEvent, field: DwhField): void {
    event.dataTransfer?.setData('application/json', JSON.stringify(field));
  }

  onRowDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
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
    const selectedRow = this.rows.find((r) => r.selected && r.rowType === 'data');
    if (selectedRow) {
      this.assignFieldToRow(selectedRow, field);
      this.successMessage.set(`Assigned ${field.name} to row ${selectedRow.rowId}`);
      setTimeout(() => this.successMessage.set(null), 2000);
    } else {
      this.errorMessage.set(
        'Please select a data row in the canvas first, then click a field to assign.',
      );
      setTimeout(() => this.errorMessage.set(null), 3000);
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
    this.triggerValidationDebounced();
    this.updateDimensionStates();
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
    this.triggerValidationDebounced();
    this.updateDimensionStates();
  }

  updateDimensionStates(): void {
    const activeFactTables = this.rows
      .filter((r) => r.rowType === 'data' && r.sourceTable)
      .map((r) => r.sourceTable);
    const uniqueFacts = Array.from(new Set(activeFactTables));

    if (uniqueFacts.length === 0) {
      const allDimTables = this.dbTables
        .filter((t) => t.includes('dim_') || !t.includes('fact_'))
        .map((t) => t.replace(/^analytics\./, ''));
      this.conformedDimensions.set(allDimTables);
      this.mismatchedDimensions.set([]);
      this.allAvailableDimensions.set(allDimTables);
      this.linkedDimensions = [];
      allDimTables.forEach((dim) => this.loadDimensionColumns(dim));
      return;
    }

    const allDims = new Set<string>();
    uniqueFacts.forEach((fact) => {
      const dims = this.factToDimensionsMap[fact] || [];
      dims.forEach((d) => allDims.add(d));
    });

    const allDimsArray = Array.from(allDims);
    this.allAvailableDimensions.set(allDimsArray);

    const conformed = allDimsArray.filter((dim) =>
      uniqueFacts.every((fact) => {
        const dims = this.factToDimensionsMap[fact] || [];
        return dims.includes(dim);
      }),
    );
    this.conformedDimensions.set(conformed);

    const mismatched = allDimsArray.filter((dim) => !conformed.includes(dim));
    this.mismatchedDimensions.set(mismatched);

    // Auto-unlink mismatched dimensions to ensure catalog configuration safety
    this.linkedDimensions = this.linkedDimensions.filter((dim) => conformed.includes(dim));

    // Eagerly load columns/types for conformed dimensions to ensure dropdowns are populated
    conformed.forEach((dim) => this.loadDimensionColumns(dim));
  }

  getActiveFactTables(): string[] {
    const active = this.rows
      .filter((r) => r.rowType === 'data' && r.sourceTable)
      .map((r) => r.sourceTable);
    return Array.from(new Set(active));
  }

  onRowMeasureChange(row: any): void {
    row.source = `${row.measureAgg || 'SUM'}(${row.measureCol || ''})`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEASURE SERIALIZATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private parseMeasure(source: any): {
    aggFunction: string;
    measureCol: string;
    sourceTable: string;
    customSqlMode: boolean;
    rawExpression: string;
  } {
    return parseMeasure(source);
  }

  private parseRowFilterExpr(filterExpr: string): {
    rowFilters: RowFilterCondition[];
    legacyFilterExpr: string;
    isFilterRawMode: boolean;
  } {
    return parseRowFilterExpr(filterExpr);
  }

  private serializeMeasure(row: any): any {
    return serializeMeasure(row);
  }

  private serializeRowFilters(row: any): string {
    return serializeRowFilters(row);
  }

  private serializeGeneralFilters(): string {
    if (this.isGeneralFilterRawMode) return this.generalFilterExpr || '';
    const scopes = this.generalFilterScopes();
    if (scopes && scopes.length > 0) {
      return JSON.stringify(scopes);
    }
    return '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROWS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  addRow(): void {
    const n = this.rows.length + 1;
    this.rows.push(
      this.makeDefaultRow(`R${n}`, `New Row ${n}`, 'data', 'normal', 0, {
        agg: 'SUM',
        col: '',
        table: '',
        filters: [],
      }),
    );
    this.updateDimensionStates();
  }

  resetRows(): void {
    if (confirm('Are you sure you want to reset all rows?')) {
      this.rows = [];
      this.updateDimensionStates();
    }
  }

  deleteRow(index: number): void {
    const r = this.rows[index];
    if (confirm(`Delete row "${r.label || r.rowId}"?`)) {
      this.rows.splice(index, 1);
      this.updateDimensionStates();
    }
  }

  deleteSelectedRows(): void {
    const n = this.rows.filter((r) => r.selected).length;
    if (!n) {
      alert('Select at least one row to delete.');
      return;
    }
    if (confirm(`Delete ${n} selected row(s)?`)) {
      this.rows = this.rows.filter((r) => !r.selected);
      this.updateDimensionStates();
    }
  }

  duplicateSelectedRow(): void {
    const sel = this.rows.filter((r) => r.selected);
    if (!sel.length) {
      alert('Select at least one row to duplicate.');
      return;
    }
    sel.forEach((sr) => {
      const copied = {
        ...sr,
        rowId: `R${this.rows.length + 1}`,
        label: `${sr.label} (Copy)`,
        selected: false,
        rowFilters: sr.rowFilters ? JSON.parse(JSON.stringify(sr.rowFilters)) : null,
      };
      this.rows.push(this.initRowSignals(copied));
    });
    this.updateDimensionStates();
  }

  updateRowField(rowId: string, fieldPath: string): void {
    const row = this.rows.find((r) => r.rowId === rowId);
    if (row) {
      this.setMeasureColPath(row, fieldPath);
      this.triggerValidationDebounced();
    }
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
    this.rows.forEach((r) => (r.selected = checked));
  }

  changeIndent(row: any, diff: number): void {
    row.indentLevel = Math.max(0, (row.indentLevel || 0) + diff);
  }

  toggleColForRow(row: any, colId: string): void {
    const cid = colId.toUpperCase();
    const idx = row.activeCols.indexOf(cid);
    if (idx === -1) row.activeCols.push(cid);
    else row.activeCols.splice(idx, 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMNS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  addColumn(): void {
    const n = this.columns.length + 1;
    this.columns.push({
      colId: `C${n}`,
      label: `Column ${n}`,
      colType: 'WTD',
      headerLayout: 'border',
      periodOffset: 0,
      rollingN: null,
      rollingGrain: null, // populated when user picks ROLLING grain
      formulaExpr: '',
      tierLevel: 'L1',
      parentId: '',
      periodType: '',
      selected: false,
    });
  }

  resetColumns(): void {
    if (confirm('Reset all columns?')) this.columns = [];
  }

  deleteColumn(index: number): void {
    const c = this.columns[index];
    if (confirm(`Delete column "${c.label || c.colId}"?`)) {
      const cid = c.colId.toUpperCase();
      this.columns.splice(index, 1);
      this.rows.forEach((row) => {
        if (row.activeCols)
          row.activeCols = row.activeCols.filter((id: string) => id.toUpperCase() !== cid);
      });
    }
  }

  onColTypeChange(col: any): void {
    if (col.colType === 'ROLLING') {
      if (!col.rollingN) col.rollingN = 3;
      if (!col.rollingGrain) col.rollingGrain = 'MONTH';
    } else {
      col.rollingN = null;
      col.rollingGrain = null; // clear grain when leaving ROLLING
    }
    if (col.colType !== 'CALC') {
      col.formulaExpr = '';
    }
    if (col.colType === 'HEADER') {
      col.periodOffset = 0;
    }
  }

  deleteSelectedCols(): void {
    const sel = this.columns.filter((c) => c.selected);
    if (!sel.length) {
      alert('Select at least one column to delete.');
      return;
    }
    if (confirm(`Delete ${sel.length} selected column(s)?`)) {
      const ids = sel.map((c) => c.colId.toUpperCase());
      this.columns = this.columns.filter((c) => !c.selected);
      this.rows.forEach((row) => {
        if (row.activeCols)
          row.activeCols = row.activeCols.filter((id: string) => !ids.includes(id.toUpperCase()));
      });
    }
  }

  getL1Parents(col: any): any[] {
    return this.columns.filter((c) => c.tierLevel === 'L1' && c.colId !== col.colId);
  }

  onTierLevelChange(col: any): void {
    if (col.tierLevel === 'L1') {
      col.parentId = '';
      col.formulaExpr = '';
    }
  }

  duplicateSelectedColumn(): void {
    const sel = this.columns.filter((c) => c.selected);
    if (!sel.length) {
      alert('Select at least one column to duplicate.');
      return;
    }
    sel.forEach((sc) =>
      this.columns.push({
        ...sc,
        colId: `C${this.columns.length + 1}`,
        label: `${sc.label} (Copy)`,
        selected: false,
      }),
    );
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
    this.columns.forEach((c) => (c.selected = checked));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  togglePreview(): void {
    this.showPreview.set(!this.showPreview());
  }

  saveConfig(): void {
    if (!this.reportId || !this.reportName) {
      this.errorMessage.set('Report ID and Report Title are mandatory fields.');
      return;
    }

    if (this.columns.length === 0) {
      this.errorMessage.set('At least one column definition is required. Please add a column under Columns Setup.');
      return;
    }

    // Prevent saving if labels start with formula triggers (=, +, -, @)
    const formulaTriggers = ['=', '+', '-', '@'];
    for (const c of this.columns) {
      if (formulaTriggers.some((t) => (c.label || '').trim().startsWith(t))) {
        this.errorMessage.set(
          `Validation failed: Column label "${c.label}" cannot start with formula triggers (=, +, -, @) to prevent formula injection.`,
        );
        return;
      }
    }
    for (const r of this.rows) {
      if (formulaTriggers.some((t) => (r.label || '').trim().startsWith(t))) {
        this.errorMessage.set(
          `Validation failed: Row label "${r.label}" cannot start with formula triggers (=, +, -, @) to prevent formula injection.`,
        );
        return;
      }
    }

    if (!this.isValid()) {
      const firstError = this.validationErrors().find((e) => e.errorSeverity === 'CRITICAL');
      this.errorMessage.set(
        `Cannot save: ${firstError ? firstError.displayMessage : 'Please resolve all critical validation diagnostics first.'}`,
      );
      return;
    }

    const activeFacts = this.getActiveFactTables();
    if (activeFacts.length === 0) {
      this.errorMessage.set('At least one data row with a valid catalog source field is required.');
      return;
    }

    // Validate quick filters
    for (const filter of this.quickFilters) {
      if (filter.attribute && filter.value && filter.value.trim() !== '') {
        const table = filter.dimTable || this.sourceTable;
        if (table) {
          const colTypes = this.columnTypesCache[table];
          if (colTypes) {
            const type = colTypes[filter.attribute];
            if (type && !this.validateFilterValue(type, filter.value)) {
              this.errorMessage.set(
                `Validation failed: Value "${filter.value}" is not valid for column "${filter.attribute}" of type "${type}" in table "${table}".`,
              );
              return;
            }
          }
        }
      }
    }

    // Validate general filters
    for (const filter of this.generalFilters) {
      if (filter.attribute && filter.value && filter.value.trim() !== '') {
        const table = filter.dimTable || this.sourceTable;
        if (table) {
          const colTypes = this.columnTypesCache[table];
          if (colTypes) {
            const type = colTypes[filter.attribute];
            if (type && !this.validateFilterValue(type, filter.value)) {
              this.errorMessage.set(
                `Validation failed: Value "${filter.value}" is not valid for column "${filter.attribute}" of type "${type}" in table "${table}".`,
              );
              return;
            }
          }
        }
      }
    }

    // Validate row filters
    for (const row of this.rows) {
      if (row.rowFilters) {
        const collectRules = (group: any): any[] => {
          if (!group) return [];
          if (Array.isArray(group)) return group;
          let rules = group.rules ? [...group.rules] : [];
          if (group.childGroups) {
            for (const child of group.childGroups) {
              rules = rules.concat(collectRules(child));
            }
          }
          return rules;
        };

        const flatRules = collectRules(row.rowFilters);
        for (const rule of flatRules) {
          const colName = rule.columnName || rule.attribute;
          const tableName = rule.tableName !== undefined ? rule.tableName : rule.dimTable;
          const valStr = rule.value ? (Array.isArray(rule.value) ? rule.value.join(', ') : rule.value.toString()) : '';

          if (colName && valStr && valStr.trim() !== '') {
            const table = tableName || row.sourceTable;
            if (table) {
              const colTypes = this.columnTypesCache[table];
              if (colTypes) {
                const type = colTypes[colName];
                if (type && !this.validateFilterValue(type, valStr)) {
                  this.errorMessage.set(
                    `Validation failed: Value "${valStr}" is not valid for column "${colName}" of type "${type}" in row "${row.label || row.rowId}".`,
                  );
                  return;
                }
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
      reportId: this.reportId,
      reportName: this.reportName,
      version: this.reportVersion,
      exploreId: 1,
      status: this.status,
      granularity: this.granularity,
      reportingDate: this.reportingDate,
      timeframeStart: this.timeframeStart,
      timeframeEnd: this.computedTimeframeEnd,
      // Relative offset: 0=today, -1=today-1, -2=today-2, null=custom absolute date
      timeframeTodayOffset:
        this.timeframeMode === 'today'
          ? 0
          : this.timeframeMode === 'today_minus_1'
            ? -1
            : this.timeframeMode === 'today_minus_2'
              ? -2
              : null,
      timeframeToday: this.timeframeMode === 'today', // backward-compat
      quickFilters: JSON.stringify(this.quickFilters),
      generalFilters: this.serializeGeneralFilters(),
      linkedDimensions: this.linkedDimensions.join(','),
      columns: this.columns.map((c, i) => ({
        colId: c.colId,
        label: c.label,
        colType: c.colType,
        periodOffset: c.periodOffset || 0,
        rollingN: (c.colType === 'WTD' || c.colType === 'MTD' || c.colType === 'YTD' || c.colType === 'ROLLING') ? c.rollingN : null,
        rollingGrain: c.colType === 'ROLLING' ? c.rollingGrain : null,
        formulaExpr: c.colType === 'CALC' ? c.formulaExpr : '',
        tierLevel: c.tierLevel || 'L1',
        parentId: c.parentId || '',
        periodType: c.periodType || null,
        displayOrder: i + 1,
      })),
      rows: this.rows.map((r, i) => ({
        rowId: r.rowId,
        reportId: this.reportId,
        label: r.label,
        rowType: r.rowType,
        source: this.serializeMeasure(r),
        parentRowId: r.parentRowId || null,
        style: r.style || 'normal',
        indentLevel: r.indentLevel,
        displayOrder: i + 1,
        activeCols: r.activeCols,
        filterExpr: this.serializeRowFilters(r),
      })),
    };

    const req$ = this.isNewReport
      ? this.reportService.createReport(payload)
      : this.reportService.saveReport(this.reportId, payload);

    req$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Report definition successfully saved!');
        if (this.isNewReport) {
          this.isNewReport = false;
          setTimeout(() => this.router.navigate(['/reports', this.reportId, 'edit']), 1200);
        } else {
          setTimeout(() => this.successMessage.set(null), 2000);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to persist report definition.');
      },
    });
  }

  submitForReview(): void {
    if (!this.reportId) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.reportService.submitReview(this.reportId, this.reportVersion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.status = 'in_review';
          this.isLocked = true;
          this.reportForm.disable();
          this.successMessage.set('Report submitted for review successfully.');
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to submit report for review.');
        }
      });
  }

  rejectReport(): void {
    if (!this.reportId) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.reportService.rejectReport(this.reportId, this.reportVersion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.status = 'draft';
          this.isLocked = false;
          this.reportForm.enable();
          this.successMessage.set('Report rejected back to draft successfully.');
          setTimeout(() => this.successMessage.set(null), 3000);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to reject report.');
        }
      });
  }

  publishReport(): void {
    if (!this.reportId) return;
    if (!confirm('Are you sure you want to publish this report version? Once published, this version will be permanently locked.')) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.reportService.publishReport(this.reportId, this.reportVersion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.saving.set(false);
          this.status = 'published';
          this.isLocked = true;
          this.reportForm.disable();
          this.successMessage.set(`Report v${res.publishedVersion || this.reportVersion} has been successfully published and locked!`);
          
          setTimeout(() => {
            this.successMessage.set(null);
          }, 4000);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to publish report.');
        }
      });
  }

  createDraftFromPublished(): void {
    if (!this.reportId) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.reportService.forkReport(this.reportId, this.reportVersion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.saving.set(false);
          this.successMessage.set(`New draft version v${res.nextDraftVersion} created successfully! Redirecting to the editable draft...`);
          setTimeout(() => {
            this.successMessage.set(null);
            this.router.navigate(['/reports', this.reportId, 'edit'], { 
              queryParams: { version: res.nextDraftVersion } 
            });
          }, 1500);
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to create new draft version.');
        }
      });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  goBack(): void {
    if (this.viewOnlyMode) {
      this.router.navigate(['/dashboard']);
      return;
    }
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
