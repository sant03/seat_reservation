import { Injectable, signal } from '@angular/core';

const KEY = 'reserva-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(localStorage.getItem(KEY) === 'dark');

  constructor() {
    this.apply(this.dark());
  }

  toggle(): void {
    this.dark.update((v) => !v);
    this.apply(this.dark());
    localStorage.setItem(KEY, this.dark() ? 'dark' : 'light');
  }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
  }
}