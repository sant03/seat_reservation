import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StateService } from '../services/state.service';
import { Reserva, ESTADO_LABELS, DiaKey } from '../models';
import { computeTotales, deriveGlobalEstado, fmtMoney, stateLabel, initials, avatarColor, chipClass } from '../utils';
import { ReservaForm, ReservaFormResult } from '../reserva-form/reserva-form';

interface Row {
  persona: Reserva;
}

@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    FormsModule,
  ],
  selector: 'app-reservas',
  templateUrl: './reservas.html',
  styleUrl: './reservas.css'
})
export class Reservas {
  private state = inject(StateService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private router = inject(Router);

  readonly loading = this.state.loading;
  readonly error = this.state.error;

  readonly filtro = signal('');
  readonly filtroEstado = signal('TODOS');
  readonly filtroDia = signal<'TODOS' | DiaKey>('TODOS');
  readonly vista = signal<'tarjetas' | 'tabla'>('tarjetas');
  readonly mobile = signal(window.innerWidth < 1024);
  readonly vistaEfectiva = computed(() => (this.mobile() ? 'tarjetas' : this.vista()));

  constructor() {
    window.addEventListener('resize', () => this.mobile.set(window.innerWidth < 1024));
  }

  readonly displayedColumns = computed<string[]>(() => [
    'nombre',
    ...this.diasVisibles().map((d) => d.key),
    'total',
    'estado',
    'acciones'
  ]);

  readonly diasVisibles = computed(() => {
    const dk = this.filtroDia();
    return dk === 'TODOS' ? this.colDias : this.colDias.filter((d) => d.key === dk);
  });

  readonly model = this.state.model;

  readonly rows = computed<Row[]>(() => {
    const m = this.model();
    if (!m) return [];
    const f = this.filtro().toLowerCase().trim();
    const es = this.filtroEstado();
    const dk = this.filtroDia();
    const porDia = dk !== 'TODOS';
    return m.reservas
      .filter((p) => {
        const okName = !f || p.nombre.toLowerCase().includes(f);
        if (!okName) return false;
        const okDia = !porDia || p[dk].puestos > 0;
        if (!okDia) return false;
        if (es === 'TODOS') return true;
        const state = porDia ? p[dk].estado : p.estadoGlobal;
        return state === es;
      })
      .map((persona) => ({ persona }));
  });

  estadoDe(p: Reserva): string {
    const dk = this.filtroDia();
    return dk === 'TODOS' ? p.estadoGlobal : p[dk].estado;
  }

  totalDe(p: Reserva): number {
    const dk = this.filtroDia();
    return dk === 'TODOS' ? p.total : p[dk].total;
  }

  readonly contador = computed(() => {
    const m = this.model();
    const t = this.rows().length;
    return m ? `${t} de ${m.reservas.length} personas` : '';
  });

  readonly estados = computed(() => this.model()?.totales.porDia ? Object.keys(ESTADO_LABELS) : []);

  readonly colDias: { key: DiaKey; name: string }[] = [
    { key: 'dia1', name: 'Día 1' },
    { key: 'dia2', name: 'Día 2' },
    { key: 'dia3', name: 'Día 3' }
  ];

  nueva(): void {
    const m = this.model();
    if (!m) return;
    const disponibilidad = this.availability();
    if (this.mobile()) {
      this.router.navigate(['/reserva'], {
        state: { data: { persona: null, config: m.config, disponibilidadPorDia: disponibilidad } }
      });
      return;
    }
    const ref = this.dialog.open(ReservaForm, {
      width: '620px',
      data: {
        persona: null,
        config: m.config,
        disponibilidadPorDia: disponibilidad
      }
    });
    ref.afterClosed().subscribe(async (res: ReservaFormResult | undefined) => {
      if (!res) return;
      await this.state.addReserva(this.buildPerson(res, undefined));
      this.snack.open('Reserva agregada. Recuerda guardar.', 'OK', { duration: 2500 });
    });
  }

  editar(persona: Reserva): void {
    const m = this.model();
    if (!m) return;
    if (this.mobile()) {
      this.router.navigate(['/reserva'], {
        state: { data: { persona, config: m.config, disponibilidadPorDia: this.availability(persona) } }
      });
      return;
    }
    const ref = this.dialog.open(ReservaForm, {
      width: '620px',
      data: {
        persona,
        config: m.config,
        disponibilidadPorDia: this.availability(persona)
      }
    });
    ref.afterClosed().subscribe((res: ReservaFormResult | undefined) => {
      if (!res) return;
      this.state.updateReserva(persona.id, this.buildPerson(res, persona.id));
    });
  }

  eliminar(persona: Reserva): void {
    if (!window.confirm(`¿Eliminar a "${persona.nombre}"?`)) return;
    this.state.removeReserva(persona.id);
  }

  // Slots libres por dia considerando las demas reservas (o todas si se edita la misma).
  private availability(excluir?: Reserva): Record<DiaKey, number> {
    const m = this.model();
    if (!m) return { dia1: 0, dia2: 0, dia3: 0 };
    const res = computeTotales(
      m.reservas.filter((p) => !excluir || p.id !== excluir.id),
      m.config
    );
    return {
      dia1: Math.max(0, m.config.capacidadBus - res.porDia.dia1.puestos),
      dia2: Math.max(0, m.config.capacidadBus - res.porDia.dia2.puestos),
      dia3: Math.max(0, m.config.capacidadBus - res.porDia.dia3.puestos)
    };
  }

  private buildPerson(res: ReservaFormResult, id: string | undefined): Reserva {
    const persona: Reserva = {
      ...(id ? { id } : {}),
      nombre: res.nombre,
      dia1: res.dia1,
      dia2: res.dia2,
      dia3: res.dia3,
      total: res.dia1.total + res.dia2.total + res.dia3.total,
      estadoGlobal: deriveGlobalEstado(res as unknown as Reserva) as Reserva['estadoGlobal'],
      valorPagado: res.dia1.pagado + res.dia2.pagado + res.dia3.pagado,
      valorPendiente: 0,
      comentarios: res.comentarios
    };
    persona.valorPendiente = Math.max(0, persona.total - persona.valorPagado);
    return persona;
  }

  diaState(estado: string): string {
    return stateLabel(estado);
  }

  coinClass(estado: string): string {
    return chipClass(estado);
  }

  avInitials(nombre: string): string {
    return initials(nombre);
  }

  avColor(nombre: string): string {
    return avatarColor(nombre);
  }

  money(n: number): string {
    return fmtMoney(n);
  }
}