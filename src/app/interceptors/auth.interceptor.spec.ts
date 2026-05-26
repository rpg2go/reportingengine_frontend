import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

describe('authInterceptor', () => {
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
      authInterceptor(req, next).subscribe();
    });

    expect(next).toHaveBeenCalledWith(req);
  });

  it('should inject Basic Auth header if token is present and URL matches /api/', () => {
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
      authInterceptor(req, next).subscribe();
    });

    expect(next).toHaveBeenCalled();
    const modifiedReq: HttpRequest<any> = next.mock.calls[0][0];
    expect(modifiedReq.headers.get('Authorization')).toBe('Basic my-secret-token');
  });

  it('should not inject Basic Auth header if URL does not include /api/', () => {
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
      authInterceptor(req, next).subscribe();
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
      authInterceptor(req, next).subscribe({
        error: (err) => {
          expect(err).toBe(errorResponse);
        }
      });
    });

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
