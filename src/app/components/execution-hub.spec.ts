import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, DestroyRef } from '@angular/core';
import { ExecutionHubComponent } from './execution-hub';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('ExecutionHubComponent', () => {
  let component: ExecutionHubComponent;
  let mockReportService: any;
  let mockAuthService: any;
  let mockActivatedRoute: any;
  let mockRouter: any;
  let mockDestroyRef: any;

  beforeEach(() => {
    mockReportService = {
      getReports: vi.fn().mockReturnValue(of([{ reportId: 'RPT_001', name: 'Sales Report' }])),
      getReportingDates: vi.fn().mockReturnValue(of(['2026-05-26', '2026-05-25'])),
      getReportConfig: vi.fn().mockReturnValue(
        of({
          reportId: 'RPT_001',
          name: 'Sales Report',
          columns: [{ colId: 'C1', label: 'Col 1', colType: 'WEEK' }],
          rows: [{ rowId: 'R1', label: 'Row 1', rowType: 'data', source: { table: 'fact_sales' } }],
          quickFilters: JSON.stringify([
            { dimTable: 'dim_location', attribute: 'region', operator: 'EQUALS', value: '' },
          ]),
        }),
      ),
      getDistinctValues: vi.fn().mockReturnValue(of(['EMEA', 'APAC', 'AMER'])),
      executeReport: vi.fn().mockReturnValue(of([{ rowId: 'R1', colId: 'C1', val: 125.5 }])),
      runReport: vi.fn().mockReturnValue(of(new Blob())),
    };

    mockAuthService = {
      getUsername: vi.fn().mockReturnValue('consumer_user'),
    };

    mockActivatedRoute = {
      paramMap: of({
        get: (key: string) => null,
      }),
      queryParamMap: of({
        get: (key: string) => null,
      }),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockDestroyRef = {
      onDestroy: vi.fn().mockReturnValue(() => {}),
    };

    const injector = Injector.create({
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: DestroyRef, useValue: mockDestroyRef },
      ],
    });

    runInInjectionContext(injector, () => {
      component = new ExecutionHubComponent();
    });
  });

  it('should initialize component state on init', () => {
    component.ngOnInit();
    expect(component.username).toBe('consumer_user');
    expect(component.catalogReports().length).toBe(1);
    expect(component.availableReportingDates().length).toBe(2);
    expect(component.selectedReportingDate()).toBe('2026-05-26');
  });

  it('should handle routing report selection', () => {
    // Mock activated route with report id param
    mockActivatedRoute.paramMap = of({
      get: (key: string) => 'RPT_001',
    });
    mockActivatedRoute.queryParamMap = of({
      get: (key: string) => null,
    });

    component.ngOnInit();
    expect(component.selectedReportId()).toBe('RPT_001');
    expect(component.loadingConfig()).toBe(false);
    expect(component.reportName()).toBe('Sales Report');
    expect(component.runtimeQuickFilters().length).toBe(1);
    expect(component.runtimeQuickFilters()[0].options).toEqual(['EMEA', 'APAC', 'AMER']);
  });

  it('should redirect and load config when a report is selected', () => {
    component.onReportSelected('RPT_001');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/viewer', 'RPT_001'], { queryParams: {} });
    expect(component.reportName()).toBe('Sales Report');
  });

  it('should execute the report and unpivot coordinates into matrix format', () => {
    component.selectedReportId.set('RPT_001');
    component.selectedReportingDate.set('2026-05-26');
    component.runtimeQuickFilters.set([{ tableColumn: 'dim_location.region', value: 'EMEA' }]);

    component.runExecution();

    expect(mockReportService.executeReport).toHaveBeenCalledWith('RPT_001', {
      reportingDate: '2026-05-26',
      runtimeFilters: [{ tableColumn: 'dim_location.region', value: 'EMEA' }],
    }, undefined);

    expect(component.getCellValue('R1', 'C1')).toBe('125.5');
    expect(component.getCellValue('R2', 'C1')).toBe('-'); // not in results
  });

  it('should handle execution errors and display error messages', () => {
    component.selectedReportId.set('RPT_001');
    component.selectedReportingDate.set('2026-05-26');

    mockReportService.executeReport.mockReturnValue(throwError(() => new Error('DB timeout')));

    component.runExecution();

    expect(component.executing()).toBe(false);
    expect(component.executionError()).toContain('DB timeout');
    expect(component.executedData()).toBeNull();
  });


  it('should toggle sidebar panel layout signal', () => {
    expect(component.isSidebarOpen()).toBe(true);
    component.toggleSidebarPanel();
    expect(component.isSidebarOpen()).toBe(false);
    component.toggleSidebarPanel();
    expect(component.isSidebarOpen()).toBe(true);
  });

  it('should toggle main menu expanded signal', () => {
    expect(component.isMainMenuExpanded()).toBe(false);
    component.toggleMainMenu();
    expect(component.isMainMenuExpanded()).toBe(true);
    component.toggleMainMenu();
    expect(component.isMainMenuExpanded()).toBe(false);
  });
});
