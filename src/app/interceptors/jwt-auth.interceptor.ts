import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Standalone Functional HTTP Interceptor injecting the active OIDC JWT Bearer token.
 * Reads 'dev_token' from localStorage (for Swagger / dev overrides) or falls back to AuthService.
 */
export const jwtAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if a dev-override token exists in localStorage first, otherwise fallback to AuthService
  const devToken = typeof localStorage !== 'undefined' ? localStorage.getItem('dev_token') : null;
  const token = devToken || authService.getToken();

  let authReq = req;
  if (token && req.url.includes('/api/')) {
    authReq = req.clone({
      setHeaders: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Avoid redirecting on Blob queries if the execution schema fails downstream
      const isBlobRequest = req.responseType === 'blob';
      if (!isBlobRequest && (error.status === 401 || error.status === 403)) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
