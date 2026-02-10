/**
 * Connection type definitions for Datamplify
 */

export interface DatabaseConnection {
  id?: string;
  database_type: number;
  hostname: string;
  port: number | string;
  username: string;
  password: string;
  database: string;
  connection_name: string;
  service_name?: string;
  path?: string;
  schema?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FileConnection {
  id?: string;
  file_type: number;
  file_path: File;
  connection_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface APIConnection {
  id?: string;
  connection_name: string;
  api_type: 'rest' | 'graphql' | 'soap';
  base_url: string;
  endpoint_path?: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  
  // Authentication
  auth_type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth2';
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  auth_header_name?: string;
  
  // OAuth2
  oauth2_client_id?: string;
  oauth2_client_secret?: string;
  oauth2_token_url?: string;
  oauth2_scope?: string;
  
  // Headers & Parameters
  custom_headers?: { [key: string]: string };
  query_params?: { [key: string]: string };
  
  // Request/Response
  request_body_template?: string;
  response_data_path?: string;
  
  // Pagination
  supports_pagination?: boolean;
  pagination_type?: 'offset' | 'page' | 'cursor' | 'link';
  pagination_page_param?: string;
  pagination_size_param?: string;
  pagination_total_path?: string;
  
  // Rate Limiting
  rate_limit_requests?: number;
  rate_limit_period?: number;
  
  // Connection Settings
  timeout?: number;
  verify_ssl?: boolean;
  retry_attempts?: number;
  
  // Data Mapping
  field_mapping?: { [key: string]: string };
  
  // Status
  is_connected?: boolean;
  last_tested_at?: string;
  last_test_status?: string;
  last_test_message?: string;
  
  created_at?: string;
  updated_at?: string;
}

export interface ClickHouseConnection {
  id?: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connection_name: string;
  created_at?: string;
  updated_at?: string;
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

export interface ConnectionListItem {
  display_name: string;
  hierarchy_id: string;
  server_type: string;
  type: string;
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  id: number;
  name: string;
  type: string;
}

export interface TableSchema {
  tables: string;
  columns: Array<{
    col: string;
    dtype: string;
    target_dtype?: string;
  }>;
}

export interface APISchema {
  field_name: string;
  field_type: string;
  field_path: string;
  is_nullable: boolean;
  is_array: boolean;
  sample_value?: string;
}

export const AUTH_TYPES = [
  { value: 'none', label: 'No Authentication' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' }
];

export const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' }
];

export const API_TYPES = [
  { value: 'rest', label: 'REST API' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'soap', label: 'SOAP' }
];

export const PAGINATION_TYPES = [
  { value: 'page', label: 'Page-based' },
  { value: 'offset', label: 'Offset-based' },
  { value: 'cursor', label: 'Cursor-based' },
  { value: 'link', label: 'Link Header' }
];

export const CLICKHOUSE_ENGINES = [
  { value: 'MergeTree', label: 'MergeTree (General Purpose)' },
  { value: 'ReplacingMergeTree', label: 'ReplacingMergeTree (Deduplication)' },
  { value: 'SummingMergeTree', label: 'SummingMergeTree (Aggregation)' },
  { value: 'AggregatingMergeTree', label: 'AggregatingMergeTree (Pre-aggregation)' },
  { value: 'CollapsingMergeTree', label: 'CollapsingMergeTree (State Changes)' }
];
