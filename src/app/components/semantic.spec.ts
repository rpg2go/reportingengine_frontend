import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { SemanticViewerComponent } from './semantic';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { of, throwError } from 'rxjs';

describe('SemanticViewerComponent', () => {
  let component: SemanticViewerComponent;
  let mockReportService: any;
  let mockAuthService: any;
  let mockRouter: any;
  let mockDestroyRef: any;

  const mockModelData = {
    explores: [
      { name: 'sales', fact_view_name: 'view_sales' },
      { name: 'inventory', fact_view_name: 'view_inventory' }
    ],
    views: [
      { name: 'view_sales', view_type: 'fact', table_ref: 'fact_sales', description: 'Sales facts' },
      { name: 'view_customer', view_type: 'dimension', table_ref: 'dim_customer', description: 'Customer dims' }
    ],
    joins: [
      { explore_name: 'sales', dim_view_name: 'view_customer' }
    ],
    dimensions: [
      { view_name: 'view_customer', name: 'cust_id' }
    ],
    measures: [
      { view_name: 'view_sales', name: 'total_amount' }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockReportService = {
      getSemanticModel: vi.fn().mockReturnValue(of(mockModelData))
    };
    mockAuthService = {
      getUsername: vi.fn().mockReturnValue('admin-user'),
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
      component = new SemanticViewerComponent();
      component.ngOnInit();
    });
  });

  it('should initialize and load semantic model', () => {
    expect(component.username).toBe('admin-user');
    expect(mockReportService.getSemanticModel).toHaveBeenCalled();
    expect(component.modelData()).toEqual(mockModelData);
    expect(component.loading()).toBe(false);
  });

  it('should handle semantic model load failure', () => {
    mockReportService.getSemanticModel.mockReturnValue(throwError(() => new Error('Error')));
    
    const injector = Injector.create({
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: DestroyRef, useValue: mockDestroyRef }
      ]
    });

    runInInjectionContext(injector, () => {
      const anotherComponent = new SemanticViewerComponent();
      anotherComponent.ngOnInit();
      expect(anotherComponent.loading()).toBe(false);
    });
  });

  it('should filter explores by query and filter type', () => {
    // Search query matches name
    component.exploreSearchQuery.set('sales');
    expect(component.filteredExplores).toHaveLength(1);
    expect(component.filteredExplores[0].name).toBe('sales');

    // Filter by type 'joins' (sales has 1 join, inventory has 0)
    component.clearExploreFilters();
    component.exploreFilterType.set('joins');
    expect(component.filteredExplores).toHaveLength(1);
    expect(component.filteredExplores[0].name).toBe('sales');

    // Filter by type 'direct'
    component.exploreFilterType.set('direct');
    expect(component.filteredExplores).toHaveLength(1);
    expect(component.filteredExplores[0].name).toBe('inventory');
  });

  it('should filter views by query and filter type', () => {
    // Search query matches table reference
    component.viewSearchQuery.set('dim_customer');
    expect(component.filteredViews).toHaveLength(1);
    expect(component.filteredViews[0].name).toBe('view_customer');

    // Filter by type 'fact'
    component.clearViewFilters();
    component.viewFilterType.set('fact');
    expect(component.filteredViews).toHaveLength(1);
    expect(component.filteredViews[0].name).toBe('view_sales');

    // Filter by type 'dimension'
    component.viewFilterType.set('dimension');
    expect(component.filteredViews).toHaveLength(1);
    expect(component.filteredViews[0].name).toBe('view_customer');
  });

  it('should compute helper explorer counts correctly', () => {
    expect(component.getExploresWithJoinsCount()).toBe(1);
    expect(component.getExploresDirectCount()).toBe(1);
    expect(component.getViewsCountByType('fact')).toBe(1);
    expect(component.getViewsCountByType('dimension')).toBe(1);
  });

  it('should clear explore and view filters', () => {
    component.exploreSearchQuery.set('abc');
    component.exploreFilterType.set('joins');
    component.clearExploreFilters();
    expect(component.exploreSearchQuery()).toBe('');
    expect(component.exploreFilterType()).toBe('all');

    component.viewSearchQuery.set('xyz');
    component.viewFilterType.set('fact');
    component.clearViewFilters();
    expect(component.viewSearchQuery()).toBe('');
    expect(component.viewFilterType()).toBe('all');
  });

  it('should return joins, dimensions, and measures associated with explores and views', () => {
    expect(component.getJoinsForExplore('sales')).toEqual(mockModelData.joins);
    expect(component.getDimensionsForView('view_customer')).toEqual(mockModelData.dimensions);
    expect(component.getMeasuresForView('view_sales')).toEqual(mockModelData.measures);
  });

  it('should logout and redirect to login screen', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
