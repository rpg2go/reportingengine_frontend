import { describe, it, expect } from 'vitest';
import {
  parseMeasure,
  serializeMeasure,
  parseRowFilterExpr,
  serializeRowFilters,
  formatDateForInput,
  dateOffsetString
} from './report-parser';

describe('Report Parser Utilities', () => {

  describe('parseMeasure', () => {
    it('should parse standard aggregate expressions correctly', () => {
      expect(parseMeasure('SUM(amount)')).toEqual({
        aggFunction: 'SUM',
        measureCol: 'amount',
        customSqlMode: false
      });
      expect(parseMeasure('count_distinct(user_id)')).toEqual({
        aggFunction: 'COUNT_DISTINCT',
        measureCol: 'user_id',
        customSqlMode: false
      });
    });

    it('should fall back to custom SQL mode for custom expressions', () => {
      expect(parseMeasure('SUM(amount) / 100')).toEqual({
        aggFunction: 'SUM',
        measureCol: '',
        customSqlMode: true
      });
      expect(parseMeasure('')).toEqual({
        aggFunction: 'SUM',
        measureCol: '',
        customSqlMode: false
      });
    });
  });

  describe('serializeMeasure', () => {
    it('should return source if customSqlMode is true or not structured data', () => {
      const row = { rowType: 'data', customSqlMode: true, source: 'SUM(amount) / 100' };
      expect(serializeMeasure(row)).toBe('SUM(amount) / 100');

      const nonDataRow = { rowType: 'section', source: 'Section title' };
      expect(serializeMeasure(nonDataRow)).toBe('Section title');
    });

    it('should build aggregate string if structured info is provided', () => {
      const row = { rowType: 'data', customSqlMode: false, measureAgg: 'AVG', measureCol: 'price' };
      expect(serializeMeasure(row)).toBe('AVG(price)');
    });
  });

  describe('parseRowFilterExpr', () => {
    it('should parse valid JSON arrays as rowFilters', () => {
      const json = '[{"dimTable":"dim_rm","attribute":"name","operator":"=","value":"John"}]';
      const result = parseRowFilterExpr(json);
      expect(result.rowFilters).toHaveLength(1);
      expect(result.rowFilters[0].attribute).toBe('name');
      expect(result.legacyFilterExpr).toBe('');
    });

    it('should treat invalid JSON as legacy filter expressions', () => {
      const legacy = 'dim_rm.name = \'John\'';
      const result = parseRowFilterExpr(legacy);
      expect(result.rowFilters).toHaveLength(0);
      expect(result.legacyFilterExpr).toBe(legacy);
    });

    it('should return empty values for empty strings', () => {
      expect(parseRowFilterExpr('')).toEqual({ rowFilters: [], legacyFilterExpr: '' });
    });
  });

  describe('serializeRowFilters', () => {
    it('should return empty string for non-data rows', () => {
      expect(serializeRowFilters({ rowType: 'section' })).toBe('');
    });

    it('should serialize rowFilters if present', () => {
      const row = {
        rowType: 'data',
        rowFilters: [{ dimTable: 'dim_rm', attribute: 'name', operator: '=', value: 'John' }]
      };
      expect(serializeRowFilters(row)).toBe(JSON.stringify(row.rowFilters));
    });

    it('should return legacy expression if rowFilters is empty', () => {
      const row = {
        rowType: 'data',
        rowFilters: [],
        legacyFilterExpr: 'dim_rm.name = \'John\''
      };
      expect(serializeRowFilters(row)).toBe('dim_rm.name = \'John\'');
    });
  });

  describe('formatDateForInput', () => {
    const fixedToday = () => '2025-12-31';

    it('should return standard YYYY-MM-DD strings directly', () => {
      expect(formatDateForInput('2025-05-20', fixedToday)).toBe('2025-05-20');
    });

    it('should parse MM/DD/YY and MM/DD/YYYY formats', () => {
      expect(formatDateForInput('05/20/25', fixedToday)).toBe('2025-05-20');
      expect(formatDateForInput('05/20/2025', fixedToday)).toBe('2025-05-20');
    });

    it('should ignore today or sysdate keywords', () => {
      expect(formatDateForInput('today', fixedToday)).toBe('');
      expect(formatDateForInput('sysdate', fixedToday)).toBe('');
    });

    it('should validate matching current year of base date', () => {
      expect(formatDateForInput('Dec 31, 2025', fixedToday)).toBe('2025-12-31');
      expect(formatDateForInput('Jan 01, 2026', fixedToday)).toBe(''); // Different year
    });
  });

  describe('dateOffsetString', () => {
    it('should return correct offset date string', () => {
      const base = new Date('2025-12-31T12:00:00Z');
      expect(dateOffsetString(0, base)).toBe('2025-12-31');
      expect(dateOffsetString(-2, base)).toBe('2025-12-29');
      expect(dateOffsetString(2, base)).toBe('2026-01-02');
    });
  });

});
