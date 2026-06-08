import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 're-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** true = light, false = dark */
  isLight = signal<boolean>(this._readInitial());

  private _readInitial(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'light';
    } catch {}
    // Default: light theme
    return true;
  }

  constructor() {
    // Apply initial theme without waiting for first toggle
    this._apply(this.isLight());
  }

  toggle(): void {
    const next = !this.isLight();
    this.isLight.set(next);
    this._apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'light' : 'dark');
    } catch {}
  }

  private _apply(light: boolean): void {
    if (light) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }
}
