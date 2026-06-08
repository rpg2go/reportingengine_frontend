import { Component, signal, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="login-container">
      <!-- Ambient glow blobs -->
      <div class="glow-blob glow-top-left"></div>
      <div class="glow-blob glow-bottom-right"></div>

      <div class="glass-card animate-fade-in">
        <!-- Logo + Title -->
        <div class="header-logo">
          <div class="logo-circle">
            <!-- Bar chart SVG icon -->
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                 stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
          </div>
          <h1 class="text-gradient">Reporting Engine</h1>
          <p class="subtitle">Secure Analytics Gateway</p>
        </div>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="login-form">
          <!-- Username field -->
          <div class="form-group">
            <label for="username" class="field-label">Identity</label>
            <div class="input-wrapper input-glow">
              <span class="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                type="text"
                id="username"
                name="username"
                class="input-field input-with-icon"
                [(ngModel)]="username"
                required
                autocomplete="username"
                placeholder="Enter username"
                #usernameInput="ngModel"
              />
            </div>
          </div>

          <!-- Password field -->
          <div class="form-group">
            <label for="password" class="field-label">Security Key</label>
            <div class="input-wrapper input-glow">
              <span class="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type="password"
                id="password"
                name="password"
                class="input-field input-with-icon"
                [(ngModel)]="password"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                #passwordInput="ngModel"
              />
            </div>
          </div>

          <!-- Error message -->
          @if (errorMessage()) {
            <div class="alert alert-error animate-fade-in" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <!-- Submit button -->
          <button
            type="submit"
            class="btn-primary submit-btn"
            [disabled]="loading() || !loginForm.valid"
            [attr.aria-busy]="loading()"
          >
            @if (loading()) {
              <span class="spinner"></span>
              <span>Verifying...</span>
            } @else {
              <span>Enter Portal</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            }
          </button>
        </form>

        <!-- Footer -->
        <div class="login-footer">
          <div class="footer-powered">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span>Powered by Intelligent Orchestration</span>
          </div>
          <p class="footer-copy">© 2026 Reporting Engine Platform</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --color-apple-bg: #000000;
      --card-bg: rgba(28, 28, 30, 0.7);
      --border-color: rgba(255, 255, 255, 0.1);
      --color-apple-blue: #0071e3;
      --color-apple-grey: #86868b;
      --transition-base: 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      --transition-slow: 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
      --transition-fast: 0.2s ease;
      --shadow-card: 0 20px 60px rgba(0,0,0,0.5);
    }

    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: var(--color-apple-bg);
      padding: 20px;
      position: relative;
      overflow: hidden;
    }

    /* Ambient glow blobs */
    .glow-blob {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .glow-top-left {
      top: -10%;
      left: -10%;
      width: 40%;
      height: 40%;
      background: rgba(0, 118, 223, 0.08);
      filter: blur(100px);
    }
    .glow-bottom-right {
      bottom: -10%;
      right: -10%;
      width: 40%;
      height: 40%;
      background: rgba(0, 118, 223, 0.06);
      filter: blur(120px);
    }

    /* Glass card */
    .glass-card {
      background: var(--card-bg);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid var(--border-color);
      border-radius: 32px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: var(--shadow-card);
      z-index: 10;
      transition: all var(--transition-slow);
    }

    /* Header / logo */
    .header-logo {
      text-align: center;
      margin-bottom: 36px;
    }

    .logo-circle {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: 64px;
      height: 64px;
      background: var(--color-apple-blue);
      border-radius: 18px;
      margin-bottom: 20px;
      box-shadow: 0 0 32px rgba(0, 118, 223, 0.4);
      transition: transform var(--transition-base);
    }
    .logo-circle:hover { transform: scale(1.05); }

    h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 6px 0;
      letter-spacing: -0.5px;
      color: #fff;
    }

    .subtitle {
      color: var(--color-apple-grey);
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin: 0;
    }

    /* Form */
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .field-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-apple-grey);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      padding-left: 2px;
    }

    .input-wrapper {
      position: relative;
      border-radius: 14px;
    }

    .input-icon {
      position: absolute;
      left: 14px;
      padding: 14px 14px 14px 44px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #f8fafc;
      font-size: 15px;
      outline: none;
      transition: all 0.2s ease;
    }

    input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
      background: rgba(15, 23, 42, 0.8);
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 10px;
      padding: 12px;
    }

    .error-icon {
      font-size: 18px;
      color: #ef4444;
    }

    .error-text {
      font-size: 13px;
      color: #fca5a5;
    }

    .submit-btn {
      padding: 14px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      transition: all 0.2s ease;
    }

    .submit-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
      transform: translateY(-1px);
    }

    .submit-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .login-footer {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #64748b;
    }

    code {
      background: rgba(15, 23, 42, 0.8);
      padding: 2px 6px;
      border-radius: 4px;
      color: #a855f7;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate-fade-in {
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @media (max-width: 767px) {
      .login-container {
        padding: 16px;
        align-items: flex-start;
        padding-top: 60px;
      }
      .glass-card {
        padding: 28px 20px;
        border-radius: 16px;
      }
      h1 {
        font-size: 22px;
      }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
    if (!this.username || !this.password) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.username, this.password).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Invalid username or password. Please try again.');
      }
    });
  }
}
