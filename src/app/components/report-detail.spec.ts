import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReportDetailComponent } from './report-detail';
import { ReportService } from '../services/report.service';
import { of, throwError, Subject } from 'rxjs';

// Mock browser APIs
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();
globalThis.window = {
  URL: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL
  }
} as any;

const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();
const mockLinkElement = {
  href: '',
  download: '',
  click: mockClick
};
globalThis.document = {
  createElement: vi.fn().mockReturnValue(mockLinkElement),
  body: {
    appendChild: mockAppendChild,
    removeChild: mockRemoveChild
  }
} as any;

describe('ReportDetailComponent', () => {
  let component: ReportDetailComponent;
  let mockReportService: any;
  let mockRoute: any;
  let mockRouter: any;
  let mockDestroyRef: any;

  const mockConfig = {
    reportId: 'R1',
    reportName: 'Sales Report',
    rows: [
      { rowId: 'row1', activeCols: ['COL1', 'COL2'] }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockReportService = {
      getReportConfig: vi.fn().mockReturnValue(of(mockConfig)),
      runReport: vi.fn()
    };
    mockRoute = {
      params: of({ id: 'R1' })
    };
    mockRouter = {
      navigate: vi.fn()
    };
    mockDestroyRef = {
      onDestroy: vi.fn().mockReturnValue(() => {})
    };

    const injector = Injector.create({
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: Router, useValue: mockRouter },
        { provide: DestroyRef, useValue: mockDestroyRef }
      ]
    });

    runInInjectionContext(injector, () => {
      component = new ReportDetailComponent();
      component.ngOnInit();
    });
  });

  it('should initialize with route id and load config', () => {
    expect(component.reportId).toBe('R1');
    expect(mockReportService.getReportConfig).toHaveBeenCalledWith('R1', '2025-12-31');
    expect(component.config()).toEqual(mockConfig);
    expect(component.loading()).toBe(false);
  });

  it('should set errorMessage when config load fails', () => {
    mockReportService.getReportConfig.mockReturnValue(throwError(() => new Error('Failed')));
    
    const injector = Injector.create({
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: Router, useValue: mockRouter },
        { provide: DestroyRef, useValue: mockDestroyRef }
      ]
    });

    runInInjectionContext(injector, () => {
      const anotherComponent = new ReportDetailComponent();
      anotherComponent.ngOnInit();
      expect(anotherComponent.loading()).toBe(false);
      expect(anotherComponent.errorMessage()).toBe('Failed to load report definition layout.');
    });
  });

  it('should reload config on date change', () => {
    component.referenceDate = '2025-06-30';
    component.onDateChange();
    expect(mockReportService.getReportConfig).toHaveBeenLastCalledWith('R1', '2025-06-30');
  });

  it('should correctly determine if column is enabled for row', () => {
    const row = { activeCols: ['COL1', 'COL2'] };
    expect(component.isEnabledFor(row, 'col1')).toBe(true);
    expect(component.isEnabledFor(row, 'col3')).toBe(false);
  });

  it('should run report and trigger download on success', () => {
    const mockBlob = new Blob(['hello'], { type: 'text/plain' });
    const runSubject = new Subject<Blob>();
    mockReportService.runReport.mockReturnValue(runSubject);

    component.runReport();

    expect(component.running()).toBe(true);
    expect(component.errorMessage()).toBeNull();
    expect(mockReportService.runReport).toHaveBeenCalledWith('R1', '2025-12-31');

    runSubject.next(mockBlob);
    runSubject.complete();

    expect(component.running()).toBe(false);
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockLinkElement.href).toBe('blob:mock-url');
    expect(mockLinkElement.download).toBe('R1_2025-12-31.xlsx');
    expect(mockAppendChild).toHaveBeenCalledWith(mockLinkElement);
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalledWith(mockLinkElement);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should set error message when running report fails', () => {
    mockReportService.runReport.mockReturnValue(throwError(() => new Error('Error')));

    component.runReport();

    expect(component.running()).toBe(false);
    expect(component.errorMessage()).toBe('Failed to generate report. Make sure the analytical database is correctly seeded.');
  });

  it('should go back to dashboard', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
