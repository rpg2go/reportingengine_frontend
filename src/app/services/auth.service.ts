import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';
  isAuthenticated = signal<boolean>(sessionStorage.getItem('token') !== null);

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<any> {
    const credToken = btoa(`${username}:${password}`);
    const headers = new HttpHeaders({
      'Authorization': `Basic ${credToken}`
    });

    return this.http.get<any>(`${this.apiUrl}/login`, { headers }).pipe(
      tap((res) => {
        sessionStorage.setItem('token', res.token);
        sessionStorage.setItem('username', username);
        this.isAuthenticated.set(true);
      })
    );
  }

  logout(): void {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    this.isAuthenticated.set(false);
  }

  getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  getAuthHeader(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  getUsername(): string {
    return sessionStorage.getItem('username') || '';
  }
}
