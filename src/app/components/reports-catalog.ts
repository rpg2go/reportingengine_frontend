import { Component, OnInit, signal, computed, inject, DestroyRef, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragPreview, CdkDragPlaceholder, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './sidebar';
import { CalendarPickerComponent } from './calendar-picker';

@Component({
  selector: 'app-reports-catalog',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SidebarComponent,
    CalendarPickerComponent,
    CdkDropList,
    CdkDrag,
    CdkDragPreview,
    CdkDragPlaceholder,
    CdkDragHandle
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-catalog.html',
  styleUrls: ['./reports-catalog.css']
})
export class ReportsCatalogComponent implements OnInit {
  reports = signal<any[]>([]);
  loading = signal(true);
  uploading = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  username = '';

  // Search & Navigation rail signals
  searchQuery = signal('');
  sidebarOpen = signal(false); // Mobile sidebar overlay state
  isSidebarOpen = signal<boolean>(true); // Desktop split-pane sidebar toggle state

  // Section collapse states
  favoritesOpen = signal<boolean>(true);
  catalogOpen = signal<boolean>(true);

  // Favorites tracking
  favoriteIds = signal<Set<string>>(new Set());
  favoriteOrderedIds = signal<string[]>([]);

  // Inspector & selection signals
  selectedReportId = signal<string | null>(null);
  selectedReportConfig = signal<any | null>(null);
  selectedReportLoading = signal(false);
  referenceDate = signal<string>(new Date().toISOString().split('T')[0]);
  availableReportingDates = signal<string[]>([]);
  showDatePicker = signal<boolean>(false);
  running = signal<boolean>(false);
  deleting = signal<boolean>(false);
  showDeleteConfirm = signal<boolean>(false);

  // Clone Modal signals
  showCloneModal = signal<boolean>(false);
  cloneNewName = signal<string>('');
  cloningReport = signal<any | null>(null);
  cloneError = signal<string | null>(null);
  cloningInProgress = signal<boolean>(false);

  isCloneNameInvalid = computed(() => {
    const name = this.cloneNewName().trim();
    if (!name) return true;
    return this.reports().some(r => r.reportName?.toLowerCase().trim() === name.toLowerCase());
  });

  private destroyRef = inject(DestroyRef);
  private reportService = inject(ReportService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // computed properties for Favorites and Catalog groups
  favoriteReports = computed(() => {
    const all = this.reports();
    const query = this.searchQuery().toLowerCase().trim();
    const map = new Map<string, any>(all.map(r => [r.reportId, r]));
    
    return this.favoriteOrderedIds()
      .map(id => map.get(id))
      .filter((r): r is any =>
        r != null &&
        (!query || 
          r.reportName?.toLowerCase().includes(query) || 
          r.reportId?.toLowerCase().includes(query) || 
          (r.description && r.description.toLowerCase().includes(query)))
      );
  });

  allCatalogReports = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.reports();
    
    return all.filter(r => {
      // Must not be favorited
      if (this.favoriteIds().has(r.reportId)) return false;
      // Must match search query if provided
      if (!query) return true;
      return (
        r.reportId.toLowerCase().includes(query) || 
        r.reportName.toLowerCase().includes(query) || 
        (r.description && r.description.toLowerCase().includes(query)) ||
        (r.sourceTable && r.sourceTable.toLowerCase().includes(query))
      );
    });
  });

  constructor() {
    this.username = this.authService.getUsername();
  }

  ngOnInit(): void {
    this.loadFavorites();
    this.loadCatalog();
    this.reportService.getReportingDates().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (dates) => {
        this.availableReportingDates.set(dates);
        if (dates.length > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          if (dates.includes(todayStr)) {
            this.referenceDate.set(todayStr);
          } else {
            // Find the latest date that is <= todayStr
            const pastOrPresentDates = dates.filter(d => d <= todayStr);
            if (pastOrPresentDates.length > 0) {
              const sorted = [...pastOrPresentDates].sort((a, b) => b.localeCompare(a));
              this.referenceDate.set(sorted[0]);
            } else {
              // Otherwise pick the latest date overall
              const sorted = [...dates].sort((a, b) => b.localeCompare(a));
              this.referenceDate.set(sorted[0]);
            }
          }
        }
      }
    });
  }

  loadFavorites(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('reports_catalog_favorites');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.favoriteOrderedIds.set(parsed);
            this.favoriteIds.set(new Set(parsed));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load favorites from localStorage', e);
    }
  }

  saveFavorites(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('reports_catalog_favorites', JSON.stringify(this.favoriteOrderedIds()));
      }
    } catch (e) {
      console.error('Failed to save favorites to localStorage', e);
    }
  }

  toggleFavorite(event: Event, reportId: string): void {
    if (event) {
      event.stopPropagation();
    }
    const currentIds = new Set(this.favoriteIds());
    let currentOrdered = [...this.favoriteOrderedIds()];

    if (currentIds.has(reportId)) {
      currentIds.delete(reportId);
      currentOrdered = currentOrdered.filter(id => id !== reportId);
    } else {
      currentIds.add(reportId);
      currentOrdered.push(reportId);
    }

    this.favoriteIds.set(currentIds);
    this.favoriteOrderedIds.set(currentOrdered);
    this.saveFavorites();
  }

  onFavoriteReordered(event: CdkDragDrop<any[]>): void {
    const list = [...this.favoriteOrderedIds()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.favoriteOrderedIds.set(list);
    this.saveFavorites();
  }

  toggleSidebarPanel(): void {
    this.isSidebarOpen.update(v => !v);
  }

  toggleFavoritesSection(): void {
    this.favoritesOpen.update(v => !v);
  }

  toggleCatalogSection(): void {
    this.catalogOpen.update(v => !v);
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
          // Prefer selecting first favorite if exists, otherwise first catalog report
          const favs = this.favoriteReports();
          if (favs.length > 0) {
            this.selectReport(favs[0].reportId);
          } else {
            const allCats = this.allCatalogReports();
            if (allCats.length > 0) {
              this.selectReport(allCats[0].reportId);
            }
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

  onReportSelected(reportId: string): void {
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
          
          // Remove from local list and refresh
          const oldReports = this.reports();
          const updatedReports = oldReports.filter(r => r.reportId !== reportId);
          this.reports.set(updatedReports);
          
          // Remove from favorites if it was favorited
          if (this.favoriteIds().has(reportId)) {
            const currentIds = new Set(this.favoriteIds());
            currentIds.delete(reportId);
            this.favoriteIds.set(currentIds);
            
            const currentOrdered = this.favoriteOrderedIds().filter(id => id !== reportId);
            this.favoriteOrderedIds.set(currentOrdered);
            this.saveFavorites();
          }

          // Auto-select first of remaining
          this.autoSelectFirst();
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

  openCloneModal(report: any): void {
    this.cloningReport.set(report);
    this.cloneNewName.set(report.reportName ? `${report.reportName} - Copy` : 'New Report - Copy');
    this.cloneError.set(null);
    this.cloningInProgress.set(false);
    this.showCloneModal.set(true);
  }

  closeCloneModal(): void {
    this.showCloneModal.set(false);
    this.cloningReport.set(null);
    this.cloneNewName.set('');
    this.cloneError.set(null);
  }

  confirmClone(): void {
    const report = this.cloningReport();
    const newName = this.cloneNewName().trim();
    if (!report || !newName || this.isCloneNameInvalid()) return;

    this.cloningInProgress.set(true);
    this.cloneError.set(null);

    this.reportService.cloneReport(report.reportId, newName).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (newReport) => {
        this.cloningInProgress.set(false);
        this.showCloneModal.set(false);
        
        // Reload catalog
        this.reportService.getReports().pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: (data) => {
            this.reports.set(data);
            // Select the newly cloned report
            if (newReport && newReport.reportId) {
              this.selectReport(newReport.reportId);
            }
            this.successMessage.set(`Report successfully cloned as "${newName}"!`);
          }
        });
      },
      error: (err) => {
        this.cloningInProgress.set(false);
        this.cloneError.set(err.error?.message || 'Failed to clone the report. Please try again.');
      }
    });
  }

  onSearchChange(): void {
    this.autoSelectFirst();
  }

  autoSelectFirst(): void {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    if (!isDesktop) return;

    setTimeout(() => {
      const favs = this.favoriteReports();
      const allCats = this.allCatalogReports();
      
      const currentId = this.selectedReportId();
      
      // If currently selected is still in the filtered set, keep it
      if (currentId) {
        const inFavs = favs.some(r => r.reportId === currentId);
        const inCats = allCats.some(r => r.reportId === currentId);
        if (inFavs || inCats) {
          return;
        }
      }

      // Auto-select first available favorite, else first available catalog template
      if (favs.length > 0) {
        this.selectReport(favs[0].reportId);
      } else if (allCats.length > 0) {
        this.selectReport(allCats[0].reportId);
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
   */
  rowHasFilter(row: any): boolean {
    const expr = row?.filterExpr;
    if (expr && typeof expr === 'string') {
      const trimmed = expr.trim();
      if (trimmed && trimmed !== '[]' && trimmed !== '{}' && trimmed !== 'null') {
        return true;
      }
    }
    if (row?.rowFilters) {
      if (Array.isArray(row.rowFilters) && row.rowFilters.length > 0) return true;
      if (
        typeof row.rowFilters === 'object' &&
        ((row.rowFilters.rules?.length > 0) || (row.rowFilters.childGroups?.length > 0))
      ) return true;
    }
    if (row?.legacyFilterExpr && row.legacyFilterExpr.trim()) return true;
    return false;
  }

  /**
   * Safely resolves a human-readable expression string from row.source
   */
  getRowSourceLabel(row: any): string {
    const src = row?.source;
    if (!src) return '';

    if (typeof src === 'string') {
      if (src.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(src);
          return this.resolveSourceObject(parsed);
        } catch { /* fall through */ }
      }
      return src;
    }

    if (typeof src === 'object') {
      return this.resolveSourceObject(src);
    }

    return String(src);
  }

  private resolveSourceObject(obj: any): string {
    if (obj.rawExpression) return obj.rawExpression;
    if (obj.rawSql) return obj.rawSql;
    const agg = obj.aggregation || obj.aggregationFunction || 'SUM';
    const col = obj.targetColumn || obj.measureCol || '';
    const tbl = obj.sourceTable || obj.table || '';
    if (col) return tbl ? `${agg}(${tbl}.${col})` : `${agg}(col)`;
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

  resolveTimeframeDate(dateVal: string, refDate: string): string {
    if (!dateVal) return '';
    const cleaned = dateVal.trim().toUpperCase();
    if (cleaned === 'T') {
      return refDate;
    }
    if (cleaned.startsWith('T-')) {
      const offsetStr = cleaned.substring(2);
      const offset = parseInt(offsetStr, 10);
      if (!isNaN(offset)) {
        try {
          const date = new Date(refDate);
          if (!isNaN(date.getTime())) {
            date.setDate(date.getDate() - offset);
            return date.toISOString().split('T')[0];
          }
        } catch {
          // Fallback to today
        }
      }
    }
    // If it's already a valid date string (e.g. YYYY-MM-DD), return it
    return dateVal;
  }

  getResolvedTimeframeStart(report: any): string {
    if (!report) return '';
    let startVal = report.timeframeStart;
    
    // Fallback/Resolve from polymorphic fields if legacy field is empty
    if (!startVal) {
      if (report.timeframeStartType === 'DYNAMIC') {
        startVal = report.timeframeStartExpression || 'T-30';
      } else {
        startVal = report.timeframeStartStatic || '2022-01-01';
      }
    }
    
    return this.resolveTimeframeDate(startVal, this.referenceDate());
  }

  getResolvedTimeframeEnd(report: any): string {
    if (!report) return '';
    let endVal = report.timeframeEnd;
    
    // Fallback/Resolve from polymorphic fields if legacy field is empty
    if (!endVal) {
      if (report.timeframeEndType === 'DYNAMIC') {
        endVal = report.timeframeEndExpression || 'T-2';
      } else {
        endVal = report.timeframeEndStatic || '';
      }
    }
    
    return this.resolveTimeframeDate(endVal, this.referenceDate());
  }
}
