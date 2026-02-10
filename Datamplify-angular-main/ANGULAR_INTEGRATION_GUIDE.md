# Angular Integration Guide for API & ClickHouse

This guide covers the Angular frontend implementation for API connections and ClickHouse integration.

## 📁 New Files Created

### Services

1. **`src/app/shared/services/api-connection.service.ts`**
   - Service for managing API connections
   - Methods: create, update, delete, test, get schema, preview data

2. **`src/app/shared/services/clickhouse.service.ts`**
   - Service for ClickHouse operations
   - Methods: create connection, dump data, execute queries

3. **`src/app/shared/models/connection.models.ts`**
   - TypeScript interfaces for all connection types
   - Constants for dropdowns (auth types, HTTP methods, etc.)

### Updated Files

1. **`src/app/components/workbench/workbench.service.ts`**
   - Added API connection methods
   - Added ClickHouse methods

## 🔧 Usage Examples

### API Connection Service

```typescript
import { ApiConnectionService, APIConnection } from '@shared/services/api-connection.service';

constructor(private apiService: ApiConnectionService) {}

// Create API connection
createConnection() {
  const connection: APIConnection = {
    connection_name: 'GitHub API',
    api_type: 'rest',
    base_url: 'https://api.github.com',
    endpoint_path: '/users/octocat/repos',
    http_method: 'GET',
    auth_type: 'bearer',
    auth_token: 'ghp_your_token',
    supports_pagination: true,
    pagination_type: 'page'
  };

  this.apiService.createAPIConnection(connection).subscribe(
    response => console.log('Connection created:', response),
    error => console.error('Error:', error)
  );
}

// Test connection
testConnection(connectionId: string) {
  this.apiService.testAPIConnection(connectionId).subscribe(
    response => console.log('Test result:', response),
    error => console.error('Test failed:', error)
  );
}

// Get schema
getSchema(connectionId: string) {
  this.apiService.getAPISchema(connectionId).subscribe(
    response => console.log('Schema:', response.schema),
    error => console.error('Error:', error)
  );
}
```

### ClickHouse Service

```typescript
import { ClickhouseService, ClickHouseDumpRequest } from '@shared/services/clickhouse.service';

constructor(private clickhouseService: ClickhouseService) {}

// Create ClickHouse connection
createClickHouse() {
  const connection = {
    hostname: 'localhost',
    port: 8123,
    username: 'default',
    password: '',
    database: 'default',
    connection_name: 'ClickHouse Warehouse'
  };

  this.clickhouseService.createClickHouseConnection(connection).subscribe(
    response => console.log('ClickHouse connected:', response),
    error => console.error('Error:', error)
  );
}

// Dump data to ClickHouse
dumpData() {
  const dumpRequest: ClickHouseDumpRequest = {
    source_connection_id: 'postgres-uuid',
    source_table: 'customers',
    target_connection_id: 'clickhouse-uuid',
    target_table: 'customers',
    mode: 'replace',
    engine: 'MergeTree',
    order_by: ['id'],
    batch_size: 100000
  };

  this.clickhouseService.dumpToClickHouse(dumpRequest).subscribe(
    response => console.log('Data dumped:', response),
    error => console.error('Error:', error)
  );
}

// Execute query
executeQuery(connectionId: string) {
  const query = 'SELECT * FROM customers LIMIT 10';
  
  this.clickhouseService.executeQuery(connectionId, query).subscribe(
    response => console.log('Query result:', response.data),
    error => console.error('Error:', error)
  );
}
```

### Using Models

```typescript
import { 
  APIConnection, 
  ClickHouseConnection,
  AUTH_TYPES,
  HTTP_METHODS,
  CLICKHOUSE_ENGINES 
} from '@shared/models/connection.models';

// In component
authTypes = AUTH_TYPES;
httpMethods = HTTP_METHODS;
engines = CLICKHOUSE_ENGINES;

// Type-safe connection object
connection: APIConnection = {
  connection_name: '',
  api_type: 'rest',
  base_url: '',
  http_method: 'GET',
  auth_type: 'none'
};
```

## 🎨 UI Components to Create

### 1. API Connection Form Component

Create: `src/app/components/workbench/api-connection-form/`

```typescript
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiConnectionService } from '@shared/services/api-connection.service';
import { AUTH_TYPES, HTTP_METHODS, API_TYPES } from '@shared/models/connection.models';

@Component({
  selector: 'app-api-connection-form',
  templateUrl: './api-connection-form.component.html'
})
export class ApiConnectionFormComponent {
  connectionForm: FormGroup;
  authTypes = AUTH_TYPES;
  httpMethods = HTTP_METHODS;
  apiTypes = API_TYPES;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiConnectionService
  ) {
    this.connectionForm = this.fb.group({
      connection_name: ['', Validators.required],
      api_type: ['rest', Validators.required],
      base_url: ['', [Validators.required, Validators.pattern('https?://.+')]],
      endpoint_path: [''],
      http_method: ['GET', Validators.required],
      auth_type: ['none', Validators.required],
      auth_token: [''],
      timeout: [30]
    });
  }

  onSubmit() {
    if (this.connectionForm.valid) {
      this.apiService.createAPIConnection(this.connectionForm.value).subscribe(
        response => {
          console.log('Connection created successfully');
          // Handle success
        },
        error => {
          console.error('Error creating connection:', error);
          // Handle error
        }
      );
    }
  }

  testConnection() {
    // Test logic
  }
}
```

### 2. ClickHouse Dump Component

Create: `src/app/components/workbench/clickhouse-dump/`

```typescript
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClickhouseService } from '@shared/services/clickhouse.service';
import { WorkbenchService } from '../workbench.service';
import { CLICKHOUSE_ENGINES } from '@shared/models/connection.models';

@Component({
  selector: 'app-clickhouse-dump',
  templateUrl: './clickhouse-dump.component.html'
})
export class ClickhouseDumpComponent implements OnInit {
  dumpForm: FormGroup;
  engines = CLICKHOUSE_ENGINES;
  sourceConnections: any[] = [];
  clickhouseConnections: any[] = [];
  sourceTables: any[] = [];

  constructor(
    private fb: FormBuilder,
    private clickhouseService: ClickhouseService,
    private workbenchService: WorkbenchService
  ) {
    this.dumpForm = this.fb.group({
      source_connection_id: ['', Validators.required],
      source_table: ['', Validators.required],
      target_connection_id: ['', Validators.required],
      target_table: ['', Validators.required],
      mode: ['append', Validators.required],
      engine: ['MergeTree'],
      order_by: [[]],
      partition_by: [''],
      batch_size: [100000]
    });
  }

  ngOnInit() {
    this.loadConnections();
  }

  loadConnections() {
    // Load all connections
    this.workbenchService.getConnectionsList(1, 1000, '').subscribe(
      response => {
        this.sourceConnections = response.data;
        this.clickhouseConnections = response.data.filter(
          (conn: any) => conn.server_type === 'CLICKHOUSE'
        );
      }
    );
  }

  onSourceConnectionChange(connectionId: string) {
    // Load tables for selected connection
    this.workbenchService.getTablesForDataTransformation(connectionId).subscribe(
      response => {
        this.sourceTables = response.tables;
      }
    );
  }

  onSubmit() {
    if (this.dumpForm.valid) {
      this.clickhouseService.dumpToClickHouse(this.dumpForm.value).subscribe(
        response => {
          console.log('Data dumped successfully:', response);
          // Show success message
        },
        error => {
          console.error('Error dumping data:', error);
          // Show error message
        }
      );
    }
  }
}
```

## 📋 HTML Templates

### API Connection Form Template

```html
<form [formGroup]="connectionForm" (ngSubmit)="onSubmit()">
  <div class="form-group">
    <label>Connection Name *</label>
    <input type="text" formControlName="connection_name" class="form-control" />
  </div>

  <div class="form-group">
    <label>API Type *</label>
    <select formControlName="api_type" class="form-control">
      <option *ngFor="let type of apiTypes" [value]="type.value">
        {{ type.label }}
      </option>
    </select>
  </div>

  <div class="form-group">
    <label>Base URL *</label>
    <input type="url" formControlName="base_url" class="form-control" 
           placeholder="https://api.example.com" />
  </div>

  <div class="form-group">
    <label>Endpoint Path</label>
    <input type="text" formControlName="endpoint_path" class="form-control" 
           placeholder="/v1/users" />
  </div>

  <div class="form-group">
    <label>HTTP Method *</label>
    <select formControlName="http_method" class="form-control">
      <option *ngFor="let method of httpMethods" [value]="method.value">
        {{ method.label }}
      </option>
    </select>
  </div>

  <div class="form-group">
    <label>Authentication Type *</label>
    <select formControlName="auth_type" class="form-control">
      <option *ngFor="let auth of authTypes" [value]="auth.value">
        {{ auth.label }}
      </option>
    </select>
  </div>

  <div class="form-group" *ngIf="connectionForm.get('auth_type')?.value === 'bearer'">
    <label>Bearer Token</label>
    <input type="password" formControlName="auth_token" class="form-control" />
  </div>

  <div class="form-actions">
    <button type="button" (click)="testConnection()" class="btn btn-secondary">
      Test Connection
    </button>
    <button type="submit" [disabled]="!connectionForm.valid" class="btn btn-primary">
      Save Connection
    </button>
  </div>
</form>
```

### ClickHouse Dump Template

```html
<form [formGroup]="dumpForm" (ngSubmit)="onSubmit()">
  <h3>Source Configuration</h3>
  
  <div class="form-group">
    <label>Source Connection *</label>
    <select formControlName="source_connection_id" class="form-control"
            (change)="onSourceConnectionChange($event.target.value)">
      <option value="">Select source connection</option>
      <option *ngFor="let conn of sourceConnections" [value]="conn.hierarchy_id">
        {{ conn.display_name }} ({{ conn.server_type }})
      </option>
    </select>
  </div>

  <div class="form-group">
    <label>Source Table *</label>
    <select formControlName="source_table" class="form-control">
      <option value="">Select table</option>
      <option *ngFor="let table of sourceTables" [value]="table.tables">
        {{ table.tables }}
      </option>
    </select>
  </div>

  <h3>Target Configuration</h3>

  <div class="form-group">
    <label>ClickHouse Connection *</label>
    <select formControlName="target_connection_id" class="form-control">
      <option value="">Select ClickHouse connection</option>
      <option *ngFor="let conn of clickhouseConnections" [value]="conn.hierarchy_id">
        {{ conn.display_name }}
      </option>
    </select>
  </div>

  <div class="form-group">
    <label>Target Table Name *</label>
    <input type="text" formControlName="target_table" class="form-control" />
  </div>

  <div class="form-group">
    <label>Mode *</label>
    <select formControlName="mode" class="form-control">
      <option value="append">Append</option>
      <option value="replace">Replace</option>
    </select>
  </div>

  <div class="form-group">
    <label>Table Engine</label>
    <select formControlName="engine" class="form-control">
      <option *ngFor="let engine of engines" [value]="engine.value">
        {{ engine.label }}
      </option>
    </select>
  </div>

  <div class="form-group">
    <label>Batch Size</label>
    <input type="number" formControlName="batch_size" class="form-control" />
  </div>

  <div class="form-actions">
    <button type="submit" [disabled]="!dumpForm.valid" class="btn btn-primary">
      Dump Data to ClickHouse
    </button>
  </div>
</form>
```

## 🔄 Integration with Existing Components

### Update Easy Connection Component

Add API and ClickHouse to the connection type selection:

```typescript
// In easy-connection.component.ts
connectionTypes = [
  { id: 1, name: 'PostgreSQL', type: 'DATABASE' },
  { id: 6, name: 'MySQL', type: 'DATABASE' },
  { id: 7, name: 'MongoDB', type: 'DATABASE' },
  { id: 9, name: 'API', type: 'API' },
  { id: 10, name: 'ClickHouse', type: 'DATABASE' },
  // ... other types
];
```

### Update FlowBoard Component

Add API and ClickHouse as source/target options in FlowBoard.

## 📝 Next Steps

1. **Create UI Components:**
   - API Connection Form
   - ClickHouse Connection Form
   - ClickHouse Dump Dialog
   - API Schema Viewer

2. **Update Existing Components:**
   - Add API/ClickHouse to easy-connection
   - Add to FlowBoard source/target selection
   - Update connection list to show API/ClickHouse

3. **Add Routing:**
   ```typescript
   // In workbench.routes.ts
   {
     path: 'api-connections',
     component: ApiConnectionListComponent
   },
   {
     path: 'clickhouse-dump',
     component: ClickhouseDumpComponent
   }
   ```

4. **Add to Navigation:**
   - Add menu items for API connections
   - Add menu item for ClickHouse dump

## 🎯 Features Implemented

✅ API Connection Service
✅ ClickHouse Service  
✅ TypeScript Models & Interfaces
✅ Workbench Service Updates
✅ Constants for Dropdowns

## 📚 Resources

- [API Integration Guide](../Datamplify-DEV/docs/API_INTEGRATION_GUIDE.md)
- [ClickHouse Integration Guide](../Datamplify-DEV/docs/CLICKHOUSE_INTEGRATION_GUIDE.md)
- [Backend API Reference](../Datamplify-DEV/sdk/API_REFERENCE.md)
