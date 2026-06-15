import { Component, OnInit, signal, computed, inject, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { DateFormatter } from '../utils/date-formatter';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { SidebarComponent } from './sidebar';
import { CalendarPickerComponent } from './calendar-picker';

@Component({
  selector: 'app-execution-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SidebarComponent, CalendarPickerComponent],
  templateUrl: './execution-hub.html',
  styleUrls: ['./execution-hub.css']
})
export class ExecutionHubComponent implements OnInit {
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
  exportingExcel = signal<boolean>(false);

  sidebarOpen = signal(false); // Mobile menu overlay state
  isSidebarOpen = signal<boolean>(true); // Desktop split-pane sidebar toggle state
  isMainMenuExpanded = signal<boolean>(false); // Hover/expansion state of left global sidebar

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

  granularityHeaders = computed(() => {
    const gran = this.reportConfig()?.granularity;
    if (!gran) return [];
    return gran.split(',').map((g: string) => {
      const clean = g.trim();
      return clean.includes('.') ? clean.substring(clean.lastIndexOf('.') + 1) : clean;
    });
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

          // 3. Check for route params and query params
          combineLatest([this.route.paramMap, this.route.queryParamMap])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(([params, queryParams]) => {
              const id = params.get('id');
              if (id) {
                this.selectedReportId.set(id);
                const versionStr = queryParams.get('version');
                const version = versionStr ? parseInt(versionStr, 10) : undefined;
                this.loadReportConfig(id, version);
              }
            });
        },
      });
  }

  loadReportConfig(id: string, version?: number): void {
    this.loadingConfig.set(true);
    const refDate = this.selectedReportingDate() || new Date().toISOString().split('T')[0];
    this.reportService
      .getReportConfig(id, refDate, version)
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

  onReportSelected(reportId: string, version?: number): void {
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
    const queryParams = version != null ? { version } : {};
    this.router.navigate(['/viewer', reportId], { queryParams });
    this.loadReportConfig(reportId, version);
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

    const version = this.reportConfig()?.version;

    this.reportService
      .executeReport(reportId, payload, version)
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


  exportToExcel(): void {
    const reportId = this.selectedReportId();
    if (!reportId) return;

    this.exportingExcel.set(true);
    this.executionError.set(null);
    const refDate = this.selectedReportingDate() || new Date().toISOString().split('T')[0];
    const version = this.reportConfig()?.version;

    this.reportService
      .runReport(reportId, refDate, version)
      .subscribe({
        next: (blob) => {
          this.exportingExcel.set(false);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${reportId}_${refDate}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          this.exportingExcel.set(false);
          console.error('Failed to export Excel report:', err);
          this.executionError.set('Failed to generate Excel report. Make sure the DWH contains data for the selected date.');
        },
      });
  }


  getGranularitySubRows(parentRowId: string): { rowId: string; label: string; segments: string[] }[] {
    const grid = this.executedData();
    if (!grid) return [];
    const subRows: { rowId: string; label: string; segments: string[] }[] = [];
    const prefix = parentRowId.toUpperCase() + '|';
    for (const key of grid.keys()) {
      if (key.toUpperCase().startsWith(prefix)) {
        const segments = key.substring(prefix.length).split('|');
        const vals = segments.join(', ');
        subRows.push({
          rowId: key,
          label: vals,
          segments: segments
        });
      }
    }
    subRows.sort((a, b) => a.label.localeCompare(b.label));
    return subRows;
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

  toggleSidebarPanel(): void {
    this.isSidebarOpen.update((v) => !v);
  }

  toggleMainMenu(): void {
    this.isMainMenuExpanded.update((v) => !v);
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

  onFilterValueChange(filter: any, newValue: any): void {
    filter.value = newValue;
    this.runtimeQuickFilters.set([...this.runtimeQuickFilters()]);
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
