import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

describe('authGuard', () => {
  it('should allow navigation if user is authenticated', () => {
    const mockAuthService = {
      isAuthenticated: () => true
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

    const result = runInInjectionContext(injector, () => {
      return authGuard({} as any, {} as any);
    });

    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should prevent navigation and redirect if user is not authenticated', () => {
    const mockAuthService = {
      isAuthenticated: () => false
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

    const result = runInInjectionContext(injector, () => {
      return authGuard({} as any, {} as any);
    });

    expect(result).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
