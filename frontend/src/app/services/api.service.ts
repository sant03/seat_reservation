import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CommitInfo, Model } from '../models';

export interface SaveResult {
  ok: boolean;
  sha?: string | null;
  totales?: unknown;
}

export interface ResetResult {
  ok: boolean;
  sha?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getModel(): Observable<Model> {
    return this.http.get<Model>(`${this.base}/api/model`);
  }

  saveModel(model: Model): Observable<SaveResult> {
    return this.http.put<SaveResult>(`${this.base}/api/model`, model);
  }

  resetModel(eventoNombre: string): Observable<ResetResult> {
    return this.http.post<ResetResult>(`${this.base}/api/model/reset`, { eventoNombre });
  }

  getHistory(): Observable<CommitInfo[]> {
    return this.http.get<CommitInfo[]>(`${this.base}/api/history`);
  }

  getModelAt(sha: string): Observable<Model> {
    return this.http.get<Model>(`${this.base}/api/history/${sha}`);
  }

  exportUrl(): string {
    return `${this.base}/api/model/export`;
  }
}