import { describe, it, expect } from 'vitest';
import { DateFormatter } from './date-formatter';

describe('DateFormatter Utility Tests', () => {
  const referenceDate = '2026-06-04'; // Thursday

  it('should generate MONTH grain headers sequentially backward', () => {
    const parentCol = { colId: 'C7', colType: 'ROLLING', rollingN: 3, rollingGrain: 'MONTH' };
    const result = DateFormatter.getRollingSubColumns(referenceDate, parentCol, 3, 'MONTH');

    expect(result).toHaveLength(3);
    
    expect(result[0].colId).toBe('C7_1');
    expect(result[0].label).toBe('May 2026');
    expect(result[0].periodOffset).toBe(-1);
    expect(result[0].parentColId).toBe('C7');
    expect(result[0].isExpandedSubCol).toBe(true);

    expect(result[1].colId).toBe('C7_2');
    expect(result[1].label).toBe('April 2026');
    expect(result[1].periodOffset).toBe(-2);

    expect(result[2].colId).toBe('C7_3');
    expect(result[2].label).toBe('March 2026');
    expect(result[2].periodOffset).toBe(-3);
  });

  it('should generate WEEK grain headers with ISO week-of-year labels', () => {
    const parentCol = { colId: 'C7', colType: 'ROLLING', rollingN: 2, rollingGrain: 'WEEK' };
    const result = DateFormatter.getRollingSubColumns(referenceDate, parentCol, 2, 'WEEK');

    expect(result).toHaveLength(2);

    // ref date 2026-06-04: its Monday is 2026-06-01.
    // offset -1: Monday is 2026-05-25 → ISO Thursday anchor 2026-05-28 → ISO WK22
    expect(result[0].colId).toBe('C7_1');
    expect(result[0].label).toBe('WK22');
    expect(result[0].periodOffset).toBe(-1);

    // offset -2: Monday is 2026-05-18 → ISO Thursday anchor 2026-05-21 → ISO WK21
    expect(result[1].colId).toBe('C7_2');
    expect(result[1].label).toBe('WK21');
    expect(result[1].periodOffset).toBe(-2);
  });

  it('should generate DAY grain headers with short date stamps', () => {
    const parentCol = { colId: 'C7', colType: 'ROLLING', rollingN: 3, rollingGrain: 'DAY' };
    const result = DateFormatter.getRollingSubColumns(referenceDate, parentCol, 3, 'DAY');

    expect(result).toHaveLength(3);

    expect(result[0].colId).toBe('C7_1');
    expect(result[0].label).toBe('03 Jun');
    expect(result[0].periodOffset).toBe(-1);

    expect(result[1].colId).toBe('C7_2');
    expect(result[1].label).toBe('02 Jun');
    expect(result[1].periodOffset).toBe(-2);

    expect(result[2].colId).toBe('C7_3');
    expect(result[2].label).toBe('01 Jun');
    expect(result[2].periodOffset).toBe(-3);
  });

  it('should generate QUARTER grain headers with Qn YYYY labels', () => {
    const parentCol = { colId: 'C7', colType: 'ROLLING', rollingN: 2, rollingGrain: 'QUARTER' };
    const result = DateFormatter.getRollingSubColumns(referenceDate, parentCol, 2, 'QUARTER');

    expect(result).toHaveLength(2);

    // referenceDate is '2026-06-04' (June, Q2)
    // offset -1 quarter: March 2026 (Q1)
    expect(result[0].colId).toBe('C7_1');
    expect(result[0].label).toBe('Q1 2026');
    expect(result[0].periodOffset).toBe(-1);

    // offset -2 quarters: December 2025 (Q4)
    expect(result[1].colId).toBe('C7_2');
    expect(result[1].label).toBe('Q4 2025');
    expect(result[1].periodOffset).toBe(-2);
  });
});
