import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/reports-catalog').then(m => m.ReportsCatalogComponent),
    canActivate: [authGuard]
  },
  {
    path: 'reports/new/edit',
    loadComponent: () => import('./components/report-builder').then(m => m.ReportBuilderComponent),
    canActivate: [authGuard]
  },
  {
    path: 'reports/:id/edit',
    loadComponent: () => import('./components/report-builder').then(m => m.ReportBuilderComponent),
    canActivate: [authGuard]
  },
  {
    path: 'reports/:id',
    loadComponent: () => import('./components/report-detail').then(m => m.ReportDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'viewer',
    loadComponent: () => import('./components/execution-hub').then(m => m.ExecutionHubComponent),
    canActivate: [authGuard]
  },
  {
    path: 'viewer/:id',
    loadComponent: () => import('./components/execution-hub').then(m => m.ExecutionHubComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
