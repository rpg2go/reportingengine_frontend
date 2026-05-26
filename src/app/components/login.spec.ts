import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, DestroyRef } from '@angular/core';
import { LoginComponent } from './login';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let mockAuthService: any;
  let mockRouter: any;
  let mockDestroyRef: any;

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      login: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    mockDestroyRef = {
      onDestroy: vi.fn().mockReturnValue(() => {}),
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: DestroyRef, useValue: mockDestroyRef },
      ],
    });

    runInInjectionContext(injector, () => {
      component = new LoginComponent();
    });
  });

  it('should redirect to dashboard on init if already authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    
    // Create new instance to trigger constructor
    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: DestroyRef, useValue: mockDestroyRef },
      ],
    });
    
    runInInjectionContext(injector, () => {
      new LoginComponent();
    });

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should not redirect if not authenticated', () => {
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should not login if credentials are empty', () => {
    component.username = '';
    component.password = '';
    component.onSubmit();
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('should call authService.login and navigate to dashboard on success', () => {
    component.username = 'admin';
    component.password = 'password';
    
    const { Subject } = require('rxjs');
    const loginSubject = new Subject();
    mockAuthService.login.mockReturnValue(loginSubject);

    component.onSubmit();

    expect(component.loading()).toBe(true);
    expect(component.errorMessage()).toBeNull();
    expect(mockAuthService.login).toHaveBeenCalledWith('admin', 'password');

    loginSubject.next({ success: true });
    loginSubject.complete();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.loading()).toBe(false);
  });

  it('should set errorMessage on login failure', () => {
    component.username = 'admin';
    component.password = 'wrong';

    mockAuthService.login.mockReturnValue(throwError(() => new Error('Invalid')));

    component.onSubmit();

    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBe('Invalid username or password. Please try again.');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
