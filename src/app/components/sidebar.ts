import { Component, ChangeDetectionStrategy, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';

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
    <div
      class="sidebar-overlay"
      [class.visible]="mobileOpen()"
      (click)="closeMobileSidebar()"
    ></div>

    <aside
      class="sidebar transition-all duration-300 ease-in-out"
      [class.collapsed]="!isSidebarExpanded()"
      [class.expanded]="isSidebarExpanded()"
      [class.open]="mobileOpen()"
    >
      <button
        class="sidebar-close-btn"
        (click)="closeMobileSidebar()"
        aria-label="Close navigation"
      >
        ✕
      </button>

      <div class="sidebar-brand">
        @if (isSidebarExpanded()) {
          <span class="brand-icon">
            @if (brandIcon() === '🛠️') {
              <svg
                class="icon-svg brand-logo-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            } @else if (brandIcon() === 'analytics-grid') {
              <div class="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm transition-transform duration-200 hover:scale-105">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" />
                  <path d="m5 17 4-4 4 4 6-6" stroke-width="2.5" class="text-indigo-500" />
                </svg>
              </div>
            } @else {
              <svg
                class="icon-svg brand-logo-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            }
          </span>
          <span class="brand-text animate-fade-in">{{ brandText() }}</span>
          <button
            class="menu-collapse-btn"
            (click)="toggleExpand()"
            title="Collapse Menu"
          >
            «
          </button>
        } @else {
          <button
            class="menu-collapse-btn-collapsed"
            (click)="toggleExpand()"
            title="Expand Menu"
          >
            ➔
          </button>
        }
      </div>

      <nav class="sidebar-menu">
        <a
          routerLink="/dashboard"
          routerLinkActive="active"
          class="menu-item"
          [title]="!isSidebarExpanded() ? 'Reports Catalog' : ''"
        >
          <span class="menu-icon">
            <svg
              class="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M2 10h20" />
              <path
                d="M22 14v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2 3h10a2 2 0 0 1 2 2Z"
              />
            </svg>
          </span>
          @if (isSidebarExpanded()) {
            <span class="menu-text animate-fade-in">Reports Catalog</span>
          }
        </a>
        <a
          routerLink="/viewer"
          routerLinkActive="active"
          class="menu-item"
          [title]="!isSidebarExpanded() ? 'Reports Execution Hub' : ''"
        >
          <span class="menu-icon">
            <svg
              class="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M9 9h6v6H9z" />
              <path d="M9 1v3" />
              <path d="M15 1v3" />
              <path d="M9 20v3" />
              <path d="M15 20v3" />
              <path d="M20 9h3" />
              <path d="M20 15h3" />
              <path d="M1 9h3" />
              <path d="M1 15h3" />
            </svg>
          </span>
          @if (isSidebarExpanded()) {
            <span class="menu-text animate-fade-in">Reports Execution Hub</span>
          }
        </a>
        <a
          routerLink="/semantic"
          routerLinkActive="active"
          class="menu-item"
          [title]="!isSidebarExpanded() ? 'Semantic Layer' : ''"
        >
          <span class="menu-icon">
            <svg
              class="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="16" y="16" width="6" height="6" rx="1" />
              <rect x="2" y="16" width="6" height="6" rx="1" />
              <rect x="9" y="2" width="6" height="6" rx="1" />
              <path d="M12 8v4" />
              <path d="M12 12H5v4" />
              <path d="M12 12h7v4" />
            </svg>
          </span>
          @if (isSidebarExpanded()) {
            <span class="menu-text animate-fade-in">Semantic Layer</span>
          }
        </a>
      </nav>

      <!-- Theme toggle -->
      <div class="theme-toggle-row">
        <button
          class="theme-toggle-btn-sidebar"
          (click)="themeService.toggle()"
          [title]="themeService.isLight() ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
          [attr.aria-label]="themeService.isLight() ? 'Switch to Dark Mode' : 'Switch to Light Mode'"
        >
          @if (themeService.isLight()) {
            <!-- Moon icon -->
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          } @else {
            <!-- Sun icon -->
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          }
          @if (isSidebarExpanded()) {
            <span class="theme-toggle-label animate-slide-left">
              {{ themeService.isLight() ? 'Dark Mode' : 'Light Mode' }}
            </span>
          }
        </button>
      </div>

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
              <div class="user-info animate-slide-left">
                <!-- User icon SVG -->
                <span class="user-avatar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <div class="user-details">
                  <span class="user-name">{{ username() }}</span>
                  <span class="user-role">Administrator</span>
                </div>
              </div>
            }
            <button (click)="logout()" class="logout-btn" [title]="'Sign Out'">
              <!-- Log out SVG -->
              <svg class="logout-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              @if (isSidebarExpanded()) {
                <span class="logout-text animate-slide-left">Sign Out</span>
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
      transition: width var(--transition-base, 300ms cubic-bezier(0.2, 0.8, 0.2, 1));
    }
    :host.collapsed { width: 64px; }
    :host.expanded  { width: 240px; }

    .sidebar {
      height: 100vh;
      width: 100%;
      background: var(--color-apple-bg, #0B1120);
      border-right: 1px solid var(--border-color, rgba(255,255,255,0.08));
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      backdrop-filter: blur(20px) saturate(180%);
      display: flex;
      flex-direction: column;
      padding: 20px 12px;
      gap: 24px;
      flex-shrink: 0;
      box-sizing: border-box;
    }

    .sidebar.collapsed {
      padding: 20px 8px;
      align-items: center;
    }

    /* Brand */
    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      height: 40px;
      padding-left: 4px;
    }
    .sidebar.collapsed .sidebar-brand {
      justify-content: center;
      padding-left: 0;
    }

    .brand-icon {
      flex-shrink: 0;
      color: var(--color-apple-blue, #0076DF);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-logo-icon {
      width: 22px;
      height: 22px;
      stroke-width: 2;
    }

    .brand-text {
      font-size: 15px;
      font-weight: 700;
      color: var(--color-apple-text, #F5F5F7);
      letter-spacing: -0.3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Tailwind utility classes for SVG frame */
    .w-10 { width: 2.5rem; }
    .h-10 { height: 2.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .bg-indigo-50 { background-color: rgba(79, 70, 229, 0.08); }
    .border-indigo-100 { border: 1px solid rgba(79, 70, 229, 0.2); }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .text-indigo-600 { color: #4f46e5; }
    .text-indigo-500 { color: #6366f1; }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .transition-transform { transition-property: transform; }
    .duration-200 { transition-duration: 200ms; }
    .hover\:scale-105:hover { transform: scale(1.05); }

    .brand-logo-icon {
      width: 22px;
      height: 22px;
      stroke-width: 2;
    }

    .brand-text {
      font-size: 15px;
      font-weight: 700;
      color: var(--color-apple-text, #F5F5F7);
      letter-spacing: -0.3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .menu-collapse-btn {
      background: var(--input-bg, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      color: var(--color-apple-grey, #94A3B8);
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      margin-left: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast, 150ms);
      min-width: 32px;
      min-height: 32px;
    }
    .menu-collapse-btn:hover {
      background: var(--card-bg, rgba(30,41,59,0.7));
      color: var(--color-apple-text, #F5F5F7);
    }

    .menu-collapse-btn-collapsed {
      background: var(--input-bg, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      color: var(--color-apple-grey, #94A3B8);
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast, 150ms);
      width: 36px;
      height: 36px;
      margin: 0 auto;
    }
    .menu-collapse-btn-collapsed:hover {
      background: var(--card-bg, rgba(30,41,59,0.7));
      color: var(--color-apple-text, #F5F5F7);
    }

    /* Nav menu */
    .sidebar-menu {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex-grow: 1;
      width: 100%;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      color: var(--color-apple-grey, #94A3B8);
      text-decoration: none;
      border-radius: 10px;
      transition: all var(--transition-fast, 150ms);
      height: 44px;
      box-sizing: border-box;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid transparent;
    }
    .menu-item:hover {
      background: var(--input-bg, rgba(255,255,255,0.04));
      color: var(--color-apple-text, #F5F5F7);
    }
    .menu-item.active {
      background: rgba(0, 118, 223, 0.12);
      color: var(--color-apple-blue, #0076DF);
      border-color: rgba(0, 118, 223, 0.20);
      font-weight: 600;
    }
    .sidebar.collapsed .menu-item {
      justify-content: center;
      padding: 10px 0;
    }

    /* Icons */
    .menu-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .icon-svg {
      width: 18px;
      height: 18px;
      stroke-width: 1.75;
      transition: transform var(--transition-fast, 150ms);
    }
    .menu-item:hover .icon-svg { transform: scale(1.08); }

    .menu-text { font-size: 13px; }

    /* Theme Toggle */
    .theme-toggle-row {
      width: 100%;
      padding: 0 0 8px 0;
    }

    .theme-toggle-btn-sidebar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      width: 100%;
      background: none;
      border: 1px solid transparent;
      border-radius: 10px;
      color: var(--color-apple-grey, #94A3B8);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      transition: all var(--transition-fast, 150ms);
      height: 44px;
      box-sizing: border-box;
    }
    .theme-toggle-btn-sidebar:hover {
      background: var(--input-bg, rgba(255,255,255,0.04));
      color: var(--color-apple-text, #F5F5F7);
      border-color: transparent;
    }
    .sidebar.collapsed .theme-toggle-btn-sidebar {
      justify-content: center;
      padding: 10px 0;
    }
    .theme-toggle-label {
      font-size: 13px;
    }

    /* User section */
    .sidebar-user {
      width: 100%;
      margin-top: auto;
    }

    .user-info-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--input-bg, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      padding: 10px 12px;
      border-radius: 10px;
      width: 100%;
      box-sizing: border-box;
    }

    .user-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: rgba(0,118,223,0.15);
      border-radius: 50%;
      color: var(--color-apple-blue, #0076DF);
      flex-shrink: 0;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-apple-text, #F5F5F7);
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .user-role {
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-apple-grey, #94A3B8);
    }

    .logout-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 10px 12px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.18);
      color: #f87171;
      border-radius: 10px;
      cursor: pointer;
      transition: all var(--transition-fast, 150ms);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.16);
      color: #ef4444;
    }
    .sidebar.collapsed .logout-btn {
      padding: 10px 0;
    }
    .sidebar.collapsed .logout-text { display: none; }

    .logout-icon {
      flex-shrink: 0;
    }

    /* Back button */
    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 10px 12px;
      background: var(--input-bg, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      color: var(--color-apple-grey, #94A3B8);
      border-radius: 10px;
      cursor: pointer;
      transition: all var(--transition-fast, 150ms);
      font-size: 12px;
      font-weight: 500;
    }
    .back-btn:hover {
      background: var(--card-bg, rgba(30,41,59,0.7));
      color: var(--color-apple-text, #F5F5F7);
    }

    /* Mobile overlay */
    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.55);
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
      z-index: 99;
    }
    .sidebar-overlay.visible { display: block; }

    .sidebar-close-btn {
      display: none;
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--input-bg, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      color: var(--color-apple-grey, #94A3B8);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      display: none;
      align-items: center;
      justify-content: center;
    }

    .animate-fade-in   { animation: fadeIn   0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .animate-slide-left { animation: slideInLeft 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    @media (max-width: 1023px) {
      :host {
        position: fixed;
        left: 0; top: 0; bottom: 0;
        width: 0 !important;
        z-index: 100;
      }
      .sidebar {
        position: fixed;
        left: -260px; top: 0; bottom: 0;
        width: 260px !important;
        transition: left var(--transition-base, 300ms cubic-bezier(0.2, 0.8, 0.2, 1));
        z-index: 100;
        background: var(--color-apple-bg, #0B1120) !important;
      }
      .sidebar.open { left: 0; }
      .sidebar-close-btn { display: flex; }
      .sidebar.collapsed {
        padding: 20px 12px;
        align-items: flex-start;
      }
      .sidebar.collapsed .sidebar-brand { justify-content: flex-start; gap: 10px; }
      .sidebar.collapsed .menu-item { justify-content: flex-start; padding: 10px 12px; }
      .sidebar.collapsed .logout-btn { padding: 10px 12px; }
      .sidebar.collapsed .logout-text { display: block; }
      .sidebar.collapsed .brand-text { display: block; }
      .sidebar.collapsed .menu-text  { display: block; }
    }
  `,
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

  isSidebarExpanded = signal<boolean>(false);

  constructor(
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService,
  ) {}

  username = computed(() => this.authService.getUsername());

  toggleExpand() {
    this.isSidebarExpanded.update((v) => !v);
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
