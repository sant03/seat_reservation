import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { CommitInfo, Config, Model, Reserva, Totales } from '../models';
import { computeTotales } from '../utils';

@Injectable({ providedIn: 'root' })
export class StateService {
  private api = inject(ApiService);

  private _model = signal<Model | null>(null);
  private _loading = signal(false);
  private _saving = signal(false);
  private _dirty = signal(false);
  private _error = signal<string | null>(null);
  private _lastSha = signal<string | null>(null);
  private _history = signal<CommitInfo[]>([]);

  readonly model = this._model.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly dirty = this._dirty.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastSha = this._lastSha.asReadonly();
  readonly history = this._history.asReadonly();

  constructor() {
    this.load();
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const model = await firstValueFrom(this.api.getModel());
      this._model.set(model);
      this._lastSha.set((model as any).sha || null);
      this._dirty.set(false);
    } catch (e: any) {
      this._error.set(e.message || 'No se pudo cargar el modelo.');
    } finally {
      this._loading.set(false);
    }
  }

  private patch(next: Partial<Model>) {
    const m = this._model();
    if (!m) return;
    this._model.set({ ...m, ...next });
    this._dirty.set(true);
  }

  async addReserva(person: Reserva): Promise<void> {
    const m = this._model();
    if (!m) return;
    this.patch({ reservas: [...m.reservas, person] });
    await this.recompute();
  }

  updateReserva(id: string | undefined, person: Reserva): void {
    const m = this._model();
    if (!m) return;
    this.patch({
      reservas: m.reservas.map((p) => (p.id === id ? person : p))
    });
    this.recompute();
  }

  removeReserva(id: string | undefined): void {
    const m = this._model();
    if (!m) return;
    this.patch({ reservas: m.reservas.filter((p) => p.id !== id) });
    this.recompute();
  }

  updateConfig(partial: Partial<Config>): void {
    const m = this._model();
    if (!m) return;
    this.patch({ config: { ...m.config, ...partial } });
    this.recompute();
  }

  setTareas(tareas: string[]): void {
    this.patch({ tareas });
  }

  private async recompute(): Promise<void> {
    const m = this._model();
    if (!m) return;
    const totales: Totales = computeTotales(m.reservas, m.config);
    this._model.set({ ...m, totales });
  }

  async save(): Promise<{ ok: boolean; error?: string }> {
    if (this._saving()) return { ok: false };
    const m = this._model();
    if (!m) return { ok: false, error: 'Sin datos para guardar.' };
    this._saving.set(true);
    this._error.set(null);
    try {
      const res = await firstValueFrom(this.api.saveModel(m));
      this._lastSha.set(res.sha || null);
      this._dirty.set(false);
      await this.recompute();
      await this.loadHistory();
      return { ok: true };
    } catch (e: any) {
      this._error.set(e.message || 'Error al guardar.');
      return { ok: false, error: e.message };
    } finally {
      this._saving.set(false);
    }
  }

  async loadHistory(): Promise<void> {
    try {
      this._history.set(await firstValueFrom(this.api.getHistory()));
    } catch {
      this._history.set([]);
    }
  }

  async getVersion(sha: string): Promise<Model | null> {
    try {
      return await firstValueFrom(this.api.getModelAt(sha));
    } catch {
      return null;
    }
  }

  restoreVersion(version: Model): void {
    const current = this._model();
    if (!current) return;
    this._model.set({
      config: version.config,
      reservas: version.reservas,
      tareas: version.tareas,
      totales: version.totales || computeTotales(version.reservas, version.config)
    });
    this._dirty.set(true);
  }

  async resetDatabase(eventoNombre: string): Promise<{ ok: boolean; error?: string }> {
    if (this._saving()) return { ok: false };
    this._saving.set(true);
    this._error.set(null);
    try {
      const res = await firstValueFrom(this.api.resetModel(eventoNombre));
      this._lastSha.set(res.sha || null);
      this._dirty.set(false);
      await this.load();
      await this.loadHistory();
      return { ok: true };
    } catch (e: any) {
      this._error.set(e.message || 'Error al reiniciar.');
      return { ok: false, error: e.message };
    } finally {
      this._saving.set(false);
    }
  }

  exportUrl(): string {
    return this.api.exportUrl();
  }

  setError(msg: string | null): void {
    this._error.set(msg);
  }
}