import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { Config, DiaKey, DIA_KEYS, DiaReserva, ESTADOS, ESTADO_LABELS, Reserva } from '../models';
import { deriveGlobalEstado, fmtMoney } from '../utils';
import { StateService } from '../services/state.service';

export interface ReservaFormData {
  persona: any | null;
  config: Config;
  disponibilidadPorDia: Record<DiaKey, number>;
}

export interface ReservaFormResult {
  nombre: string;
  dia1: DiaReserva;
  dia2: DiaReserva;
  dia3: DiaReserva;
  comentarios?: string;
}

interface DayForm {
  puestos: number;
  estado: string;
  pagado: number;
}

@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    FormsModule
  ],
  selector: 'app-reserva-form',
  templateUrl: './reserva-form.html',
  styleUrl: './reserva-form.css'
})
export class ReservaForm {
  readonly ESTADOS = ESTADOS;
  readonly ESTADO_LABELS = ESTADO_LABELS;
  readonly DIA = DIA_KEYS.map((k, i) => ({ key: k, name: `Día ${i + 1}` }));
  readonly fmtMoney = fmtMoney;

  private dialogRef = inject(MatDialogRef<ReservaForm>, { optional: true }) ?? null;
  private dialogData = inject<ReservaFormData | null>(MAT_DIALOG_DATA, { optional: true }) ?? null;
  private loc = inject(Location);
  private router = inject(Router);
  private state = inject(StateService);
  private snack = inject(MatSnackBar);

  readonly esPagina = computed(() => !this.dialogRef);

  get data(): ReservaFormData {
    if (this.dialogData) return this.dialogData;
    const st = (this.loc.getState() as any)?.data as ReservaFormData | null;
    if (st) return st;
    const m = this.state.model();
    const config = m?.config ?? ({} as Config);
    const cap = config.capacidadBus ?? 0;
    return {
      persona: null,
      config,
      disponibilidadPorDia: { dia1: cap, dia2: cap, dia3: cap }
    };
  }

  nombre = signal('');
  comentarios = signal('');
  dias = signal<Record<DiaKey, DayForm>>({
    dia1: { puestos: 0, estado: 'PENDIENTE', pagado: 0 },
    dia2: { puestos: 0, estado: 'PENDIENTE', pagado: 0 },
    dia3: { puestos: 0, estado: 'PENDIENTE', pagado: 0 }
  });

  readonly valor = computed(() => this.data.config.valorPuesto);
  readonly capacidad = computed(() => this.data.config.capacidadBus);

  readonly totalDia = computed(() => {
    const out = {} as Record<DiaKey, { total: number; pendiente: number }>;
    for (const k of DIA_KEYS) {
      const d = this.dias()[k];
      const puestos = Math.max(0, Math.round(Number(d.puestos) || 0));
      const total = puestos * this.valor();
      const pagado = Math.max(0, Math.round(Number(d.pagado) || 0));
      let pendiente: number;
      if (d.estado === 'PENDIENTE') pendiente = total;
      else if (d.estado === 'CANCELADO') pendiente = 0;
      else pendiente = Math.max(0, total - pagado);
      out[k] = { total, pendiente };
    }
    return out;
  });

  readonly totalGeneral = computed(() => DIA_KEYS.reduce((s, k) => s + this.totalDia()[k].total, 0));

  readonly pagadoGeneral = computed(() => {
    let sum = 0;
    for (const k of DIA_KEYS) {
      const d = this.dias()[k];
      const puestos = Math.max(0, Math.round(Number(d.puestos) || 0));
      const total = puestos * this.valor();
      if (d.estado === 'PAGADO') sum += total;
      else if (d.estado === 'ABONO') sum += Math.max(0, Math.round(Number(d.pagado) || 0));
      else sum += 0;
    }
    return sum;
  });

  readonly errores = computed(() => {
    const errs: string[] = [];
    for (const k of DIA_KEYS) {
      const d = this.dias()[k];
      const puestos = Math.max(0, Math.round(Number(d.puestos) || 0));
      if (d.estado !== 'CANCELADO') {
        const disp = this.data.disponibilidadPorDia[k];
        if (puestos > disp) {
          errs.push(`Día ${k === 'dia1' ? 1 : k === 'dia2' ? 2 : 3}: ${puestos} puestos pero solo hay ${disp} libres.`);
        }
      }
    }
    return errs;
  });

  readonly disponibilidadText = computed(() => {
    const d = this.data.disponibilidadPorDia;
    return `Cupos libres: Día 1 → ${d.dia1}, Día 2 → ${d.dia2}, Día 3 → ${d.dia3}`;
  });

  constructor() {
    const persona = this.data.persona;
    if (persona) {
      this.nombre.set(persona.nombre || '');
      this.comentarios.set(persona.comentarios || '');
      this.dias.set({
        dia1: this.fromDay(persona.dia1),
        dia2: this.fromDay(persona.dia2),
        dia3: this.fromDay(persona.dia3)
      });
    } else {
      this.nombre.set('');
      this.dias.set({
        dia1: { puestos: 0, estado: 'PENDIENTE', pagado: 0 },
        dia2: { puestos: 0, estado: 'PENDIENTE', pagado: 0 },
        dia3: { puestos: 0, estado: 'PENDIENTE', pagado: 0 }
      });
    }
  }

  private fromDay(d: any): DayForm {
    return {
      puestos: d?.puestos ?? 0,
      estado: d?.estado ?? 'PENDIENTE',
      pagado: d?.pagado ?? 0
    };
  }

  setDia(k: DiaKey, patch: Partial<DayForm>): void {
    this.dias.set({ ...this.dias(), [k]: { ...this.dias()[k], ...patch } });
  }

  onEstadoChange(k: DiaKey, estado: string): void {
    const d = this.dias()[k];
    const puestos = Math.max(0, Math.round(Number(d.puestos) || 0));
    const total = puestos * this.valor();
    let pagado = d.pagado;
    if (estado === 'PAGADO') pagado = total;
    else if (estado === 'PENDIENTE') pagado = 0;
    else if (estado === 'CANCELADO') pagado = 0;
    this.setDia(k, { estado, pagado });
  }

  onPuestosChange(k: DiaKey, value: number): void {
    const d = this.dias()[k];
    const puestos = Math.max(0, Math.round(Number(value) || 0));
    const total = puestos * this.valor();
    let pagado = d.pagado;
    if (d.estado === 'PAGADO') pagado = total;
    if (pagado > total) pagado = total;
    this.setDia(k, { puestos, pagado });
  }

  result(): ReservaFormResult {
    const v = this.valor();
    const mk = (d: DayForm, k: DiaKey): DiaReserva => {
      const puestos = Math.max(0, Math.round(Number(d.puestos) || 0));
      const total = puestos * v;
      let pagado = Math.max(0, Math.round(Number(d.pagado) || 0));
      if (d.estado === 'PAGADO') pagado = total;
      else if (d.estado === 'PENDIENTE' || d.estado === 'CANCELADO') pagado = 0;
      const pendiente = d.estado === 'CANCELADO' ? 0 : Math.max(0, total - pagado);
      void k;
      return { puestos, total, estado: d.estado as DiaReserva['estado'], pagado, pendiente };
    };
    return {
      nombre: this.nombre().trim(),
      dia1: mk(this.dias().dia1, 'dia1'),
      dia2: mk(this.dias().dia2, 'dia2'),
      dia3: mk(this.dias().dia3, 'dia3'),
      comentarios: this.comentarios().trim()
    };
  }

  cerrar(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
      return;
    }
    this.router.navigate(['/dashboard']);
  }

  aceptar(): void {
    if (this.errores().length) return;
    if (!this.nombre().trim()) {
      this.nombre.set('');
      return;
    }
    const res = this.result();
    if (this.dialogRef) {
      this.dialogRef.close(res);
      return;
    }
    const persona = this.build(res, this.data.persona?.id);
    if (this.data.persona) this.state.updateReserva(this.data.persona.id, persona);
    else this.state.addReserva(persona);
    this.snack.open('Reserva guardada. Recuerda guardar en el Excel.', 'OK', { duration: 2500 });
    this.router.navigate(['/dashboard']);
  }

  private build(res: ReservaFormResult, id: string | undefined): Reserva {
    const before = this.data.persona;
    const mkDia = (d: DiaReserva, k: DiaKey): DiaReserva => ({
      ...d,
      asistencia: before?.[k]?.asistencia
    });
    const persona: Reserva = {
      ...(id ? { id } : {}),
      nombre: res.nombre,
      dia1: mkDia(res.dia1, 'dia1'),
      dia2: mkDia(res.dia2, 'dia2'),
      dia3: mkDia(res.dia3, 'dia3'),
      total: res.dia1.total + res.dia2.total + res.dia3.total,
      estadoGlobal: deriveGlobalEstado(res as unknown as Reserva) as Reserva['estadoGlobal'],
      valorPagado: res.dia1.pagado + res.dia2.pagado + res.dia3.pagado,
      valorPendiente: 0,
      comentarios: res.comentarios
    };
    persona.valorPendiente = Math.max(0, persona.total - persona.valorPagado);
    return persona;
  }
}