import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { StateService } from '../services/state.service';
import { ThemeService } from '../theme/theme.service';
import { DIA_KEYS, DiaKey } from '../models';
import { fmtFecha, fmtMoney } from '../utils';
import { Reservas } from '../reservas/reservas';

@Component({
  imports: [MatCardModule, MatProgressBarModule, MatIconModule, MatButtonModule, RouterLink, Reservas],
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
  private state = inject(StateService);
  readonly theme = inject(ThemeService);
  readonly loading = this.state.loading;
  readonly error = this.state.error;
  readonly fmtMoney = fmtMoney;

  readonly model = this.state.model;
  readonly dias = DIA_KEYS.map((key, i) => ({ key, name: `Día ${i + 1}` }));

  readonly info = computed(() => {
    const m = this.model();
    if (!m) return null;
    const t = m.totales;
    return {
      diasFechas: [fmtFecha(m.config.fechaDia1), fmtFecha(m.config.fechaDia2), fmtFecha(m.config.fechaDia3)],
      personas: t.personas,
      cancelados: t.cancelados,
      pagado: fmtMoney(t.pagadoTotal),
      pendiente: fmtMoney(t.pendienteTotal),
      esperado: fmtMoney(t.recaudadoEsperado)
    };
  });

  capacidad(dk: DiaKey): number {
    return this.model()?.config.capacidadBus ?? 0;
  }

  puestos(dk: DiaKey): number {
    return this.model()?.totales.porDia[dk].puestos ?? 0;
  }

  pct(dk: DiaKey): number {
    const cap = this.capacidad(dk);
    if (!cap) return 0;
    return Math.min(100, (this.puestos(dk) / cap) * 100);
  }

  sobrecupo(dk: DiaKey): number {
    return this.model()?.totales.porDia[dk].sobrecupo ?? 0;
  }
}