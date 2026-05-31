export interface RowFilterCondition {
  dimTable: string;     // '' = fact table; otherwise the dim view name
  attribute: string;    // column name within that table
  operator: string;
  value: string;
}

export function parseMeasure(source: any): { aggFunction: string; measureCol: string; customSqlMode: boolean } {
  if (!source) return { aggFunction: 'SUM', measureCol: '', customSqlMode: false };
  
  if (typeof source === 'object') {
    const mode = source.mode || 'visual';
    if (mode === 'raw') {
      return {
        aggFunction: 'SUM',
        measureCol: '',
        customSqlMode: true
      };
    } else {
      return {
        aggFunction: source.aggregation || 'SUM',
        measureCol: source.targetColumn || '',
        customSqlMode: false
      };
    }
  }

  if (typeof source === 'string') {
    const m = source.match(/^(SUM|COUNT|COUNT_DISTINCT|AVG|MIN|MAX)\((.+)\)$/i);
    if (m) return { aggFunction: m[1].toUpperCase(), measureCol: m[2], customSqlMode: false };
    return { aggFunction: 'SUM', measureCol: '', customSqlMode: true };
  }

  return { aggFunction: 'SUM', measureCol: '', customSqlMode: false };
}

export function serializeMeasure(row: any): any {
  if (row.rowType !== 'data' && row.rowType !== 'calc') return null;

  if (row.rowType === 'calc') {
    return {
      mode: 'raw',
      aggregation: null,
      targetColumn: null,
      table: null,
      rawSql: row.source || ''
    };
  }

  // Data row
  if (row.customSqlMode) {
    return {
      mode: 'raw',
      aggregation: null,
      targetColumn: null,
      table: null,
      rawSql: row.source || ''
    };
  } else {
    return {
      mode: 'visual',
      aggregation: row.measureAgg || 'SUM',
      targetColumn: row.measureCol || '',
      table: null,
      rawSql: null
    };
  }
}

export function parseRowFilterExpr(filterExpr: string): { rowFilters: RowFilterCondition[]; legacyFilterExpr: string } {
  if (!filterExpr) return { rowFilters: [], legacyFilterExpr: '' };
  try {
    const parsed = JSON.parse(filterExpr);
    if (Array.isArray(parsed)) return { rowFilters: parsed, legacyFilterExpr: '' };
  } catch { /* not JSON */ }
  return { rowFilters: [], legacyFilterExpr: filterExpr };
}

export function serializeRowFilters(row: any): string {
  if (row.rowType !== 'data') return '';
  if (row.rowFilters && row.rowFilters.length > 0) return JSON.stringify(row.rowFilters);
  return row.legacyFilterExpr || '';
}

export function formatDateForInput(dateStr: string, todayGetter: () => string = () => new Date().toISOString().split('T')[0]): string {
  if (!dateStr) return '';
  const t = dateStr.trim().toLowerCase();
  if (t === 'today' || t === 'sysdate') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const dt = new Date(dateStr);
  if (!isNaN(dt.getTime())) {
    const todayStr = todayGetter();
    const currentYear = todayStr.slice(0, 4);
    return String(dt.getFullYear()) === currentYear
      ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      : '';
  }
  return '';
}

export function dateOffsetString(n: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getTime());
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
