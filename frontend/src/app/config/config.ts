import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { StateService } from '../services/state.service';
import { CommitInfo } from '../models';
import { fmtMoney, fmtFecha } from '../utils';

@Component({
  imports: [MatButtonModule, MatIconModule, MatListModule, MatCardModule, FormsModule],
  selector: 'app-config',
  templateUrl: './config.html',
  styleUrl: './config.css'
})
export class ConfigPage implements OnInit {
  state = inject(StateService);
  private snack = inject(MatSnackBar);
  readonly fmtMoney = fmtMoney;

  ngOnInit(): void {
    this.state.loadHistory();
  }

  readonly model = this.state.model;
  readonly dirty = this.state.dirty;
  readonly saving = this.state.saving;
  readonly lastSha = this.state.lastSha;
  readonly history = this.state.history;

  readonly eventoNombre = signal('');
  readonly capacidad = signal<string>('');
  readonly valor = signal<string>('');
  readonly fecha1 = signal<string>('');
  readonly fecha2 = signal<string>('');
  readonly fecha3 = signal<string>('');
  readonly tareas = signal<string>('');

  readonly valores = computed(() => {
    const m = this.model();
    if (!m) return null;
    return {
      capacidad: m.config.capacidadBus,
      valor: m.config.valorPuesto,
      fecha1: m.config.fechaDia1,
      fecha2: m.config.fechaDia2,
      fecha3: m.config.fechaDia3
    };
  });

  private syncDone = false;
  private sync = effect(() => {
    const m = this.model();
    if (!m) return;
    if (this.syncDone || this.dirty()) return;
    this.syncDone = true;
    this.eventoNombre.set(m.config.eventoNombre || 'Asamblea de Circuito');
    this.capacidad.set(String(m.config.capacidadBus ?? ''));
    this.valor.set(String(m.config.valorPuesto ?? ''));
    this.fecha1.set(m.config.fechaDia1 || '');
    this.fecha2.set(m.config.fechaDia2 || '');
    this.fecha3.set(m.config.fechaDia3 || '');
    this.tareas.set((m.tareas || []).join('\n'));
  });

  private parseTareas(): string[] {
    return this.tareas()
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t !== '');
  }

  aplicar(): void {
    const nombre = this.eventoNombre().trim();
    if (!nombre) {
      this.snack.open('El nombre del evento no puede estar vacío.', 'OK');
      return;
    }
    const cap = Math.round(Number(this.capacidad()));
    const val = Math.round(Number(this.valor()));
    if (!cap || cap <= 0) {
      this.snack.open('La capacidad debe ser un número mayor que 0.', 'OK');
      return;
    }
    if (!val || val <= 0) {
      this.snack.open('El valor del cupo debe ser mayor que 0.', 'OK');
      return;
    }
    this.state.updateConfig({
      eventoNombre: nombre,
      capacidadBus: cap,
      valorPuesto: val,
      fechaDia1: this.fecha1() || '2026-05-24',
      fechaDia2: this.fecha2() || '2026-05-25',
      fechaDia3: this.fecha3() || '2026-05-26'
    });
    this.state.setTareas(this.parseTareas());
    this.snack.open('Configuración actualizada (aún sin guardar).', 'OK', { duration: 2500 });
  }

  async resetDatabase(): Promise<void> {
    const nombre = this.eventoNombre().trim() || 'Asamblea de Circuito';
    const confirmed = window.confirm(
      '¿Estás seguro de reiniciar el sistema?\n\n' +
      'Esto ELIMINARÁ todas las reservas actuales y dejará la base de datos en blanco.\n' +
      'El nombre del evento será: "' + nombre + '"\n\n' +
      'Esta acción NO se puede deshacer.'
    );
    if (!confirmed) return;

    const confirmedAgain = window.confirm(
      'ÚLTIMA CONFIRMACIÓN:\n\n' +
      'Se borrarán TODOS los datos de reservas.\n' +
      '¿Continuar?'
    );
    if (!confirmedAgain) return;

    const res = await this.state.resetDatabase(nombre);
    if (res.ok) {
      this.syncDone = false;
      this.snack.open('Base de datos reiniciada. Listo para un nuevo evento.', 'OK', { duration: 4000 });
    } else {
      this.snack.open('Error: ' + (res.error || 'desconocido'), 'Cerrar');
    }
  }

  fmtFecha(iso: string): string {
    return fmtFecha(iso);
  }

  commitDate(c: CommitInfo): string {
    if (!c.date) return '';
    const d = new Date(c.date);
    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  async restaurar(sha: string): Promise<void> {
    if (!window.confirm('¿Cargar esta versión anterior? Después de cargarla deberás guardar para volverla la actual (se creará un commit nuevo).')) return;
    const version = await this.state.getVersion(sha);
    if (!version) {
      this.snack.open('No se pudo leer esa versión.', 'OK');
      return;
    }
    (this.state).restoreVersion(version);
    this.snack.open('Versión cargada. Revisa y guarda para publicarla.', 'OK', { duration: 3000 });
  }

  clearError(): void {
    this.state.setError(null);
  }
}