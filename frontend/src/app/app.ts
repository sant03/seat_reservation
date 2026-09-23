import { Component, inject, signal, effect } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { StateService } from './services/state.service';

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatSnackBarModule,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private state = inject(StateService);
  private snack = inject(MatSnackBar);
  private router = inject(Router);

  readonly dirty = this.state.dirty;
  readonly saving = this.state.saving;
  readonly loading = this.state.loading;

  readonly navOpen = signal(false);
  readonly mobile = signal(window.innerWidth < 1024);

  readonly toastStage = signal<'hidden' | 'expanded' | 'collapsed'>('hidden');
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const onResize = () => this.mobile.set(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.navOpen.set(false);
      }
    });
    effect(() => {
      const d = this.dirty();
      if (!d) {
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastStage.set('hidden');
        return;
      }
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastStage.set('expanded');
      if (this.mobile()) {
        this.toastTimer = setTimeout(() => this.toastStage.set('collapsed'), 2000);
      }
    });
  }

  collapseToast(): void {
    this.toastStage.set('collapsed');
  }

  toggleNav(): void {
    this.navOpen.update((v) => !v);
  }

  navClick(): void {
    if (this.mobile()) this.navOpen.set(false);
  }

  async guardar(): Promise<void> {
    const res = await this.state.save();
    if (res.ok) this.snack.open('Cambios guardados en el Excel ✔', 'OK', { duration: 2500 });
    else this.snack.open('Error: ' + (res.error || 'desconocido'), 'Cerrar');
  }

  exportar(): void {
    window.open(this.state.exportUrl(), '_blank');
  }
}