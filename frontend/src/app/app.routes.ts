import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard)
  },
  { path: 'reservas', redirectTo: '/dashboard' },
  {
    path: 'asistencia',
    loadComponent: () => import('./asistencia/asistencia').then((m) => m.AsistenciaPage)
  },
  {
    path: 'config',
    loadComponent: () => import('./config/config').then((m) => m.ConfigPage)
  },
  {
    path: 'reserva',
    loadComponent: () => import('./reserva-form/reserva-form').then((m) => m.ReservaForm)
  },
  {
    path: 'reserva/:id',
    loadComponent: () => import('./reserva-form/reserva-form').then((m) => m.ReservaForm)
  }
];