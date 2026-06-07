import { Component, ChangeDetectionStrategy, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.collapsed]': '!isSidebarExpanded()',
    '[class.expanded]': 'isSidebarExpanded()',
  },
  template: `
    <!-- Mobile overlay backdrop -->
    <div class="sidebar-overlay" [class.visible]="mobileOpen()" (click)="closeMobileSidebar()"></div>

    <aside 
      class="sidebar transition-all duration-300 ease-in-out"
      [class.collapsed]="!isSidebarExpanded()"
      [class.expanded]="isSidebarExpanded()"
      [class.open]="mobileOpen()"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
    >
      <button class="sidebar-close-btn" (click)="closeMobileSidebar()" aria-label="Close navigation">✕</button>
      
      <div class="sidebar-brand">
        <span class="brand-icon">{{ brandIcon() }}</span>
        @if (isSidebarExpanded()) {
          <span class="brand-text animate-fade-in">{{ brandText() }}</span>
        }
        <button class="menu-collapse-btn" (click)="toggleExpand()" [title]="isSidebarExpanded() ? 'Collapse Menu' : 'Expand Menu'">
          {{ isSidebarExpanded() ? '«' : '➔' }}
        </button>
      </div>

      <nav class="sidebar-menu">
        <a routerLink="/dashboard" routerLinkActive="active" class="menu-item" [title]="!isSidebarExpanded() ? 'Reports Catalog' : ''">
          <span class="menu-icon">📁</span>
          @if (isSidebarExpanded()) {
            <span class="menu-text animate-fade-in">Reports Catalog</span>
          }
        </a>
        <a routerLink="/viewer" routerLinkActive="active" class="menu-item" [title]="!isSidebarExpanded() ? 'Reports Execution Hub' : ''">
          <span class="menu-icon">👁️</span>
          @if (isSidebarExpanded()) {
            <span class="menu-text animate-fade-in">Reports Execution Hub</span>
          }
        </a>
        <a routerLink="/semantic" routerLinkActive="active" class="menu-item" [title]="!isSidebarExpanded() ? 'Semantic Layer' : ''">
          <span class="menu-icon">🧠</span>
          @if (isSidebarExpanded()) {
            <span class="menu-text animate-fade-in">Semantic Layer</span>
          }
        </a>
      </nav>

      <div class="sidebar-user">
        @if (showBackButton()) {
          <button (click)="handleBack()" class="back-btn" [title]="backButtonText()">
            @if (isSidebarExpanded()) {
              <span>{{ backButtonText() }}</span>
            } @else {
              <span>{{ collapsedBackButtonText() }}</span>
            }
          </button>
        } @else if (showUser()) {
          <div class="user-info-container">
            @if (isSidebarExpanded()) {
              <div class="user-info animate-fade-in">
                <span class="user-avatar">👤</span>
                <div class="user-details">
                  <span class="user-name">{{ username() }}</span>
                  <span class="user-role">Administrator</span>
                </div>
              </div>
            }
            <button (click)="logout()" class="logout-btn" [title]="'Sign Out'">
              <span class="logout-icon">📤</span>
              @if (isSidebarExpanded()) {
                <span class="logout-text animate-fade-in">Sign Out</span>
              }
            </button>
          </div>
        }
      </div>
    </aside>
  `,
  styles: `
    :host {
      display: block;
      height: 100vh;
      position: sticky;
      top: 0;
      z-index: 100;
      flex-shrink: 0;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    :host.collapsed {
      width: 64px;
    }
    :host.expanded {
      width: 260px;
    }

    /* Transition classes to mimic Tailwind behavior */
    .transition-all {
      transition-property: all;
    }
    .duration-300 {
      transition-duration: 300ms;
    }
    .ease-in-out {
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    .shadow-2xl {
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    /* Responsive glassmorphic dark-mode sidebar styles */
    .sidebar {
      height: 100vh;
      width: 100%;
      background: rgba(15, 23, 42, 0.8) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
      gap: 32px;
      flex-shrink: 0;
      box-sizing: border-box;
    }

    .sidebar.collapsed {
      padding: 24px 8px;
      align-items: center;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      height: 40px;
    }
    
    .sidebar.collapsed .sidebar-brand {
      justify-content: center;
      gap: 0;
    }

    .brand-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .brand-text {
      font-size: 18px;
      font-weight: 800;
      background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .menu-collapse-btn {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
      padding: 6px;
      border-radius: 6px;
      margin-left: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .menu-collapse-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
    }
    .sidebar.collapsed .menu-collapse-btn {
      margin-left: 0;
      margin-top: 8px;
      display: none; /* Hide on collapsed view, using hover or hamburger on mobile */
    }

    .sidebar-menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-grow: 1;
      width: 100%;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      color: #94a3b8;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.2s ease;
      height: 48px;
      box-sizing: border-box;
      white-space: nowrap;
    }
    .menu-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #f1f5f9;
    }
    .menu-item.active {
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.2);
      font-weight: 600;
    }

    .sidebar.collapsed .menu-item {
      justify-content: center;
      padding: 12px 0;
    }

    .menu-icon {
      font-size: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .menu-text {
      font-size: 14px;
    }

    .sidebar-user {
      width: 100%;
      margin-top: auto;
    }

    .user-info-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 10px;
      border-radius: 8px;
      width: 100%;
      box-sizing: border-box;
    }

    .user-avatar {
      font-size: 20px;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .user-role {
      font-size: 11px;
      color: #64748b;
    }

    .logout-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 10px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #f87171;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 13px;
      font-weight: 500;
    }
    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .sidebar.collapsed .logout-btn {
      padding: 10px 0;
    }
    .sidebar.collapsed .logout-text {
      display: none;
    }

    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 13px;
    }
    .back-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
    }

    /* Mobile drawer overlay styling */
    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      z-index: 99;
    }
    .sidebar-overlay.visible {
      display: block;
    }

    .sidebar-close-btn {
      display: none;
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 20px;
      cursor: pointer;
    }

    .animate-fade-in {
      animation: fadeIn 0.2s ease-out forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-4px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @media (max-width: 1023px) {
      :host {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0 !important;
        z-index: 100;
      }
      .sidebar {
        position: fixed;
        left: -260px;
        top: 0;
        bottom: 0;
        width: 260px !important;
        transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 100;
        background: #0f172a !important;
      }
      .sidebar.open {
        left: 0;
      }
      .sidebar-close-btn {
        display: block;
      }
      .sidebar.collapsed {
        padding: 24px 16px;
        align-items: flex-start;
      }
      .sidebar.collapsed .sidebar-brand {
        justify-content: flex-start;
        gap: 12px;
      }
      .sidebar.collapsed .menu-item {
        justify-content: flex-start;
        padding: 12px;
      }
      .sidebar.collapsed .logout-btn {
        padding: 10px;
      }
      .sidebar.collapsed .logout-text {
        display: block;
      }
      .sidebar.collapsed .brand-text {
        display: block;
      }
      .sidebar.collapsed .menu-text {
        display: block;
      }
    }
  `
})
export class SidebarComponent {
  brandIcon = input<string>('📊');
  brandText = input<string>('Reporting Engine');
  showBackButton = input<boolean>(false);
  backButtonText = input<string>('← Cancel & Exit');
  collapsedBackButtonText = input<string>('✕');
  showUser = input<boolean>(false);
  mobileOpen = input<boolean>(false);

  mobileOpenChange = output<boolean>();
  backClick = output<void>();

  isManuallyExpanded = signal<boolean>(false);
  isHovered = signal<boolean>(false);

  isSidebarExpanded = computed(() => {
    return this.isManuallyExpanded() || this.isHovered();
  });

  constructor(private authService: AuthService, private router: Router) {}

  username = computed(() => this.authService.getUsername());

  onMouseEnter() {
    this.isHovered.set(true);
  }

  onMouseLeave() {
    this.isHovered.set(false);
  }

  toggleExpand() {
    this.isManuallyExpanded.update(v => !v);
  }

  closeMobileSidebar() {
    this.mobileOpenChange.emit(false);
  }

  handleBack() {
    this.backClick.emit();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
