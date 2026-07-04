import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, DestroyRef } from '@angular/core';
import { DashboardComponent } from './dashboard';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let mockReportService: any;
  let mockAuthService: any;
  let mockRouter: any;
  let mockDestroyRef: any;

  const mockReports = [
    { reportId: 'R1', reportName: 'Sales Report', status: 'published', description: 'Monthly sales', exploreId: 'sales', sourceTable: 'fact_sales' },
    { reportId: 'R2', reportName: 'Inventory Report', status: 'draft', description: 'Stock details', exploreId: 'inventory', sourceTable: 'fact_inventory' }
  ];

  beforeEach(() => {
    mockReportService = {
      getReports: vi.fn().mockReturnValue(of(mockReports)),
      importTemplate: vi.fn(),
      getReportingDates: vi.fn().mockReturnValue(of(['2025-12-31', '2026-03-31']))
    };
    mockAuthService = {
      getUsername: vi.fn().mockReturnValue('test-user'),
      logout: vi.fn()
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
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: DestroyRef, useValue: mockDestroyRef }
      ]
    });

    runInInjectionContext(injector, () => {
      component = new DashboardComponent();
      component.ngOnInit();
    });
  });

  it('should initialize with username and load catalog', () => {
    expect(component.username).toBe('test-user');
    expect(mockReportService.getReports).toHaveBeenCalled();
    expect(component.reports()).toEqual(mockReports);
    expect(component.loading()).toBe(false);
  });

  it('should set errorMessage on catalog load failure', () => {
    mockReportService.getReports.mockReturnValue(throwError(() => new Error('Failed')));
    
    const injector = Injector.create({
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: DestroyRef, useValue: mockDestroyRef }
      ]
    });
    
    runInInjectionContext(injector, () => {
      const anotherComponent = new DashboardComponent();
      anotherComponent.ngOnInit();
      expect(anotherComponent.loading()).toBe(false);
      expect(anotherComponent.errorMessage()).toBe('Failed to load report templates catalog.');
    });
  });

  it('should handle template file selection and refresh catalog on success', () => {
    const mockFile = new File([''], 'test.xlsx');
    const event = { target: { files: [mockFile] } };
    
    const importSubject = new Subject<any>();
    mockReportService.importTemplate.mockReturnValue(importSubject);

    component.onFileSelected(event);

    expect(component.uploading()).toBe(true);
    expect(component.successMessage()).toBeNull();
    expect(component.errorMessage()).toBeNull();

    importSubject.next({ success: true });
    importSubject.complete();

    expect(component.uploading()).toBe(false);
    expect(component.successMessage()).toBe('Template Excel configurations imported successfully!');
    // Checks that catalog is reloaded (it was called during init and then again on success)
    expect(mockReportService.getReports).toHaveBeenCalledTimes(2);
  });

  it('should set error message on template upload failure', () => {
    const mockFile = new File([''], 'test.xlsx');
    const event = { target: { files: [mockFile] } };
    
    mockReportService.importTemplate.mockReturnValue(throwError(() => ({
      error: { message: 'Invalid format' }
    })));

    component.onFileSelected(event);

    expect(component.uploading()).toBe(false);
    expect(component.errorMessage()).toBe('Invalid format');
  });

  it('should filter reports by search query', () => {
    component.searchQuery.set('sales');
    expect(component.filteredReports).toHaveLength(1);
    expect(component.filteredReports[0].reportId).toBe('R1');

    component.searchQuery.set('inventory');
    expect(component.filteredReports).toHaveLength(1);
    expect(component.filteredReports[0].reportId).toBe('R2');

    component.searchQuery.set('Nonexistent');
    expect(component.filteredReports).toHaveLength(0);
  });

  it('should filter reports by status', () => {
    component.filterStatus.set('draft');
    expect(component.filteredReports).toHaveLength(1);
    expect(component.filteredReports[0].reportId).toBe('R2');

    component.filterStatus.set('published');
    expect(component.filteredReports).toHaveLength(1);
    expect(component.filteredReports[0].reportId).toBe('R1');
  });

  it('should return correct reports count by status', () => {
    expect(component.getReportsCountByStatus('all')).toBe(2);
    expect(component.getReportsCountByStatus('draft')).toBe(1);
    expect(component.getReportsCountByStatus('published')).toBe(1);
  });

  it('should clear filters', () => {
    component.searchQuery.set('sales');
    component.filterStatus.set('published');
    
    component.clearFilters();
    
    expect(component.searchQuery()).toBe('');
    expect(component.filterStatus()).toBe('all');
  });

  it('should navigate to report details view', () => {
    component.viewReport('R1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/reports', 'R1', 'edit'], { queryParams: { view: 'true' } });
  });

  it('should navigate to report edit view', () => {
    const mockEvent = { stopPropagation: vi.fn() } as any;
    component.editReport('R2', mockEvent);
    
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/reports', 'R2', 'edit']);
  });

  it('should logout and navigate to login screen', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
