import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { Injector, runInInjectionContext } from '@angular/core';
import { CoreReportDetailsComponent } from './core-report-details';

describe('CoreReportDetailsComponent', () => {
  let component: CoreReportDetailsComponent;
  const fb = new FormBuilder();

  beforeEach(() => {
    const injector = Injector.create({
      providers: []
    });

    runInInjectionContext(injector, () => {
      component = new CoreReportDetailsComponent();
    });
    
    // Configure inputs/outputs using signal models where applicable
    component.reportForm = (() => fb.group({
      granularity: [[]],
      quickFilters: [[]]
    })) as any;
  });

  it('should default reportingDate to T-2 if empty on init', () => {
    expect(component.reportingDate()).toBe('');
    component.ngOnInit();
    expect(component.reportingDate()).toBe('T-2');
  });

  it('should initialize dropdown select values based on initial state', () => {
    component.reportingDate.set('T-1');
    component.timeframeMode.set('today_minus_1');
    component.ngOnInit();
    expect(component.reportingDateSelectValue()).toBe('T-1');
    expect(component.timeframeModeSelectValue()).toBe('today_minus_1');
  });

  it('should update reportingDate when onReportingDateDropdownChange is called with T-2, T-1, or T', () => {
    component.ngOnInit();
    component.onReportingDateDropdownChange('T-1');
    expect(component.reportingDate()).toBe('T-1');
    expect(component.reportingDateSelectValue()).toBe('T-1');

    component.onReportingDateDropdownChange('T');
    expect(component.reportingDate()).toBe('T');
    expect(component.reportingDateSelectValue()).toBe('T');

    component.onReportingDateDropdownChange('T-2');
    expect(component.reportingDate()).toBe('T-2');
    expect(component.reportingDateSelectValue()).toBe('T-2');
  });

  it('should set reportingDate to custom reporting date when custom option is selected', () => {
    component.ngOnInit();
    component.onCustomReportingDateChange('2026-07-09');
    component.onReportingDateDropdownChange('custom');
    expect(component.reportingDate()).toBe('2026-07-09');
    expect(component.reportingDateSelectValue()).toBe('custom');
  });

  it('should update timeframeMode and timeframeEnd when onTimeframeModeDropdownChange is called', () => {
    component.ngOnInit();
    component.onTimeframeModeDropdownChange('today_minus_2');
    expect(component.timeframeMode()).toBe('today_minus_2');
    expect(component.timeframeEnd()).toBe(component.dateOffsetString(-2));

    component.onTimeframeModeDropdownChange('today_minus_1');
    expect(component.timeframeMode()).toBe('today_minus_1');
    expect(component.timeframeEnd()).toBe(component.dateOffsetString(-1));

    component.onTimeframeModeDropdownChange('today');
    expect(component.timeframeMode()).toBe('today');
    expect(component.timeframeEnd()).toBe(component.dateOffsetString(0));
  });

  it('should handle custom timeframe end changes', () => {
    component.ngOnInit();
    component.onCustomTimeframeEndChange('2026-07-10');
    expect(component.timeframeEnd()).toBe('2026-07-10');
  });

  it('should compute resolvedReportingDateText in real-time', () => {
    component.ngOnInit();
    component.reportingDate.set('T');
    expect(component.resolvedReportingDateText()).toBe(component.dateOffsetString(0));

    component.reportingDate.set('T-1');
    expect(component.resolvedReportingDateText()).toBe(component.dateOffsetString(-1));

    component.reportingDate.set('T-2');
    expect(component.resolvedReportingDateText()).toBe(component.dateOffsetString(-2));

    component.reportingDate.set('2026-07-10');
    expect(component.resolvedReportingDateText()).toBe('2026-07-10');
  });

  it('should compute resolvedTimeframeEndText in real-time', () => {
    component.ngOnInit();
    component.timeframeMode.set('today');
    expect(component.resolvedTimeframeEndText()).toBe(component.dateOffsetString(0));

    component.timeframeMode.set('today_minus_1');
    expect(component.resolvedTimeframeEndText()).toBe(component.dateOffsetString(-1));

    component.timeframeMode.set('today_minus_2');
    expect(component.resolvedTimeframeEndText()).toBe(component.dateOffsetString(-2));

    component.timeframeMode.set('custom');
    component.timeframeEnd.set('2026-07-10');
    expect(component.resolvedTimeframeEndText()).toBe('2026-07-10');
  });

  it('should return correct general filter summary', () => {
    const filtersGroup = {
      rules: [
        { tableName: 'fact_sales', columnName: 'amount', operator: '>', value: [100] }
      ]
    };
    const summary = component.getGeneralFilterSummary(filtersGroup);
    expect(summary).toBe("fact_sales.amount > '100'");
  });

  it('should handle OR logical operators and recursive child groups in getGeneralFilterSummary', () => {
    const filtersGroup = {
      logicalOperator: 'OR',
      rules: [
        { tableName: 'fact_sales', columnName: 'status', operator: '=', value: ['active'] }
      ],
      childGroups: [
        {
          logicalOperator: 'AND',
          rules: [
            { tableName: 'fact_sales', columnName: 'amount', operator: '>', value: [500] },
            { tableName: 'dim_customers', columnName: 'region', operator: '=', value: ['US'] }
          ],
          childGroups: []
        }
      ]
    };
    const summary = component.getGeneralFilterSummary(filtersGroup);
    expect(summary).toBe("(fact_sales.status = 'active' OR (fact_sales.amount > '500' AND dim_customers.region = 'US'))");
  });
});
