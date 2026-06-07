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
});
