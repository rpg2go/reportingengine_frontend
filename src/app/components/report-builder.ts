import { Component, OnInit, signal, computed, effect, DestroyRef, inject, ViewEncapsulation } from '@angular/core';
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
import { SidebarComponent } from './sidebar';
import { CalendarPickerComponent } from './calendar-picker';
import { GranularityPickerComponent } from './granularity-picker';
import { GeneralFilterModalComponent } from './general-filter-modal';
import { TableFilterScope } from '../interfaces/general-filter.interface';
import { LiveLayoutPreviewComponent } from './live-layout-preview';
import { CoreReportDetailsComponent } from './core-report-details';
import { ValidationDiagnosticsComponent } from './validation-diagnostics';
import { SqlPreviewModalComponent } from './sql-preview-modal';
import { RowsSetupComponent } from './rows-setup';
import { ColumnsSetupComponent } from './columns-setup';

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
export interface RowFilterCondition {
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
    SidebarComponent,
    GeneralFilterModalComponent,
    LiveLayoutPreviewComponent,
    CoreReportDetailsComponent,
    ValidationDiagnosticsComponent,
    SqlPreviewModalComponent,
    RowsSetupComponent,
    ColumnsSetupComponent,
  ],

  templateUrl: './report-builder.html',
  styleUrl: './report-builder.css',
  encapsulation: ViewEncapsulation.None,
})

/**
 * ReportBuilderComponent
 *
 * Root orchestrator for the metadata-driven report layout builder page.
 * Accessed via routes `/reports/new` (create) and `/reports/:id/edit` (edit).
 *
 * Manages the full lifecycle of building a report: loading schema metadata,
 * configuring rows/columns/filters, validating the configuration, previewing
 * the compiled SQL, and saving/publishing the report version.
 *
 * ============================================================================
 * 1. DECOMPOSED ARCHITECTURE & SUB-COMPONENTS
 * ============================================================================
 *
 * To maintain clean code separation, the builder is modularized into these
 * dedicated standalone sub-components:
 *
 *  - `CoreReportDetailsComponent`    (Step 1 header panel)
 *    Handles report name, granularity, timeframes. Delegates date config
 *    to `CoreTimeEngineComponent`. Triggers general filter modal.
 *
 *  - `RowsSetupComponent`            (Step 1 rows grid)
 *    Manages rows (labels, types, indent, aggregations, filter conditions).
 *    Embeds the searchable DWH catalog panel and `RowFilterComponent`.
 *
 *  - `ColumnsSetupComponent`         (Step 2 columns grid)
 *    Handles column headers, tier levels (L1/L2), rolling date offsets,
 *    sub-column nesting, and math formula expressions.
 *
 *  - `ValidationDiagnosticsComponent` (diagnostics banner)
 *    Renders warning/error banners from `POST /api/reports/validate`.
 *
 *  - `SqlPreviewModalComponent`      (dry-run modal)
 *    Displays the compiled SQL from `POST /api/reports/preview-sql`.
 *
 *  - `LiveLayoutPreviewComponent`    (Step 3 preview panel)
 *    Renders a real-time wireframe grid of the current column/row config.
 *
 *  - `GeneralFilterModalComponent`   (global filter modal)
 *    Configures report-level (cross-row) filter scopes and raw SQL filters.
 *
 * ============================================================================
 * 2. STATE FLOWS & REACTION PIPELINE
 * ============================================================================
 *
 *  - On `ngOnInit`, fires `forkJoin([getTables(), getReportConfig()])` in
 *    parallel to minimize perceived load time.
 *  - Child components share state via Angular signal model inputs / outputs.
 *  - `onModelChange()` is the global change sink called by all child emitters;
 *    it marks the form dirty and syncs `validationErrors` after a debounce.
 *
 * ============================================================================
 * 3. THEME SYSTEM & ENCAPSULATION
 * ============================================================================
 *
 *  - `ViewEncapsulation.None` — `report-builder.css` is injected globally.
 *  - Light theme rules in the stylesheet are prefixed with `html.light`.
 *
 * ============================================================================
 * 4. JIRA-STYLE IMMUTABLE LIFECYCLE STATE MACHINE
 * ============================================================================
 *
 *  - DRAFT (mutable) → IN_REVIEW (locked) → PUBLISHED (frozen)
 *  - Publishing auto-forks all child records server-side (v+1 draft).
 *  - `isLocked` computed flag disables all editor inputs when status ≠ DRAFT.
 *
 * ============================================================================
 * 5. KEY SIGNALS
 * ============================================================================
 *
 *  - `rows`                — `ReportRow[]` managed by RowsSetupComponent.
 *  - `columns`             — `ColumnDef[]` managed by ColumnsSetupComponent.
 *  - `validationErrors`    — `ValidationError[]` from backend validate endpoint.
 *  - `showSqlModal`        — Controls SqlPreviewModalComponent visibility.
 *  - `previewSql`          — Compiled SQL string returned from preview endpoint.
 *  - `availableReportingDates` — `string[]` from `dim_date` for CalendarPicker.
 *  - `dynamicGranularityOptions` — `{ value, label }[]` for GranularityPicker.
 *  - `generalFilterScopes` — `TableFilterScope[]` from the general filter modal.
 *
 * Route: `/reports/new` and `/reports/:id/edit`.
 */
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
    const refDate = this.resolveReportingDate(this.reportingDate) || new Date().toISOString().split('T')[0];
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
      reportingDate: this.resolveReportingDate(this.reportingDate),
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
        rollingN: (c.colType === 'WTD' || c.colType === 'MTD' || c.colType === 'QTD' || c.colType === 'YTD' || c.colType === 'ROLLING') ? c.rollingN : null,
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
      reportingDate: this.resolveReportingDate(this.reportingDate),
      reportingDateType: this.reportingDateType,
      reportingDateStatic: this.reportingDateStatic || null,
      reportingDateExpression: this.reportingDateExpression || null,
      timeframeStartType: this.timeframeStartType,
      timeframeStartStatic: this.timeframeStartStatic || null,
      timeframeStartExpression: this.timeframeStartExpression || null,
      timeframeEndType: this.timeframeEndType,
      timeframeEndStatic: this.timeframeEndStatic || null,
      timeframeEndExpression: this.timeframeEndExpression || null,
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
        rollingN: (c.colType === 'WTD' || c.colType === 'MTD' || c.colType === 'QTD' || c.colType === 'YTD' || c.colType === 'ROLLING') ? c.rollingN : null,
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
  schemaCatalogMap = signal<{ [key: string]: { isFilterable: boolean; isCached: boolean } }>({});
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

  // Polymorphic time parameters mapping
  reportingDateType = 'DYNAMIC';
  reportingDateStatic = '';
  reportingDateExpression = 'T-2';

  timeframeStartType = 'FIXED';
  timeframeStartStatic = '2022-01-01';
  timeframeStartExpression = '';

  timeframeEndType = 'DYNAMIC';
  timeframeEndStatic = '';
  timeframeEndExpression = 'T-2';
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
      return group.map((f, idx) => {
        const condStr = `${f.dimTable ? f.dimTable + '.' : ''}${f.attribute} ${f.operator} ${f.value}`;
        if (idx < group.length - 1) {
          return `${condStr} ${f.conjunction || 'AND'}`;
        }
        return condStr;
      }).join(' ');
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

    // Fetch schema-catalog dimension flags
    this.reportService.getSchemaCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalog: any) => {
          const map: { [key: string]: { isFilterable: boolean; isCached: boolean } } = {};
          if (catalog && catalog.dimensions) {
            catalog.dimensions.forEach((dim: any) => {
              if (dim.view_name && dim.name) {
                const key = `${dim.view_name.replace(/^analytics\./, '')}.${dim.name}`.toLowerCase();
                map[key] = {
                  isFilterable: dim.is_filterable === true || dim.is_filterable === 'true' || dim.is_filterable === 1,
                  isCached: dim.is_cached === true || dim.is_cached === 'true' || dim.is_cached === 1
                };
              }
            });
          }
          this.schemaCatalogMap.set(map);
        },
        error: (err) => {
          console.warn('Failed to load schema catalog flags:', err);
        }
      });

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
    this.reportingDate = data.reportingDate || 'T-2';

    // Populate polymorphic time parameter configurations
    this.reportingDateType = data.reportingDateType || 'DYNAMIC';
    this.reportingDateStatic = this.formatDateForInput(data.reportingDateStatic || '');
    this.reportingDateExpression = data.reportingDateExpression || 'T-2';
    
    this.timeframeStartType = data.timeframeStartType || 'FIXED';
    this.timeframeStartStatic = this.formatDateForInput(data.timeframeStartStatic || '2022-01-01');
    this.timeframeStartExpression = data.timeframeStartExpression || '';
    
    this.timeframeEndType = data.timeframeEndType || 'DYNAMIC';
    this.timeframeEndStatic = this.formatDateForInput(data.timeframeEndStatic || '');
    this.timeframeEndExpression = data.timeframeEndExpression || 'T-2';

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
    this.reportingDate = 'T-2';
    this.timeframeStart = '2022-01-01';
    this.timeframeMode = 'today_minus_2';
    this.timeframeEnd = this.dateOffsetString(-2);

    this.reportingDateType = 'DYNAMIC';
    this.reportingDateStatic = this.dateOffsetString(0);
    this.reportingDateExpression = 'T-2';
    this.timeframeStartType = 'FIXED';
    this.timeframeStartStatic = '2022-01-01';
    this.timeframeStartExpression = '';
    this.timeframeEndType = 'DYNAMIC';
    this.timeframeEndStatic = this.dateOffsetString(0);
    this.timeframeEndExpression = 'T-2';

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
  resolveReportingDate(dateStr: string): string {
    if (dateStr === 'T') {
      return this.dateOffsetString(0);
    }
    if (dateStr === 'T-1') {
      return this.dateOffsetString(-1);
    }
    if (dateStr === 'T-2') {
      return this.dateOffsetString(-2);
    }
    return dateStr;
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
    const resolvedDate = this.resolveReportingDate(this.reportingDate);
    if (resolvedDate) {
      const parsed = new Date(resolvedDate);
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

    const cleanTable = table.replace(/^analytics\./, '').toLowerCase();
    const cleanAttr = column.toLowerCase();
    const key = `${cleanTable}.${cleanAttr}`;
    const meta = this.schemaCatalogMap()[key];
    const isAutocompleteable = meta ? meta.isCached : false;

    if (!isAutocompleteable) {
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
      reportingDateType: this.reportingDateType,
      reportingDateStatic: this.reportingDateStatic || null,
      reportingDateExpression: this.reportingDateExpression || null,
      timeframeStartType: this.timeframeStartType,
      timeframeStartStatic: this.timeframeStartStatic || null,
      timeframeStartExpression: this.timeframeStartExpression || null,
      timeframeEndType: this.timeframeEndType,
      timeframeEndStatic: this.timeframeEndStatic || null,
      timeframeEndExpression: this.timeframeEndExpression || null,
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
        rollingN: (c.colType === 'WTD' || c.colType === 'MTD' || c.colType === 'QTD' || c.colType === 'YTD' || c.colType === 'ROLLING') ? c.rollingN : null,
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
