import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { StateService } from '../services/state.service';
import { Reserva, DiaKey } from '../models';
import { fmtFecha, initials, avatarColor } from '../utils';

@Component({
  imports: [MatButtonModule, MatIconModule, MatCheckboxModule, MatCardModule, MatDividerModule],
  selector: 'app-asistencia',
  templateUrl: './asistencia.html',
  styleUrl: './asistencia.css'
})
export class AsistenciaPage {
  state = inject(StateService);

  readonly model = this.state.model;

  readonly diaSel = signal<DiaKey>('dia1');
  readonly filtro = signal('');
  readonly filtroPendiente = signal<'TODOS' | 'ida' | 'venida'>('TODOS');

  private expandidaId = signal<string | null>(null);

  isExpandida(reserva: Reserva): boolean {
    return this.expandidaId() === (reserva.id ?? reserva.nombre);
  }

  toggleCard(reserva: Reserva): void {
    const key = reserva.id ?? reserva.nombre;
    this.expandidaId.update((cur) => (cur === key ? null : key));
  }

  avIniciales(nombre: string): string {
    return initials(nombre);
  }

  avColor(nombre: string): string {
    return avatarColor(nombre);
  }

  readonly dias: { key: DiaKey; name: string }[] = [
    { key: 'dia1', name: 'Día 1' },
    { key: 'dia2', name: 'Día 2' },
    { key: 'dia3', name: 'Día 3' }
  ];

  readonly fechaDelDia = computed(() => {
    const m = this.model();
    if (!m) return '';
    const map: Record<DiaKey, string> = {
      dia1: m.config.fechaDia1,
      dia2: m.config.fechaDia2,
      dia3: m.config.fechaDia3
    };
    return map[this.diaSel()] || '';
  });

  readonly diaNombre = computed(() => {
    const d = this.dias.find((x) => x.key === this.diaSel());
    return d ? d.name : '';
  });

  fechaDia(key: DiaKey): string {
    const m = this.model();
    if (!m) return '';
    const map: Record<DiaKey, string> = {
      dia1: m.config.fechaDia1,
      dia2: m.config.fechaDia2,
      dia3: m.config.fechaDia3
    };
    return fmtFecha(map[key] || '');
  }

  readonly personasDelDia = computed(() => {
    const m = this.model();
    if (!m) return [];
    const dk = this.diaSel();
    const f = this.filtro().toLowerCase();
    const pend = this.filtroPendiente();
    return m.reservas.filter((r) => {
      if (r.estadoGlobal === 'CANCELADO') return false;
      if (r[dk].puestos <= 0) return false;
      if (f && !r.nombre.toLowerCase().includes(f)) return false;
      if (pend !== 'TODOS') {
        const a = r[dk].asistencia ?? [];
        const pendientes = a.length < r[dk].puestos || a.slice(0, r[dk].puestos).some((x) => !x[pend]);
        if (!pendientes) return false;
      }
      return true;
    });
  });

  setPendiente(p: 'TODOS' | 'ida' | 'venida'): void {
    this.filtroPendiente.set(p);
  }

  readonly resumenDia = computed(() => {
    const dk = this.diaSel();
    const rs = this.personasDelDia();
    let totalPuestos = 0;
    let totalIda = 0;
    let totalVenida = 0;
    for (const r of rs) {
      const dia = r[dk];
      for (let i = 0; i < dia.puestos; i++) {
        totalPuestos++;
        const a = dia.asistencia?.[i];
        if (a?.ida) totalIda++;
        if (a?.venida) totalVenida++;
      }
    }
    return {
      inscritos: rs.length,
      totalPuestos,
      totalIda,
      totalVenida,
      faltanIda: totalPuestos - totalIda,
      faltanVenida: totalPuestos - totalVenida
    };
  });

  setDia(key: DiaKey): void {
    this.diaSel.set(key);
    this.expandidaId.set(null);
  }

  getAsistencia(reserva: Reserva, idx: number): { ida: boolean; venida: boolean } {
    return reserva[this.diaSel()].asistencia?.[idx] || { ida: false, venida: false };
  }

  private ensureAsistencia(reserva: Reserva): void {
    const dia = reserva[this.diaSel()];
    if (!dia.asistencia) dia.asistencia = [];
    while (dia.asistencia.length < dia.puestos) {
      dia.asistencia.push({ ida: false, venida: false });
    }
  }

  toggleIda(reserva: Reserva, idx: number): void {
    this.ensureAsistencia(reserva);
    const a = reserva[this.diaSel()].asistencia![idx];
    a.ida = !a.ida;
    this.state.updateReserva(reserva.id, { ...reserva });
  }

  toggleVenida(reserva: Reserva, idx: number): void {
    this.ensureAsistencia(reserva);
    const a = reserva[this.diaSel()].asistencia![idx];
    a.venida = !a.venida;
    this.state.updateReserva(reserva.id, { ...reserva });
  }

  private todos(reserva: Reserva, campo: 'ida' | 'venida'): { checked: boolean; indet: boolean } {
    const dia = reserva[this.diaSel()];
    const n = dia.puestos;
    const a = dia.asistencia ?? [];
    const slice = a.slice(0, n);
    const marked = slice.filter((x) => x[campo]).length;
    const allMarked = slice.length === n && marked === n;
    const noneMarked = marked === 0;
    return { checked: allMarked, indet: !allMarked && !noneMarked };
  }

  todosIdaChecked(reserva: Reserva): boolean {
    return this.todos(reserva, 'ida').checked;
  }

  todosIdaIndet(reserva: Reserva): boolean {
    return this.todos(reserva, 'ida').indet;
  }

  todosVenidaChecked(reserva: Reserva): boolean {
    return this.todos(reserva, 'venida').checked;
  }

  todosVenidaIndet(reserva: Reserva): boolean {
    return this.todos(reserva, 'venida').indet;
  }

  marcarTodosIda(reserva: Reserva, value: boolean): void {
    this.ensureAsistencia(reserva);
    for (const a of reserva[this.diaSel()].asistencia!) a.ida = value;
    this.state.updateReserva(reserva.id, { ...reserva });
  }

  marcarTodosVenida(reserva: Reserva, value: boolean): void {
    this.ensureAsistencia(reserva);
    for (const a of reserva[this.diaSel()].asistencia!) a.venida = value;
    this.state.updateReserva(reserva.id, { ...reserva });
  }
}