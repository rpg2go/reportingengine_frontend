import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportService } from './report.service';
import { of } from 'rxjs';

describe('ReportService', () => {
  let service: ReportService;
  let mockHttp: any;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    };
    service = new ReportService(mockHttp);
  });

  it('should fetch all reports via getReports', () => {
    const mockReports = [{ id: '1', reportName: 'Report 1' }];
    mockHttp.get.mockReturnValue(of(mockReports));

    service.getReports().subscribe((data) => {
      expect(data).toEqual(mockReports);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('/api/reports');
  });

  it('should fetch report config via getReportConfig', () => {
    const mockConfig = { id: '1', reportName: 'Report 1', rows: [] };
    mockHttp.get.mockReturnValue(of(mockConfig));

    service.getReportConfig('1', '2025-12-31').subscribe((data) => {
      expect(data).toEqual(mockConfig);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('/api/reports/1?date=2025-12-31');
  });

  it('should upload a template file via importTemplate', () => {
    mockHttp.post.mockReturnValue(of({ success: true }));

    // Mock File
    const mockFile = new File([''], 'template.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    service.importTemplate(mockFile).subscribe();

    expect(mockHttp.post).toHaveBeenCalledWith('/api/reports/import', expect.any(FormData));
  });

  it('should run a report and request blob response via runReport', () => {
    const mockBlob = new Blob([''], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    mockHttp.post.mockReturnValue(of(mockBlob));

    service.runReport('1', '2025-12-31').subscribe((data) => {
      expect(data).toBe(mockBlob);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      '/api/reports/1/run?date=2025-12-31&format=xlsx',
      null,
      { responseType: 'blob' }
    );
  });

  it('should fetch schema catalog via getSchemaCatalog', () => {
    const mockModel = { explores: [], views: [] };
    mockHttp.get.mockReturnValue(of(mockModel));

    service.getSchemaCatalog().subscribe((data) => {
      expect(data).toEqual(mockModel);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('/api/reports/schema-catalog');
  });

  it('should update a report configuration via saveReport', () => {
    const mockConfig = { id: '1', rows: [] };
    mockHttp.put.mockReturnValue(of({ success: true }));

    service.saveReport('1', mockConfig).subscribe();

    expect(mockHttp.put).toHaveBeenCalledWith('/api/reports/1', mockConfig);
  });

  it('should create a report configuration via createReport', () => {
    const mockConfig = { reportName: 'New Report', rows: [] };
    mockHttp.post.mockReturnValue(of({ id: '2', ...mockConfig }));

    service.createReport(mockConfig).subscribe();

    expect(mockHttp.post).toHaveBeenCalledWith('/api/reports', mockConfig);
  });

  it('should fetch list of tables via getTables', () => {
    const mockTables = ['table1', 'table2'];
    mockHttp.get.mockReturnValue(of(mockTables));

    service.getTables().subscribe((data) => {
      expect(data).toEqual(mockTables);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('/api/reports/tables');
  });

  it('should fetch table columns via getTableColumns', () => {
    const mockColumns = ['col1', 'col2'];
    mockHttp.get.mockReturnValue(of(mockColumns));

    service.getTableColumns('table1').subscribe((data) => {
      expect(data).toEqual(mockColumns);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('/api/reports/table-columns?table=table1');
  });

  it('should fetch distinct dimension values via getDistinctValues', () => {
    const mockValues = ['val1', 'val2'];
    mockHttp.get.mockReturnValue(of(mockValues));

    service.getDistinctValues('table1', 'col1').subscribe((data) => {
      expect(data).toEqual(mockValues);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('/api/reports/dimensions/values?table=table1&column=col1');
  });

  it('should fetch dimension joins via getDimensionJoins', () => {
    const mockJoins = [{ dimView: 'dim1', joinType: 'left' }];
    mockHttp.get.mockReturnValue(of(mockJoins));

    service.getDimensionJoins('fact_table').subscribe((data) => {
      expect(data).toEqual(mockJoins);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('/api/reports/dimension-joins?factTable=fact_table');
  });

  it('should fetch reporting dates via getReportingDates', () => {
    const mockDates = ['2025-12-31'];
    mockHttp.get.mockReturnValue(of(mockDates));

    service.getReportingDates().subscribe((data) => {
      expect(data).toEqual(mockDates);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('/api/reports/dimensions/values?table=dim_date&column=reporting_date');
  });
});
