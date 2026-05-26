import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { of, throwError } from 'rxjs';

// Mock sessionStorage globally before importing/instantiating service
const mockSessionStore: Record<string, string> = {};
globalThis.sessionStorage = {
  getItem: (key: string) => mockSessionStore[key] || null,
  setItem: (key: string, value: string) => { mockSessionStore[key] = value; },
  removeItem: (key: string) => { delete mockSessionStore[key]; },
  clear: () => { for (const key in mockSessionStore) delete mockSessionStore[key]; },
  length: 0,
  key: (index: number) => null,
};

describe('AuthService', () => {
  let service: AuthService;
  let mockHttp: any;

  beforeEach(() => {
    // Clear storage
    sessionStorage.clear();
    
    // Mock HttpClient
    mockHttp = {
      get: vi.fn()
    };
    
    service = new AuthService(mockHttp);
  });

  it('should initialize isAuthenticated to false when no token exists', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should initialize isAuthenticated to true if token exists', () => {
    sessionStorage.setItem('token', 'xyz');
    const anotherService = new AuthService(mockHttp);
    expect(anotherService.isAuthenticated()).toBe(true);
  });

  it('should call login endpoint and save token/username on success', () => {
    const username = 'admin';
    const password = 'password';
    const expectedToken = btoa(`${username}:${password}`);
    
    mockHttp.get.mockReturnValue(of({ success: true }));

    service.login(username, password).subscribe();

    expect(mockHttp.get).toHaveBeenCalledWith('/api/auth/login', {
      headers: expect.any(Object)
    });
    
    // Check that headers contain auth token
    const callArgs = mockHttp.get.mock.calls[0][1];
    const headers = callArgs.headers;
    expect(headers.get('Authorization')).toBe(`Basic ${expectedToken}`);

    // Session storage must be updated
    expect(sessionStorage.getItem('token')).toBe(expectedToken);
    expect(sessionStorage.getItem('username')).toBe(username);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should handle login error without setting authentication state', () => {
    mockHttp.get.mockReturnValue(throwError(() => new Error('Unauthorized')));

    service.login('admin', 'wrong').subscribe({
      error: (err) => {
        expect(err.message).toBe('Unauthorized');
      }
    });

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should clear storage and reset isAuthenticated on logout', () => {
    sessionStorage.setItem('token', 'abc');
    sessionStorage.setItem('username', 'user');
    service.isAuthenticated.set(true);

    service.logout();

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('username')).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should return token via getToken', () => {
    sessionStorage.setItem('token', 'my-token');
    expect(service.getToken()).toBe('my-token');
  });

  it('should return correct username via getUsername', () => {
    expect(service.getUsername()).toBe('');
    sessionStorage.setItem('username', 'admin');
    expect(service.getUsername()).toBe('admin');
  });

  it('should build auth headers correctly', () => {
    // No token
    let headers = service.getAuthHeader();
    expect(headers.get('Authorization')).toBe('');

    // With token
    sessionStorage.setItem('token', 'token123');
    headers = service.getAuthHeader();
    expect(headers.get('Authorization')).toBe('Basic token123');
  });
});
