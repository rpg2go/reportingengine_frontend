import '@angular/compiler';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Injector, runInInjectionContext, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder } from '@angular/forms';
import { ReportBuilderComponent } from './report-builder';
import { ReportService } from '../services/report.service';
import { AuthService } from '../services/auth.service';
import { of, throwError, Subject } from 'rxjs';

globalThis.confirm = vi.fn().mockReturnValue(true);
globalThis.alert = vi.fn();

describe('ReportBuilderComponent', () => {
  let component: ReportBuilderComponent;
  let mockReportService: any;
  let mockAuthService: any;
  let mockRouter: any;
  let mockRoute: any;
  let mockDestroyRef: any;

  const mockTables = ['table1', 'table2'];
  const mockDates = ['2025-12-31', '2025-11-30'];
  const mockConfig = {
    reportId: 'R1',
    reportName: 'Sales Report',
    version: 1,
    status: 'draft',
    sourceTable: 'table1',
    granularity: 'daily',
    reportingDate: '2025-12-31',
    timeframeStart: '2022-01-01',
    timeframeEnd: '2025-12-31',
    timeframeToday: false,
    quickFilters: 'col1',
    generalFilters: '[]',
    columns: [
      {
        colId: 'C1',
        label: 'Col 1',
        colType: 'WTD',
        periodOffset: 0,
        rollingN: null,
        formulaExpr: '',
        selected: false,
      }
    ],
    rows: [
      {
        rowId: 'R1',
        label: 'Metric 1',
        rowType: 'data',
        source: {
          sourceTable: 'analytics.fact_sales',
          targetColumn: 'amount',
          aggregation: 'SUM',
        },
        sourceTable: 'analytics.fact_sales',
        activeCols: ['C1'],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockReportService = {
      getTables: vi.fn().mockReturnValue(of(mockTables)),
      getReportingDates: vi.fn().mockReturnValue(of(mockDates)),
      getReportConfig: vi.fn().mockReturnValue(of(mockConfig)),
      getTableColumns: vi.fn().mockReturnValue(of([])),
      getColumnTypes: vi.fn().mockReturnValue(of({})),
      getDimensionJoins: vi.fn().mockReturnValue(of([])),
      getDistinctValues: vi.fn().mockReturnValue(of([])),
      getSemanticModel: vi.fn().mockReturnValue(of({ dimensions: [], measures: [] })),
      createReport: vi.fn(),
      saveReport: vi.fn(),
      validateReport: vi.fn().mockReturnValue(of({ errors: [] })),
      previewSql: vi.fn().mockReturnValue(of({ sql: '' })),
    };
    mockAuthService = {
      getUsername: vi.fn().mockReturnValue('admin'),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    mockRoute = {
      params: of({ id: 'new' }),
      queryParams: of({}),
    };
    mockDestroyRef = {
      onDestroy: vi.fn().mockReturnValue(() => {}),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createComponent = (routeParams: any = { id: 'new' }, queryParams: any = {}) => {
    mockRoute.params = of(routeParams);
    mockRoute.queryParams = of(queryParams);
    const injector = Injector.create({
      providers: [
        { provide: ReportService, useValue: mockReportService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: DestroyRef, useValue: mockDestroyRef },
        FormBuilder,
      ],
    });

    runInInjectionContext(injector, () => {
      component = new ReportBuilderComponent();
      component.ngOnInit();
    });
  };

  it('should initialize as a new report with only R1 row and generated unique UUID', () => {
    createComponent({ id: 'new' });

    expect(component.isNewReport).toBe(true);
    expect(mockReportService.getTables).toHaveBeenCalled();
    expect(mockReportService.getReportingDates).toHaveBeenCalled();
    expect(component.dbTables).toEqual(mockTables);
    expect(component.availableReportingDates).toEqual(mockDates);

    // Verify default rows (only R1 is present)
    expect(component.rows.length).toBe(1);
    expect(component.rows[0].rowId).toBe('R1');
    expect(component.rows[0].label).toBe('Report Header');
    expect(component.rows[0].rowType).toBe('section');

    // Verify reportId matches UUID format
    expect(component.reportId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should initialize editing an existing report', () => {
    createComponent({ id: 'R1' });

    expect(component.isNewReport).toBe(false);
    expect(component.reportId).toBe('R1');
    expect(mockReportService.getReportConfig).toHaveBeenCalledWith('R1', '2025-12-31', undefined);
    expect(component.reportName).toBe('Sales Report');
    expect(component.sourceTable).toBe('table1');
  });

  it('should set error message when loading report config fails', () => {
    mockReportService.getReportConfig.mockReturnValue(throwError(() => new Error('Load failed')));
    createComponent({ id: 'R1' });

    expect(component.errorMessage()).toBe('Failed to load report definition details.');
  });

  it('should compute timeframe end based on mode', () => {
    createComponent({ id: 'new' });

    component.timeframeMode = 'today';
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(component.computedTimeframeEnd).toBe(today);

    component.timeframeMode = 'custom';
    component.timeframeEnd = '2026-05-26';
    expect(component.computedTimeframeEnd).toBe('2026-05-26');
  });

  it('should validate inputs in saveConfig', () => {
    createComponent({ id: 'new' });

    // empty reportId & name
    component.reportId = '';
    component.reportName = '';
    component.saveConfig();
    expect(component.errorMessage()).toBe('Report ID and Report Title are mandatory fields.');
    expect(component.saving()).toBe(false);

    // no active data rows with catalog source
    component.reportId = 'R2';
    component.reportName = 'Test Report';
    component.columns = [
      { colId: 'C1', label: 'Col 1', colType: 'WTD', periodOffset: 0, rollingN: null, formulaExpr: '', selected: false }
    ];
    component.rows = []; // empty rows
    component.runValidation();
    component.saveConfig();
    expect(component.errorMessage()).toBe(
      'At least one data row with a valid catalog source field is required.',
    );
    expect(component.saving()).toBe(false);
  });

  it('should block saveConfig if column or row labels start with formula triggers', () => {
    createComponent({ id: 'R1' });
    component.reportId = 'R1';
    component.reportName = 'Test Report';

    component.rows = [
      {
        rowId: 'row1',
        label: 'Row Label',
        rowType: 'data',
        measureType: 'SUM',
        factTable: 'f_sales',
        factField: 'amount',
      } as any,
    ];
    component.columns = [
      {
        colId: 'col1',
        label: 'Col Label',
        colType: 'DATE',
      } as any,
    ];

    // Column label starting with '='
    component.columns[0].label = '=unsafe';
    component.saveConfig();
    expect(component.errorMessage()).toContain(
      'Column label "=unsafe" cannot start with formula triggers',
    );
    expect(component.saving()).toBe(false);

    // Reset column label and set Row label starting with '+'
    component.columns[0].label = 'Safe Col';
    component.rows[0].label = '+unsafe_row';
    component.saveConfig();
    expect(component.errorMessage()).toContain(
      'Row label "+unsafe_row" cannot start with formula triggers',
    );
    expect(component.saving()).toBe(false);
  });

  it('should call createReport when saving a new report', () => {
    createComponent({ id: 'new' });
    component.reportId = 'R2';
    component.reportName = 'Test Report';
    component.sourceTable = 'table1';
    component.columns = [
      { colId: 'C1', label: 'Col 1', colType: 'WTD', periodOffset: 0, rollingN: null, formulaExpr: '', selected: false }
    ];
    component.rows = [
      {
        rowId: 'R1',
        label: 'Metric 1',
        rowType: 'data',
        source: 'SUM(amount)',
        sourceTable: 'analytics.fact_sales',
        measureAgg: 'SUM',
        measureCol: 'amount',
        activeCols: ['C1'],
      },
    ];

    const saveSubject = new Subject<any>();
    mockReportService.createReport.mockReturnValue(saveSubject);

    component.runValidation();
    component.saveConfig();

    expect(component.saving()).toBe(true);
    expect(mockReportService.createReport).toHaveBeenCalled();

    saveSubject.next({ success: true });
    saveSubject.complete();

    expect(component.saving()).toBe(false);
    expect(component.successMessage()).toBe('Report definition successfully saved!');
    expect(component.isNewReport).toBe(false);

    vi.advanceTimersByTime(1200);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/reports', 'R2', 'edit']);
  });

  it('should call saveReport when saving an existing report', () => {
    createComponent({ id: 'R1' });

    const saveSubject = new Subject<any>();
    mockReportService.saveReport.mockReturnValue(saveSubject);

    component.saveConfig();

    expect(component.saving()).toBe(true);
    expect(mockReportService.saveReport).toHaveBeenCalledWith('R1', expect.any(Object));

    saveSubject.next({ success: true });
    saveSubject.complete();

    expect(component.saving()).toBe(false);
    expect(component.successMessage()).toBe('Report definition successfully saved!');

    mockRouter.navigate.mockClear();
    vi.advanceTimersByTime(2000);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.successMessage()).toBeNull();
  });

  it('should handle save error gracefully', () => {
    createComponent({ id: 'R1' });
    mockReportService.saveReport.mockReturnValue(
      throwError(() => ({
        error: { message: 'Persistence failed' },
      })),
    );

    component.saveConfig();

    expect(component.saving()).toBe(false);
    expect(component.errorMessage()).toBe('Persistence failed');
  });

  it('should go back with confirmation', () => {
    createComponent({ id: 'R1' });
    component.goBack();
    expect(globalThis.confirm).toHaveBeenCalledWith('Discard changes and exit?');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/reports', 'R1']);
  });

  it('should validate filter column types on saveConfig', () => {
    createComponent({ id: 'new' });
    component.reportId = 'R2';
    component.reportName = 'Test Report';
    component.sourceTable = 'table1';
    component.columns = [
      { colId: 'C1', label: 'Col 1', colType: 'WTD', periodOffset: 0, rollingN: null, formulaExpr: '', selected: false }
    ];
    component.runValidation();
    component.rows = [
      {
        rowId: 'R1',
        label: 'Metric 1',
        rowType: 'data',
        source: 'SUM(amount)',
        sourceTable: 'analytics.fact_sales',
        measureAgg: 'SUM',
        measureCol: 'amount',
        activeCols: ['C1'],
      },
    ];

    mockReportService.createReport.mockReturnValue(of({}));
    mockReportService.saveReport.mockReturnValue(of({}));

    // Populate column types cache manually for the test
    component.columnTypesCache = {
      table1: {
        age: 'integer',
        salary: 'numeric',
        active: 'boolean',
        created_at: 'date',
      },
    };

    // 1. Invalid integer
    component.quickFilters = [
      { dimTable: '', attribute: 'age', operator: '=', value: 'abc', conjunction: 'AND' },
    ];
    component.saveConfig();
    expect(component.errorMessage()).toContain(
      'Value "abc" is not valid for column "age" of type "integer"',
    );
    expect(component.saving()).toBe(false);

    // 2. Valid integer
    component.quickFilters = [
      { dimTable: '', attribute: 'age', operator: '=', value: '25', conjunction: 'AND' },
    ];
    component.errorMessage.set(null);
    component.saveConfig();
    expect(component.errorMessage()).toBeNull();

    // 3. Invalid numeric
    component.generalFilters = [
      { dimTable: '', attribute: 'salary', operator: '>', value: '123.45abc' },
    ];
    component.saveConfig();
    expect(component.errorMessage()).toContain(
      'Value "123.45abc" is not valid for column "salary" of type "numeric"',
    );

    // 4. Valid numeric
    component.generalFilters = [
      { dimTable: '', attribute: 'salary', operator: '>', value: '123.45' },
    ];
    component.errorMessage.set(null);
    component.saveConfig();
    expect(component.errorMessage()).toBeNull();

    // 5. Invalid boolean
    component.generalFilters = [{ dimTable: '', attribute: 'active', operator: '=', value: 'yes' }];
    component.saveConfig();
    expect(component.errorMessage()).toContain(
      'Value "yes" is not valid for column "active" of type "boolean"',
    );

    // 6. Valid boolean
    component.generalFilters = [
      { dimTable: '', attribute: 'active', operator: '=', value: 'true' },
    ];
    component.errorMessage.set(null);
    component.saveConfig();
    expect(component.errorMessage()).toBeNull();

    // 7. Invalid date
    component.generalFilters = [
      { dimTable: '', attribute: 'created_at', operator: '>', value: 'not-a-date' },
    ];
    component.saveConfig();
    expect(component.errorMessage()).toContain(
      'Value "not-a-date" is not valid for column "created_at" of type "date"',
    );

    // 8. Valid date
    component.generalFilters = [
      { dimTable: '', attribute: 'created_at', operator: '>', value: '2025-12-31' },
    ];
    component.errorMessage.set(null);
    component.saveConfig();
    expect(component.errorMessage()).toBeNull();

    // 9. Invalid row filter
    component.rows = [
      {
        rowId: 'R1',
        label: 'Row 1',
        rowType: 'data',
        sourceTable: 'table1',
        rowFilters: [{ dimTable: '', attribute: 'age', operator: '=', value: 'abc' }],
        activeCols: [],
      } as any,
    ];
    component.saveConfig();
    expect(component.errorMessage()).toContain(
      'Value "abc" is not valid for column "age" of type "integer" in row "Row 1"',
    );

    // 10. Valid row filter
    component.rows = [
      {
        rowId: 'R1',
        label: 'Row 1',
        rowType: 'data',
        sourceTable: 'table1',
        rowFilters: [{ dimTable: '', attribute: 'age', operator: '=', value: '25' }],
        activeCols: [],
      } as any,
    ];
    component.errorMessage.set(null);
    component.saveConfig();
    expect(component.errorMessage()).toBeNull();
  });

  it('should clear value when pending row filter attribute changes', () => {
    createComponent({ id: 'new' });
    component.pendingRowFilter = {
      dimTable: 'table1',
      attribute: 'age',
      operator: '=',
      value: '25',
    };
    component.onPendingFilterAttrChange();
    expect(component.pendingRowFilter.value).toBe('');
  });

  it('should remove row filter', () => {
    createComponent({ id: 'new' });
    const row = { rowFilters: [{ attribute: 'age', operator: '=', value: '25' }] };
    component.removeRowFilter(row, 0);
    expect(row.rowFilters.length).toBe(0);
  });

  it('should reset row filters and legacy expr on row type change to non-data', () => {
    createComponent({ id: 'new' });
    const row = {
      rowType: 'calc',
      rowFilters: [{ attribute: 'age' }],
      legacyFilterExpr: 'age = 25',
      source: 'sum',
      customSqlMode: true,
    };
    component.onRowTypeChange(row);
    expect(row.rowFilters).toEqual([]);
    expect(row.legacyFilterExpr).toBe('');
    expect(row.source).toBe('sum'); // calc row type does not clear source
  });

  it('should clear source on row type change to section or blank', () => {
    createComponent({ id: 'new' });
    const rowSection = { rowType: 'section', source: 'sum', customSqlMode: true };
    component.onRowTypeChange(rowSection);
    expect(rowSection.source).toBe('');
    expect(rowSection.customSqlMode).toBe(false);

    const rowBlank = { rowType: 'blank', source: 'sum', customSqlMode: true };
    component.onRowTypeChange(rowBlank);
    expect(rowBlank.source).toBe('');
    expect(rowBlank.customSqlMode).toBe(false);
  });

  it('should manage adding, resetting, deleting, duplicating, and reordering rows', () => {
    createComponent({ id: 'new' });
    component.rows = [];
    component.tableColumns = ['col1'];

    // addRow
    component.addRow();
    expect(component.rows.length).toBe(1);
    expect(component.rows[0].rowId).toBe('R1');
    expect(component.rows[0].label).toBe('New Row 1');

    // changeIndent
    component.changeIndent(component.rows[0], 1);
    expect(component.rows[0].indentLevel).toBe(1);
    component.changeIndent(component.rows[0], -2);
    expect(component.rows[0].indentLevel).toBe(0);

    // duplicateSelectedRow
    component.rows[0].selected = true;
    component.duplicateSelectedRow();
    expect(component.rows.length).toBe(2);
    expect(component.rows[1].rowId).toBe('R2');
    expect(component.rows[1].label).toBe('New Row 1 (Copy)');

    // toggleAllRowsSelect
    const event = { target: { checked: false } };
    component.toggleAllRowsSelect(event);
    expect(component.rows[0].selected).toBe(false);
    expect(component.rows[1].selected).toBe(false);

    // reorderRows
    component.rows[0].rowId = 'R2';
    component.rows[1].rowId = 'R1';
    component.reorderRows();
    expect(component.rows[0].rowId).toBe('R1');
    expect(component.rows[1].rowId).toBe('R2');

    // deleteRow with confirm true
    globalThis.confirm = vi.fn().mockReturnValue(true);
    component.deleteRow(0);
    expect(component.rows.length).toBe(1);

    // deleteSelectedRows
    component.rows[0].selected = true;
    component.deleteSelectedRows();
    expect(component.rows.length).toBe(0);

    // resetRows
    component.rows = [{ rowId: 'R1' } as any];
    component.resetRows();
    expect(component.rows.length).toBe(0);
  });

  it('should toggle columns active state for row', () => {
    createComponent({ id: 'new' });
    const row = { activeCols: ['C1'] };
    component.toggleColForRow(row, 'C2');
    expect(row.activeCols).toContain('C2');
    component.toggleColForRow(row, 'C2');
    expect(row.activeCols).not.toContain('C2');
  });

  it('should manage adding, resetting, deleting, duplicating, and reordering columns', () => {
    createComponent({ id: 'new' });
    component.columns = [];

    // addColumn
    component.addColumn();
    expect(component.columns.length).toBe(1);
    expect(component.columns[0].colId).toBe('C1');

    // duplicateSelectedColumn
    component.columns[0].selected = true;
    component.duplicateSelectedColumn();
    expect(component.columns.length).toBe(2);
    expect(component.columns[1].colId).toBe('C2');

    // toggleAllColsSelect
    component.toggleAllColsSelect({ target: { checked: true } });
    expect(component.columns[0].selected).toBe(true);

    // reorderColumns
    component.columns[0].colId = 'C2';
    component.columns[1].colId = 'C1';
    component.reorderColumns();
    expect(component.columns[0].colId).toBe('C1');

    // deleteColumn
    globalThis.confirm = vi.fn().mockReturnValue(true);
    component.rows = [{ activeCols: ['C1'] } as any];
    component.deleteColumn(0); // deletes C1, which is now index 0 after sort
    expect(component.columns.length).toBe(1);
    expect(component.rows[0].activeCols.length).toBe(0);

    // deleteSelectedCols
    component.columns = [{ colId: 'C1', selected: true } as any];
    component.rows = [{ activeCols: ['C1'] } as any];
    component.deleteSelectedCols();
    expect(component.columns.length).toBe(0);
    expect(component.rows[0].activeCols.length).toBe(0);

    // resetColumns
    component.columns = [{ colId: 'C1' } as any];
    component.resetColumns();
    expect(component.columns.length).toBe(0);
  });

  it('should manage preview and sidebar', () => {
    createComponent({ id: 'new' });
    expect(component.showPreview()).toBe(false);
    component.togglePreview();
    expect(component.showPreview()).toBe(true);

    expect(component.sidebarOpen()).toBe(false);
    component.toggleSidebar();
    expect(component.sidebarOpen()).toBe(true);
    component.closeSidebar();
    expect(component.sidebarOpen()).toBe(false);
  });

  it('should call parsing, serialization and utility helpers', () => {
    createComponent({ id: 'new' });

    // parseMeasure
    const pm = component['parseMeasure']('SUM(amount)');
    expect(pm.aggFunction).toBe('SUM');
    expect(pm.measureCol).toBe('amount');

    // parseRowFilterExpr
    const prf = component['parseRowFilterExpr'](
      '[{"dimTable":"","attribute":"age","operator":"=","value":"25"}]',
    );
    expect(prf.rowFilters.rules.length).toBe(1);
    expect(prf.rowFilters.rules[0].columnName).toBe('age');

    // serializeMeasure
    const sm = component['serializeMeasure']({
      rowType: 'data',
      customSqlMode: false,
      measureAgg: 'SUM',
      measureCol: 'amount',
      sourceTable: null,
    });
    expect(sm).toEqual({
      aggregation: 'SUM',
      targetColumn: 'amount',
      sourceTable: null,
      rawExpression: null,
    });

    // serializeRowFilters
    const srf = component['serializeRowFilters']({
      rowType: 'data',
      rowFilters: [{ dimTable: '', attribute: 'age', operator: '=', value: '25' }],
    });
    expect(srf).toContain('"attribute":"age"');

    // formatDateForInput
    const formatted = component.formatDateForInput('2026-05-29');
    expect(formatted).toBe('2026-05-29');

    // isFilterValueInvalid
    component.columnTypesCache = {
      table1: { age: 'integer' },
    };
    component.sourceTable = 'table1';
    expect(component.isFilterValueInvalid({ attribute: 'age', value: '25' })).toBe(false);
    expect(component.isFilterValueInvalid({ attribute: 'age', value: 'abc' })).toBe(true);
    expect(component.isFilterValueInvalid({ attribute: 'age', value: '' })).toBe(false);
    expect(component.isFilterValueInvalid({ attribute: 'nonexistent', value: '123' })).toBe(false);
  });

  it('should manage pending row filters and fetch distinct values', () => {
    createComponent({ id: 'new' });

    // 1. onPendingFilterAttrChange with cached distinct values
    component.pendingRowFilter = {
      dimTable: 'table1',
      attribute: 'age',
      operator: '=',
      value: '25',
    };
    component.distinctValues = { 'table1.age': ['20', '30'] };
    component.onPendingFilterAttrChange();
    expect(component.pendingRowFilterValues).toEqual(['20', '30']);
    expect(component.pendingRowFilter.value).toBe('');

    // 2. onPendingFilterAttrChange with non-cached distinct values (calls service)
    mockReportService.getDistinctValues.mockReturnValue(of(['40', '50']));
    component.pendingRowFilter = {
      dimTable: 'table1',
      attribute: 'age',
      operator: '=',
      value: '25',
    };
    component.distinctValues = {};
    component.onPendingFilterAttrChange();
    expect(mockReportService.getDistinctValues).toHaveBeenCalledWith('table1', 'age');
    expect(component.pendingRowFilterValues).toEqual(['40', '50']);

    // 3. confirmRowFilter with invalid value
    globalThis.alert = vi.fn();
    component.columnTypesCache = { table1: { age: 'integer' } };
    component.sourceTable = 'table1';
    component.pendingRowFilter = {
      dimTable: 'table1',
      attribute: 'age',
      operator: '=',
      value: 'abc',
    };
    const row = { rowFilters: [] } as any;
    component.confirmRowFilter(row);
    expect(globalThis.alert).toHaveBeenCalled();
    expect(row.rowFilters.length).toBe(0);

    // 4. confirmRowFilter with valid value
    component.pendingRowFilter = {
      dimTable: 'table1',
      attribute: 'age',
      operator: '=',
      value: '25',
    };
    component.confirmRowFilter(row);
    expect(row.rowFilters.length).toBe(1);
    expect(row.rowFilters[0].value).toBe('25');
  });

  it('should switch preview tabs and manage loading state', () => {
    createComponent({ id: 'new' });

    // Switch to grid by default
    component.activePreviewTab.set('grid');
    expect(component.activePreviewTab()).toBe('grid');

    // Simulate clicking the SQL tab
    component.activePreviewTab.set('sql');
    expect(component.activePreviewTab()).toBe('sql');

    // Loader is active
    component.isLoadingSql.set(true);
    expect(component.isLoadingSql()).toBe(true);

    component.isLoadingSql.set(false);
    expect(component.isLoadingSql()).toBe(false);
  });

  it('should trigger SQL preview request on previewSql call with canvas worksheet form state', () => {
    createComponent({ id: 'R1' });
    mockReportService.previewSql.mockReturnValue(of({ sql: 'SELECT * FROM analytics.fact_sales' }));

    component.reportId = 'R1';
    component.reportName = 'Sales Report';
    component.sourceTable = 'analytics.fact_sales';
    component.columns = [
      {
        colId: 'C1',
        label: 'WTD no.',
        colType: 'WTD',
        periodOffset: 0,
        rollingN: null,
        formulaExpr: null,
      },
    ];
    component.rows = [
      {
        rowId: 'R1',
        label: 'GBS gross',
        rowType: 'data',
        source: 'SUM(amount)',
        activeCols: ['C1'],
      },
    ];

    component.runSqlPreview();

    expect(mockReportService.previewSql).toHaveBeenCalled();
    expect(component.compiledSql()).toBe('SELECT * FROM analytics.fact_sales');
    expect(component.isLoadingSql()).toBe(false);
  });

  it('should highlight error cells and return true for element warning state', () => {
    createComponent({ id: 'new' });

    component.validationErrors.set([
      {
        elementId: 'R5',
        fieldContext: 'filterExpr',
        errorSeverity: 'WARNING',
        displayMessage: 'Row warning details',
      },
    ]);

    expect(component.hasError('R5', 'WARNING')).toBe(true);
    expect(component.hasError('R5', 'CRITICAL')).toBe(false);
    expect(component.hasError('R99')).toBe(false);
    expect(component.getErrorMessage('R5')).toContain('[WARNING] Row warning details');
  });

  it('should open SQL modal, load compilation, close it, and copy to clipboard', async () => {
    createComponent({ id: 'R1' });
    mockReportService.previewSql.mockReturnValue(of({ sql: 'SELECT * FROM analytics.fact_sales' }));

    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.resolve(),
        },
        configurable: true,
      });
    }
    const clipboardSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockImplementation(() => Promise.resolve());

    component.reportId = 'R1';
    component.reportName = 'Sales Report';
    component.sourceTable = 'analytics.fact_sales';
    component.columns = [];
    component.rows = [];

    // Trigger previewSql
    component.previewSql();

    expect(component.isSqlModalOpen()).toBe(true);
    expect(mockReportService.previewSql).toHaveBeenCalled();
    expect(component.previewSqlText()).toBe('SELECT * FROM analytics.fact_sales');
    expect(component.isLoadingSql()).toBe(false);

    // Trigger copySqlToClipboard
    await component.copySqlToClipboard();
    expect(clipboardSpy).toHaveBeenCalledWith('SELECT * FROM analytics.fact_sales');
    expect(component.isCopied()).toBe(true);

    // Trigger closeSqlModal
    component.closeSqlModal();
    expect(component.isSqlModalOpen()).toBe(false);
  });

  it('should filter schema tree with Table-Level Matching Cascade and Column-Level Matching Filter', () => {
    createComponent({ id: 'new' });

    const mockTree = [
      {
        category: 'Customer Dims',
        sourceTable: 'analytics.dim_customers',
        fields: [
          {
            name: 'id',
            displayName: 'ID',
            sourceTable: 'analytics.dim_customers',
            type: 'integer',
          },
          {
            name: 'name',
            displayName: 'Customer Name',
            sourceTable: 'analytics.dim_customers',
            type: 'varchar',
          },
        ],
      },
      {
        category: 'Investment Strategy Dims',
        sourceTable: 'analytics.dim_investment_hierarchy',
        fields: [
          {
            name: 'strategy_id',
            displayName: 'Strategy ID',
            sourceTable: 'analytics.dim_investment_hierarchy',
            type: 'integer',
          },
          {
            name: 'strategy_code',
            displayName: 'Strategy Code',
            sourceTable: 'analytics.dim_investment_hierarchy',
            type: 'varchar',
          },
        ],
      },
    ];

    component.dwhFieldsTree.set(mockTree);

    // Case 1: Search term matches table name ("customer") -> Table-Level Matching Cascade (display all columns, force expand)
    component.fieldsSearchQuery.set('customer');
    let filtered = component.filteredSchemaTree();
    expect(filtered.length).toBe(1);
    expect(filtered[0].sourceTable).toBe('analytics.dim_customers');
    expect(filtered[0].fields.length).toBe(2); // Displays ALL fields
    expect(component.isCategoryExpanded('analytics.dim_customers')).toBe(true);

    // Case 2: Search term matches column name with underscore fuzzy matching ("investment hierarchy") -> Table-Level Matching Cascade
    component.fieldsSearchQuery.set('investment hierarchy');
    filtered = component.filteredSchemaTree();
    expect(filtered.length).toBe(1);
    expect(filtered[0].sourceTable).toBe('analytics.dim_investment_hierarchy');
    expect(filtered[0].fields.length).toBe(2);
    expect(component.isCategoryExpanded('analytics.dim_investment_hierarchy')).toBe(true);

    // Case 3: Search term matches individual column attribute ("code") -> Column-Level Matching Filter (only matches code field)
    component.fieldsSearchQuery.set('code');
    filtered = component.filteredSchemaTree();
    expect(filtered.length).toBe(1);
    expect(filtered[0].sourceTable).toBe('analytics.dim_investment_hierarchy');
    expect(filtered[0].fields.length).toBe(1);
    expect(filtered[0].fields[0].name).toBe('strategy_code');
    // For column match without table match, it uses standard expansion behavior
    expect(component.isCategoryExpanded('analytics.dim_investment_hierarchy')).toBe(false); // Since it wasn't expanded previously

    // Case 4: No matches -> Empty state (filtered length is 0)
    component.fieldsSearchQuery.set('non_existent');
    filtered = component.filteredSchemaTree();
    expect(filtered.length).toBe(0);
  });

  it('should support collapsible sidebars for main menu navigation and DWH field picker', () => {
    createComponent({ id: 'new' });

    // Initial states
    expect(component.isMainMenuCollapsed()).toBe(false);
    expect(component.isFieldPickerOpen()).toBe(false);

    // Toggle Main Menu
    component.toggleMainMenu();
    expect(component.isMainMenuCollapsed()).toBe(true);
    component.toggleMainMenu();
    expect(component.isMainMenuCollapsed()).toBe(false);

    // Toggle Field Picker
    component.toggleFieldPicker();
    expect(component.isFieldPickerOpen()).toBe(true);
    component.toggleFieldPicker();
    expect(component.isFieldPickerOpen()).toBe(false);
  });

  it('should initialize columnWidths and update them on width changes', () => {
    createComponent({ id: 'new' });

    // Verify initial columnWidths signal values
    expect(component.columnWidths()).toEqual([40, 80, 80, 320, 140, 360, 240, 200, 50]);

    // Verify computed styles
    expect(component.computedWidthsString()).toBe(
      '40px 80px 80px 320px 140px 360px 240px 200px 50px',
    );

    // Trigger width change on Column index 2 (Row Name Label)
    component.onColumnWidthChanged(2, 350);
    expect(component.columnWidths()[2]).toBe(350);

    // Verify computed styles recalculate reactively
    expect(component.computedWidthsString()).toBe(
      '40px 80px 350px 320px 140px 360px 240px 200px 50px',
    );
  });

  it('should validate list values for numeric and other types correctly', () => {
    createComponent({ id: 'new' });

    // Single int
    expect(component.validateFilterValue('integer', '1')).toBe(true);
    expect(component.validateFilterValue('integer', 'abc')).toBe(false);

    // List of ints
    expect(component.validateFilterValue('integer', '1, 2, 5, 6')).toBe(true);
    expect(component.validateFilterValue('integer', '1, 2, 5, abc')).toBe(false);

    // Quoted list of ints
    expect(component.validateFilterValue('integer', "'1', '2', '5', '6'")).toBe(true);

    // Decimal list
    expect(component.validateFilterValue('numeric', '1.2, 3.4, 5.0')).toBe(true);
    expect(component.validateFilterValue('numeric', '1.2, abc')).toBe(false);
  });

  it('should initialize in viewOnlyMode and lock form controls', () => {
    createComponent({ id: 'R1' }, { view: 'true' });
    expect(component.viewOnlyMode).toBe(true);
    expect(component.isLocked).toBe(true);
    expect(component.reportForm.disabled).toBe(true);
  });
});
