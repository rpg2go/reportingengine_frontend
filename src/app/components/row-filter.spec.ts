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

  it('should not open builder if activeMeasureTable is empty', () => {
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('');
    component.openBuilder();
    expect(component.isOpen()).toBe(false);
  });

  it('should open builder and set pendingFilter if activeMeasureTable is provided', () => {
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('analytics.fact_sales');
    component.openBuilder();
    expect(component.isOpen()).toBe(true);
    expect(component.pendingFilter()).toEqual({ dimTable: '', attribute: '', operator: '=', value: '' });
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
    vi.spyOn(component, 'rowFilters').mockReturnValue([
      { dimTable: 'dim_cust', attribute: 'segment', operator: '=', value: 'Retail', conjunction: 'AND' },
      { dimTable: '', attribute: 'amount', operator: '>', value: '100', conjunction: 'OR' }
    ]);
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('fact_sales');
    vi.spyOn(component, 'columnTypes').mockReturnValue({
      'dim_cust': { 'segment': 'varchar' },
      'fact_sales': { 'amount': 'decimal' }
    });

    let emittedFilters: any[] | undefined;
    component.onChange.subscribe(filters => emittedFilters = filters);

    component.switchToRawMode();

    expect(component.isRawMode()).toBe(true);
    expect(component.legacyFilterExpr()).toBe("(dim_cust.segment = 'Retail') AND (amount > 100)");
    expect(emittedFilters).toBeUndefined();
  });

  it('should switch to structured mode', () => {
    component.isRawMode.set(true);
    component.legacyFilterExpr.set('(amount > 100)');
    
    let emittedFilters: any[] | undefined;
    component.onChange.subscribe(filters => emittedFilters = filters);

    component.switchToStructuredMode();

    expect(component.isRawMode()).toBe(false);
    expect(component.legacyFilterExpr()).toBe('(amount > 100)');
    expect(emittedFilters).toBeUndefined();
  });

  it('should handle raw expression change', () => {
    let emittedFilters: any[] | undefined;
    component.onChange.subscribe(filters => emittedFilters = filters);

    component.onRawExpressionChange('c = 4');

    expect(component.legacyFilterExpr()).toBe('c = 4');
    expect(emittedFilters).toBeUndefined();
  });

  it('should handle conjunction change', () => {
    vi.spyOn(component, 'rowFilters').mockReturnValue([
      { dimTable: '', attribute: 'amount', operator: '>', value: '100', conjunction: 'AND' },
      { dimTable: '', attribute: 'status', operator: '=', value: 'ACTIVE' }
    ]);

    let emittedFilters: any[] | undefined;
    component.onChange.subscribe(filters => emittedFilters = filters);

    component.onConjunctionChange(0, 'OR');

    expect(emittedFilters).toEqual([
      { dimTable: '', attribute: 'amount', operator: '>', value: '100', conjunction: 'OR' },
      { dimTable: '', attribute: 'status', operator: '=', value: 'ACTIVE' }
    ]);
  });

  it('should compile IN operators correctly with parentheses and individual quotes for lists', () => {
    vi.spyOn(component, 'rowFilters').mockReturnValue([
      { dimTable: '', attribute: 'ticker_symbol', operator: 'IN', value: 'AMZN, GOOGL', conjunction: 'AND' },
      { dimTable: '', attribute: 'hier_id', operator: 'IN', value: '1, 2, 3' }
    ]);
    vi.spyOn(component, 'activeMeasureTable').mockReturnValue('fact_investments');
    vi.spyOn(component, 'columnTypes').mockReturnValue({
      'fact_investments': { 'ticker_symbol': 'varchar', 'hier_id': 'integer' }
    });

    component.switchToRawMode();

    expect(component.legacyFilterExpr()).toBe("(ticker_symbol IN ('AMZN', 'GOOGL')) AND (hier_id IN (1, 2, 3))");
  });
});
