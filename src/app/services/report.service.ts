import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = '/api/reports';

  constructor(private http: HttpClient) {}

  getReports(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getReportConfig(id: string, date: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}?date=${date}`);
  }

  importTemplate(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.apiUrl}/import`, formData);
  }

  runReport(id: string, date: string): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/${id}/run?date=${date}`, null, {
      responseType: 'blob'
    });
  }

  getSemanticModel(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/semantic-model`);
  }

  saveReport(id: string, config: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, config);
  }

  createReport(config: any): Observable<any> {
    return this.http.post(this.apiUrl, config);
  }

  deleteReport(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  validateReport(config: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/validate`, config);
  }

  previewSql(config: any): Observable<{ sql: string }> {
    return this.http.post<{ sql: string }>(`${this.apiUrl}/preview-sql`, config);
  }

  getTables(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/tables`);
  }

  getTableColumns(table: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/table-columns?table=${table}`);
  }

  getColumnTypes(table: string): Observable<{ [column: string]: string }> {
    return this.http.get<{ [column: string]: string }>(`${this.apiUrl}/column-types?table=${table}`);
  }

  getDistinctValues(table: string, column: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/dimensions/values?table=${table}&column=${column}`);
  }

  getMetadataDistinctValues(table: string, column: string): Observable<string[]> {
    return this.http.get<string[]>(`/api/metadata/distinct-values?table=${table}&column=${column}`);
  }

  /**
   * Fetches dimension view joins available for a given fact table.
   * Backend endpoint: GET /api/reports/dimension-joins?factTable=<table>
   * Returns: [{ dimView: string, joinType: string, joinSql: string, ... }]
   */
  getDimensionJoins(factTable: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/dimension-joins?factTable=${factTable}`);
  }

  /**
   * Fetches available reporting dates from dim_date.reporting_date.
   * Reuses the generic distinct-values endpoint.
   */
  getReportingDates(): Observable<string[]> {
    return this.getDistinctValues('dim_date', 'reporting_date');
  }

  executeReport(id: string, payload: { reportingDate: string; runtimeFilters: any[] }): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiUrl}/${id}/execute`, payload);
  }
}
