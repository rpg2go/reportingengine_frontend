import '@angular/compiler';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Injector, runInInjectionContext, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReportBuilderComponent } from './report-builder';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { of, throwError, Subject } from 'rxjs';

globalThis.confirm = vi.fn().mockReturnValue(true);
globalThis.alert = vi.fn();

describe('ReportBuilderComponent', () => {
  let component: ReportBuilderComponent;
  let mockReportService: any;
  let mockAuthService: any;
  let mockRouter: any;
  let mockRoute: any;
  let mockDestroyRef: any;

  const mockTables = ['table1', 'table2'];
  const mockDates = ['2025-12-31', '2025-11-30'];
  const mockConfig = {
    reportId: 'R1',
    name: 'Sales Report',
    version: 1,
    status: 'draft',
    sourceTable: 'table1',
    granularity: 'daily',
    reportingDate: '2025-12-31',
    timeframeStart: '2022-01-01',
    timeframeEnd: '2025-12-31',
    timeframeToday: false,
    quickFilters: 'col1',
    generalFilters: '[]',
    columns: [],
    rows: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockReportService = {
      getTables: vi.fn().mockReturnValue(of(mockTables)),
      getReportingDates: vi.fn().mockReturnValue(of(mockDates)),
      getReportConfig: vi.fn().mockReturnValue(of(mockConfig)),
      getTableColumns: vi.fn().mockReturnValue(of([])),
      getDimensionJoins: vi.fn().mockReturnValue(of([])),
      getDistinctValues: vi.fn().mockReturnValue(of([])),
      createReport: vi.fn(),
      saveReport: vi.fn()
    };
    mockAuthService = {
      getUsername: vi.fn().mockReturnValue('admin')
    };
    mockRouter = {
      navigate: vi.fn()
    };
    mockRoute = {
      params: of({ id: 'new' })
    };
    mockDestroyRef = {
      onDestroy: vi.fn().mockReturnValue(() => {})
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createComponent = (routeParams: any = { id: 'new' }) => {
    mockRoute.params = of(routeParams);
    const injector = Injector.create({
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: DestroyRef, useValue: mockDestroyRef }
      ]
    });

    runInInjectionContext(injector, () => {
      component = new ReportBuilderComponent();
      component.ngOnInit();
    });
  };

  it('should initialize as a new report', () => {
    createComponent({ id: 'new' });

    expect(component.isNewReport).toBe(true);
    expect(mockReportService.getTables).toHaveBeenCalled();
    expect(mockReportService.getReportingDates).toHaveBeenCalled();
    expect(component.dbTables).toEqual(mockTables);
    expect(component.availableReportingDates).toEqual(mockDates);
  });

  it('should initialize editing an existing report', () => {
    createComponent({ id: 'R1' });

    expect(component.isNewReport).toBe(false);
    expect(component.reportId).toBe('R1');
    expect(mockReportService.getReportConfig).toHaveBeenCalledWith('R1', '2025-12-31');
    expect(component.reportName).toBe('Sales Report');
    expect(component.sourceTable).toBe('table1');
  });

  it('should set error message when loading report config fails', () => {
    mockReportService.getReportConfig.mockReturnValue(throwError(() => new Error('Load failed')));
    createComponent({ id: 'R1' });

    expect(component.errorMessage()).toBe('Failed to load report definition details.');
  });

  it('should compute timeframe end based on mode', () => {
    createComponent({ id: 'new' });

    component.timeframeMode = 'today';
    const today = new Date().toISOString().split('T')[0];
    expect(component.computedTimeframeEnd).toBe(today);

    component.timeframeMode = 'custom';
    component.timeframeEnd = '2026-05-26';
    expect(component.computedTimeframeEnd).toBe('2026-05-26');
  });

  it('should validate inputs in saveConfig', () => {
    createComponent({ id: 'new' });
    
    // empty reportId & name
    component.reportId = '';
    component.reportName = '';
    component.saveConfig();
    expect(component.errorMessage()).toBe('Report ID and Report Title are mandatory fields.');
    expect(component.saving()).toBe(false);

    // empty source table
    component.reportId = 'R2';
    component.reportName = 'Test Report';
    component.sourceTable = '';
    component.saveConfig();
    expect(component.errorMessage()).toBe('Source Table is required.');
  });

  it('should call createReport when saving a new report', () => {
    createComponent({ id: 'new' });
    component.reportId = 'R2';
    component.reportName = 'Test Report';
    component.sourceTable = 'table1';

    const saveSubject = new Subject<any>();
    mockReportService.createReport.mockReturnValue(saveSubject);

    component.saveConfig();

    expect(component.saving()).toBe(true);
    expect(mockReportService.createReport).toHaveBeenCalled();

    saveSubject.next({ success: true });
    saveSubject.complete();

    expect(component.saving()).toBe(false);
    expect(component.successMessage()).toBe('Report definition successfully saved!');

    vi.advanceTimersByTime(1200);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/reports', 'R2']);
  });

  it('should call saveReport when saving an existing report', () => {
    createComponent({ id: 'R1' });
    
    const saveSubject = new Subject<any>();
    mockReportService.saveReport.mockReturnValue(saveSubject);

    component.saveConfig();

    expect(component.saving()).toBe(true);
    expect(mockReportService.saveReport).toHaveBeenCalledWith('R1', expect.any(Object));

    saveSubject.next({ success: true });
    saveSubject.complete();

    expect(component.saving()).toBe(false);

    vi.advanceTimersByTime(1200);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/reports', 'R1']);
  });

  it('should handle save error gracefully', () => {
    createComponent({ id: 'R1' });
    mockReportService.saveReport.mockReturnValue(throwError(() => ({
      error: { message: 'Persistence failed' }
    })));

    component.saveConfig();

    expect(component.saving()).toBe(false);
    expect(component.errorMessage()).toBe('Persistence failed');
  });

  it('should go back with confirmation', () => {
    createComponent({ id: 'R1' });
    component.goBack();
    expect(globalThis.confirm).toHaveBeenCalledWith('Discard changes and exit?');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/reports', 'R1']);
  });
});
