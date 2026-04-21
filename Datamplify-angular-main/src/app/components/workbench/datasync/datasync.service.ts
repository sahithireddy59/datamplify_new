import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SyncConnector {
  id?: string;
  name: string;
  connector_type: string;
  connector_role: 'source' | 'destination';
  config: any;
  is_active?: boolean;
  last_tested?: string;
  test_status?: string;
  test_message?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AvailableSyncConnection {
  hierarchy_id: string;
  name: string;
  connector_type: SyncConnector['connector_type'];
  connector_role: SyncConnector['connector_role'];
  source_type: string;
  source_category: string;
  schema?: string | null;
  database?: string | null;
}

export interface SyncTable {
  id?: string;
  source_table: string;
  source_schema?: string;
  destination_table: string;
  is_enabled: boolean;
  sync_mode?: string;
  cursor_field?: string;
  primary_key_field?: string;
  column_mapping?: any;
  source_filter?: any;
  row_count?: number;
  last_synced_value?: string;
}

export interface SyncJob {
  id?: string;
  name: string;
  description?: string;
  source_connector: string;
  destination_connector: string;
  source_connector_name?: string;
  destination_connector_name?: string;
  destination_schema: string;
  table_prefix?: string;
  sync_mode: 'full' | 'incremental' | 'incremental_timestamp' | 'incremental_id' | 'incremental_cursor' | 'history';
  sync_frequency: 'manual' | '15min' | 'hourly' | 'daily' | 'weekly' | 'custom';
  cron_expression?: string;
  notification_email?: string;
  status?: 'active' | 'running' | 'paused' | 'error' | 'configuring';
  current_run_id?: string;
  current_run_status?: 'pending' | 'running' | 'success' | 'partial_success' | 'failed' | 'cancelled';
  display_status?: 'active' | 'running' | 'paused' | 'error' | 'configuring' | 'pending' | 'running' | 'success' | 'partial_success' | 'failed' | 'cancelled';
  last_sync_at?: string;
  next_sync_at?: string;
  dag_id?: string;
  tables?: SyncTable[];
  table_count?: number;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SyncRun {
  id?: string;
  sync_job: string;
  job_name?: string;
  status: 'pending' | 'running' | 'success' | 'partial_success' | 'failed' | 'cancelled';
  trigger_type: string;
  dag_run_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  tables_synced: number;
  rows_inserted: number;
  rows_updated: number;
  rows_deleted: number;
  rows_failed: number;
  error_message?: string;
  error_details?: any;
  logs?: any[];
  created_at?: string;
}

export interface SyncModeOption {
  value: SyncJob['sync_mode'];
  label: string;
  description: string;
  requiresCursor: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DatasyncService {
  private apiUrl = `${environment.apiUrl}/datasync`;
  private jobsCache: any[] | null = null;
  readonly syncModes: SyncModeOption[] = [
    {
      value: 'full',
      label: 'Full Refresh',
      description: 'Reload the full dataset every run.',
      requiresCursor: false
    },
    {
      value: 'incremental',
      label: 'Incremental Mode',
      description: 'Auto-detect the best incremental column for each table and sync only new or changed rows when possible.',
      requiresCursor: true
    },
    {
      value: 'history',
      label: 'History Mode',
      description: 'Keep previous row versions with Fivetran-style history columns.',
      requiresCursor: false
    }
  ];

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Connector APIs
  getConnectors(): Observable<any> {
    return this.http.get(`${this.apiUrl}/connectors/`, { headers: this.getHeaders() });
  }

  getAvailableConnections(role: 'source' | 'destination'): Observable<AvailableSyncConnection[]> {
    return this.http.get<AvailableSyncConnection[]>(`${this.apiUrl}/connectors/available/?role=${role}`, { headers: this.getHeaders() });
  }

  importConnection(hierarchyId: string, connectorRole: 'source' | 'destination'): Observable<SyncConnector> {
    return this.http.post<SyncConnector>(
      `${this.apiUrl}/connectors/import_connection/`,
      { hierarchy_id: hierarchyId, connector_role: connectorRole },
      { headers: this.getHeaders() }
    );
  }

  getConnector(id: string): Observable<SyncConnector> {
    return this.http.get<SyncConnector>(`${this.apiUrl}/connectors/${id}/`, { headers: this.getHeaders() });
  }

  createConnector(connector: SyncConnector): Observable<SyncConnector> {
    return this.http.post<SyncConnector>(`${this.apiUrl}/connectors/`, connector, { headers: this.getHeaders() });
  }

  updateConnector(id: string, connector: Partial<SyncConnector>): Observable<SyncConnector> {
    return this.http.put<SyncConnector>(`${this.apiUrl}/connectors/${id}/`, connector, { headers: this.getHeaders() });
  }

  deleteConnector(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/connectors/${id}/`, { headers: this.getHeaders() });
  }

  testConnector(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/connectors/${id}/test_connection/`, {}, { headers: this.getHeaders() });
  }

  discoverSchema(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/connectors/${id}/discover_schema/`, {}, { headers: this.getHeaders() });
  }

  listTables(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/connectors/${id}/list_tables/`, { headers: this.getHeaders() });
  }

  // Job APIs
  getJobs(): Observable<any> {
    return this.http.get(`${this.apiUrl}/jobs/`, { headers: this.getHeaders() });
  }

  getCachedJobs(): any[] | null {
    return this.jobsCache ? [...this.jobsCache] : null;
  }

  setCachedJobs(jobs: any[]): void {
    this.jobsCache = Array.isArray(jobs) ? [...jobs] : null;
  }

  clearJobsCache(): void {
    this.jobsCache = null;
  }

  getJob(id: string): Observable<SyncJob> {
    return this.http.get<SyncJob>(`${this.apiUrl}/jobs/${id}/`, { headers: this.getHeaders() });
  }

  createJob(job: any): Observable<SyncJob> {
    return this.http.post<SyncJob>(`${this.apiUrl}/jobs/`, job, { headers: this.getHeaders() });
  }

  updateJob(id: string, job: Partial<SyncJob>): Observable<SyncJob> {
    return this.http.patch<SyncJob>(`${this.apiUrl}/jobs/${id}/`, job, { headers: this.getHeaders() });
  }

  deleteJob(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/jobs/${id}/`, { headers: this.getHeaders() });
  }

  triggerSync(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/jobs/${id}/trigger/`, {}, { headers: this.getHeaders() });
  }

  pauseJob(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/jobs/${id}/pause/`, {}, { headers: this.getHeaders() });
  }

  activateJob(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/jobs/${id}/activate/`, {}, { headers: this.getHeaders() });
  }

  getJobRuns(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/jobs/${id}/runs/`, { headers: this.getHeaders() });
  }

  // Run APIs
  getRuns(jobId?: string): Observable<any> {
    const url = jobId ? `${this.apiUrl}/runs/?job_id=${jobId}` : `${this.apiUrl}/runs/`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getRun(id: string): Observable<SyncRun> {
    return this.http.get<SyncRun>(`${this.apiUrl}/runs/${id}/`, { headers: this.getHeaders() });
  }

  getRunLogs(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/runs/${id}/logs/`, { headers: this.getHeaders() });
  }

  cancelRun(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/runs/${id}/cancel/`, {}, { headers: this.getHeaders() });
  }

  // Stats API
  getStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/`, { headers: this.getHeaders() });
  }
}
