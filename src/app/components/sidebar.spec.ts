import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SidebarComponent } from './sidebar';
import { Injector, runInInjectionContext } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { ThemeService } from '../services/theme.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let mockAuthService: any;
  let mockRouter: any;
  let mockThemeService: any;

  beforeEach(() => {
    mockAuthService = {
      getUsername: vi.fn().mockReturnValue('test-user'),
      logout: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    mockThemeService = {
      isLight: vi.fn().mockReturnValue(false),
      toggle: vi.fn(),
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ThemeService, useValue: mockThemeService },
      ],
    });

    runInInjectionContext(injector, () => {
      component = new SidebarComponent(mockAuthService, mockRouter, mockThemeService);
    });
  });

  it('should initialize with isSidebarExpanded false', () => {
    expect(component.isSidebarExpanded()).toBe(false);
  });

  it('should toggle sidebar expansion state on toggleExpand', () => {
    component.toggleExpand();
    expect(component.isSidebarExpanded()).toBe(true);

    component.toggleExpand();
    expect(component.isSidebarExpanded()).toBe(false);
  });

  it('should logout and navigate to login', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
