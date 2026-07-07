import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // If token exists and request is to /api, clone and inject Basic Auth header
  let authReq = req;
  if (token && req.url.includes('/api/')) {
    authReq = req.clone({
      setHeaders: {
        'Authorization': `Basic ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only treat 401/403 as a session expiry when the request is a normal
      // JSON API call. Blob-typed requests (report execution) can return 403
      // from the DWH execution layer without implying the API session is invalid.
      const isBlobRequest = req.responseType === 'blob';
      if (!isBlobRequest && (error.status === 401 || error.status === 403)) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
