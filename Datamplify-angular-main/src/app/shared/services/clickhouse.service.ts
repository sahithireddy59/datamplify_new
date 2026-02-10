import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClickHouseConnection {
  hostname: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connection_name: string;
}

export interface ClickHouseDumpRequest {
  source_connection_id: string;
  source_table: string;
  target_connection_id: string;
  target_table: string;
  mode: 'append' | 'replace';
  engine?: string;
  order_by?: string[];
  partition_by?: string;
  batch_size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClickhouseService {
  private accessToken: string = '';

  constructor(private http: HttpClient) {
    this.loadAccessToken();
  }

  private loadAccessToken() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      this.accessToken = JSON.parse(currentUser)['Token'];
    }
  }

  private buildHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Create ClickHouse connection
   */
  createClickHouseConnection(connection: ClickHouseConnection): Observable<any> {
    this.loadAccessToken();
    return this.http.post(
      `${environment.apiUrl}/connections/clickhouse_connection/`,
      connection,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Dump data to ClickHouse
   */
  dumpToClickHouse(dumpRequest: ClickHouseDumpRequest): Observable<any> {
    this.loadAccessToken();
    return this.http.post(
      `${environment.apiUrl}/connections/clickhouse_dump/`,
      dumpRequest,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Execute query on ClickHouse
   */
  executeQuery(connectionId: string, query: string): Observable<any> {
    this.loadAccessToken();
    return this.http.post(
      `${environment.apiUrl}/connections/clickhouse_query/${connectionId}/`,
      { query },
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Get ClickHouse connection details
   */
  getClickHouseConnection(id: string): Observable<any> {
    this.loadAccessToken();
    return this.http.get(
      `${environment.apiUrl}/connections/Database_connection/${id}`,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Get ClickHouse tables
   */
  getClickHouseTables(connectionId: string): Observable<any> {
    this.loadAccessToken();
    return this.http.get(
      `${environment.apiUrl}/connections/Server_tables/${connectionId}/`,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }
}
