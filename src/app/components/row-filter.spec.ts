import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, ElementRef } from '@angular/core';
import { RowFilterComponent } from './row-filter';
import { ReportService } from '../services/report.service';
import { of } from 'rxjs';

describe('RowFilterComponent', () => {
  let component: RowFilterComponent;
  let mockReportService: any;
  let mockElementRef: any;

  beforeEach(() => {
    mockReportService = {
      getDistinctValues: vi.fn().mockReturnValue(of([])),
    };
    mockElementRef = {
      nativeElement: {
        contains: vi.fn().mockReturnValue(false)
      },
    };

    const injector = Injector.create({
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: ElementRef, useValue: mockElementRef },
      ],
    });

    runInInjectionContext(injector, () => {
      component = new RowFilterComponent();
    });
  });

  it('should initialize with isOpen false', () => {
    expect(component.isOpen()).toBe(false);
  });

  it('should open builder even if activeMeasureTable is empty', () => {
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('');
    component.openBuilder();
    expect(component.isOpen()).toBe(true);
    expect(component.rowFilters()).toEqual({
      id: 'root',
      logicalOperator: 'AND',
      rules: [],
      childGroups: []
    });
  });

  it('should open builder and set rowFilters if activeMeasureTable is provided', () => {
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('analytics.fact_sales');
    component.openBuilder();
    expect(component.isOpen()).toBe(true);
    expect(component.rowFilters()).toEqual({
      id: 'root',
      logicalOperator: 'AND',
      rules: [],
      childGroups: []
    });
  });

  it('should normalize rowFilters to root group if rowFilters is initialized to an empty array []', () => {
    component.rowFilters.set([]);
    component.openBuilder();
    expect(component.isOpen()).toBe(true);
    expect(component.rowFilters()).toEqual({
      id: 'root',
      logicalOperator: 'AND',
      rules: [],
      childGroups: []
    });
  });

  it('should normalize rowFilters to root group if rowFilters is an invalid object missing rules', () => {
    component.rowFilters.set({ invalid: true } as any);
    component.openBuilder();
    expect(component.isOpen()).toBe(true);
    expect(component.rowFilters()).toEqual({
      id: 'root',
      logicalOperator: 'AND',
      rules: [],
      childGroups: []
    });
  });

  it('should close builder', () => {
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('analytics.fact_sales');
    component.openBuilder();
    expect(component.isOpen()).toBe(true);
    component.close();
    expect(component.isOpen()).toBe(false);
  });

  it('should close on document click if clicked outside', () => {
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('analytics.fact_sales');
    component.openBuilder();
    expect(component.isOpen()).toBe(true);

    const mockTarget = {
      ownerDocument: {
        contains: vi.fn().mockReturnValue(true)
      },
      closest: vi.fn().mockReturnValue(null)
    };

    mockElementRef.nativeElement.contains.mockReturnValue(false);

    const event = { target: mockTarget } as any;
    component.onDocumentClick(event);

    expect(component.isOpen()).toBe(false);
  });

  it('should not close on document click if clicked target is add-row-filter-btn', () => {
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('analytics.fact_sales');
    component.openBuilder();
    expect(component.isOpen()).toBe(true);

    const mockTarget = {
      ownerDocument: {
        contains: vi.fn().mockReturnValue(true)
      },
      closest: vi.fn().mockImplementation((sel) => sel === '.add-row-filter-btn' ? {} : null)
    };

    mockElementRef.nativeElement.contains.mockReturnValue(false);

    const event = { target: mockTarget } as any;
    component.onDocumentClick(event);

    expect(component.isOpen()).toBe(true);
  });

  it('should initialize raw mode if legacyFilterExpr is present on init', () => {
    component.legacyFilterExpr.set('c = 3');
    component.ngOnInit();
    expect(component.isRawMode()).toBe(true);
  });

  it('should switch to raw mode and compile existing filters to SQL', () => {
    const filters = {
      id: 'root',
      logicalOperator: 'AND',
      rules: [
        { tableName: 'dim_cust', columnName: 'segment', operator: 'is', value: ['Retail'] }
      ],
      childGroups: [
        {
          id: 'child1',
          logicalOperator: 'OR',
          rules: [
            { tableName: '', columnName: 'amount', operator: 'in list', value: ['100', '200'] }
          ],
          childGroups: []
        }
      ]
    };
    component.rowFilters.set(filters);
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('fact_sales');

    component.switchToRawMode();

    expect(component.isRawMode()).toBe(true);
    expect(component.legacyFilterExpr()).toBe("((dim_cust.segment = 'Retail') AND (amount IN ('100', '200')))");
  });

  it('should switch to structured mode', () => {
    component.isRawMode.set(true);
    component.legacyFilterExpr.set('(amount > 100)');
    
    component.switchToStructuredMode();

    expect(component.isRawMode()).toBe(false);
    expect(component.legacyFilterExpr()).toBe('(amount > 100)');
  });

  it('should handle raw expression change', () => {
    component.onRawExpressionChange('c = 4');
    expect(component.legacyFilterExpr()).toBe('c = 4');
  });

  it('should compile not in list operators correctly', () => {
    const filters = {
      id: 'root',
      logicalOperator: 'AND',
      rules: [
        { tableName: '', columnName: 'ticker_symbol', operator: 'not in list', value: ['AMZN', 'GOOGL'] }
      ],
      childGroups: []
    };
    component.rowFilters.set(filters);
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('fact_investments');

    component.switchToRawMode();

    expect(component.legacyFilterExpr()).toBe("(ticker_symbol NOT IN ('AMZN', 'GOOGL'))");
  });

  it('should generate a correct filter summary string', () => {
    const filters = {
      id: 'root',
      logicalOperator: 'OR',
      rules: [
        { tableName: 'dim_cust', columnName: 'segment', operator: 'is', value: ['Retail'] }
      ],
      childGroups: [
        {
          id: 'child1',
          logicalOperator: 'AND',
          rules: [
            { tableName: '', columnName: 'amount', operator: 'not in list', value: ['100'] }
          ],
          childGroups: []
        }
      ]
    };

    const summary = component.getFilterStringSummary(filters);
    expect(summary).toBe("(dim_cust.segment = 'Retail' OR (amount not in list '100'))");
  });
});
