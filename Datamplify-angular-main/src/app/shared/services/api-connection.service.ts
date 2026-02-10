import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface APIConnection {
  id?: string;
  connection_name: string;
  api_type: 'rest' | 'graphql' | 'soap';
  base_url: string;
  endpoint_path?: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  auth_type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2';
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  auth_header_name?: string;
  oauth2_client_id?: string;
  oauth2_client_secret?: string;
  oauth2_token_url?: string;
  oauth2_scope?: string;
  custom_headers?: any;
  query_params?: any;
  response_data_path?: string;
  supports_pagination?: boolean;
  pagination_type?: 'offset' | 'page' | 'cursor' | 'link';
  pagination_page_param?: string;
  pagination_size_param?: string;
  timeout?: number;
  verify_ssl?: boolean;
  field_mapping?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ApiConnectionService {
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
   * Create new API connection
   */
  createAPIConnection(connection: APIConnection): Observable<any> {
    this.loadAccessToken();
    return this.http.post(
      `${environment.apiUrl}/connections/api_connection/`,
      connection,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Get list of API connections
   */
  getAPIConnections(page: number = 1, pageSize: number = 10, search: string = ''): Observable<any> {
    this.loadAccessToken();
    let url = `${environment.apiUrl}/connections/api_connection/?page=${page}&page_size=${pageSize}`;
    if (search) {
      url += `&search=${search}`;
    }
    return this.http.get(url, { headers: this.buildHeaders(this.accessToken) });
  }

  /**
   * Get API connection details
   */
  getAPIConnection(id: string): Observable<any> {
    this.loadAccessToken();
    return this.http.get(
      `${environment.apiUrl}/connections/api_connection/${id}/`,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Update API connection
   */
  updateAPIConnection(id: string, connection: APIConnection): Observable<any> {
    this.loadAccessToken();
    return this.http.put(
      `${environment.apiUrl}/connections/api_connection/${id}/`,
      connection,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Delete API connection
   */
  deleteAPIConnection(id: string): Observable<any> {
    this.loadAccessToken();
    return this.http.delete(
      `${environment.apiUrl}/connections/api_connection/${id}/`,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Test API connection
   */
  testAPIConnection(id: string, testParams?: any): Observable<any> {
    this.loadAccessToken();
    return this.http.post(
      `${environment.apiUrl}/connections/api_connection/${id}/test/`,
      testParams || {},
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Get API connection schema
   */
  getAPISchema(id: string): Observable<any> {
    this.loadAccessToken();
    return this.http.get(
      `${environment.apiUrl}/connections/api_connection/${id}/schema/`,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Rediscover API schema
   */
  rediscoverAPISchema(id: string): Observable<any> {
    this.loadAccessToken();
    return this.http.post(
      `${environment.apiUrl}/connections/api_connection/${id}/schema/`,
      {},
      { headers: this.buildHeaders(this.accessToken) }
    );
  }

  /**
   * Preview data from API
   */
  previewAPIData(id: string, page: number = 1, pageSize: number = 10): Observable<any> {
    this.loadAccessToken();
    return this.http.get(
      `${environment.apiUrl}/connections/api_connection/${id}/data/?page=${page}&page_size=${pageSize}`,
      { headers: this.buildHeaders(this.accessToken) }
    );
  }
}
