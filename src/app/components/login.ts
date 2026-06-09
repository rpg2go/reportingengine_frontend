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
  templateUrl: './login.html',
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

    .login-footer {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #64748b;
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
