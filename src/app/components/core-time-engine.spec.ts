import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { CoreTimeEngineComponent } from './core-time-engine';

describe('CoreTimeEngineComponent', () => {
  let component: CoreTimeEngineComponent;

  beforeEach(() => {
    component = new CoreTimeEngineComponent();
  });

  it('should initialize default properties correctly', () => {
    expect(component.reportingDateType).toBe('DYNAMIC');
    expect(component.timeframeStartType).toBe('FIXED');
    expect(component.timeframeEndType).toBe('DYNAMIC');
    expect(component.isLocked).toBe(false);
  });

  it('should allow modifying model properties when isLocked is false', () => {
    component.isLocked = false;
    component.setReportingDateType('FIXED');
    expect(component.reportingDateType).toBe('FIXED');

    component.setTimeframeStartType('DYNAMIC');
    expect(component.timeframeStartType).toBe('DYNAMIC');

    component.setTimeframeEndType('FIXED');
    expect(component.timeframeEndType).toBe('FIXED');
  });

  it('should block modifying model properties when isLocked is true', () => {
    component.isLocked = true;
    component.setReportingDateType('FIXED');
    expect(component.reportingDateType).toBe('DYNAMIC'); // unchanged

    component.setTimeframeStartType('DYNAMIC');
    expect(component.timeframeStartType).toBe('FIXED'); // unchanged

    component.setTimeframeEndType('FIXED');
    expect(component.timeframeEndType).toBe('DYNAMIC'); // unchanged
  });

  it('should resolve dates correctly', () => {
    expect(component.resolveDate('FIXED', '2026-07-09', '')).toBe('2026-07-09');
    expect(component.resolveDate('DYNAMIC', '', 'T')).toBe(new Date().toISOString().split('T')[0]);
  });
});
