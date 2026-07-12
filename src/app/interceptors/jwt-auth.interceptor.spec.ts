import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { jwtAuthInterceptor } from './jwt-auth.interceptor';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

describe('jwtAuthInterceptor', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      clear: () => { store = {}; },
      removeItem: (key: string) => { delete store[key]; },
      length: 0,
      key: (index: number) => null
    } as any;
  });

  it('should pass request unmodified if token is not present', () => {
    const mockAuthService = {
      getToken: () => null,
      logout: vi.fn()
    };
    const mockRouter = {
      navigate: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });

    const req = new HttpRequest('GET', '/api/reports');
    const next = vi.fn().mockReturnValue(of({}));

    runInInjectionContext(injector, () => {
      jwtAuthInterceptor(req, next).subscribe();
    });

    expect(next).toHaveBeenCalledWith(req);
  });

  it('should inject Bearer Auth header if token is present in AuthService and URL matches /api/', () => {
    const mockAuthService = {
      getToken: () => 'my-secret-token',
      logout: vi.fn()
    };
    const mockRouter = {
      navigate: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });

    const req = new HttpRequest('GET', '/api/reports');
    const next = vi.fn().mockReturnValue(of({}));

    runInInjectionContext(injector, () => {
      jwtAuthInterceptor(req, next).subscribe();
    });

    expect(next).toHaveBeenCalled();
    const modifiedReq: HttpRequest<any> = next.mock.calls[0][0];
    expect(modifiedReq.headers.get('Authorization')).toBe('Bearer my-secret-token');
  });

  it('should prioritize dev_token from localStorage over AuthService token', () => {
    localStorage.setItem('dev_token', 'dev-override-token');
    const mockAuthService = {
      getToken: () => 'auth-service-token',
      logout: vi.fn()
    };
    const mockRouter = {
      navigate: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });

    const req = new HttpRequest('GET', '/api/reports');
    const next = vi.fn().mockReturnValue(of({}));

    runInInjectionContext(injector, () => {
      jwtAuthInterceptor(req, next).subscribe();
    });

    expect(next).toHaveBeenCalled();
    const modifiedReq: HttpRequest<any> = next.mock.calls[0][0];
    expect(modifiedReq.headers.get('Authorization')).toBe('Bearer dev-override-token');
  });

  it('should not inject Bearer Auth header if URL does not include /api/', () => {
    const mockAuthService = {
      getToken: () => 'my-secret-token',
      logout: vi.fn()
    };
    const mockRouter = {
      navigate: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });

    const req = new HttpRequest('GET', '/other-url');
    const next = vi.fn().mockReturnValue(of({}));

    runInInjectionContext(injector, () => {
      jwtAuthInterceptor(req, next).subscribe();
    });

    expect(next).toHaveBeenCalledWith(req);
  });

  it('should logout and redirect to login if response is 401 or 403', () => {
    const mockAuthService = {
      getToken: () => 'my-secret-token',
      logout: vi.fn()
    };
    const mockRouter = {
      navigate: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });

    const req = new HttpRequest('GET', '/api/reports');
    const errorResponse = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
    const next = vi.fn().mockReturnValue(throwError(() => errorResponse));

    runInInjectionContext(injector, () => {
      jwtAuthInterceptor(req, next).subscribe({
        error: (err) => {
          expect(err).toBe(errorResponse);
        }
      });
    });

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
