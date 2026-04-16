import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DatasyncService, AvailableSyncConnection, SyncModeOption } from '../datasync.service';

@Component({
  selector: 'app-datasync-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './datasync-create.component.html',
  styleUrls: ['./datasync-create.component.scss']
})
export class DatasyncCreateComponent implements OnInit {
  currentStep = 1;
  totalSteps = 5;
  
  // Step 1: Source Connector
  sourceConnectors: AvailableSyncConnection[] = [];
  selectedSourceConnector: string = '';
  selectedSourceSyncConnector = '';
  
  // Step 2: Destination Connector
  destinationConnectors: AvailableSyncConnection[] = [];
  selectedDestinationConnector: string = '';
  selectedDestinationSyncConnector = '';
  destinationSchema = 'public';
  tablePrefix = '';
  
  // Step 3: Tables
  availableTables: any[] = [];
  selectedTables: any[] = [];
  selectedTableLookup: Record<string, boolean> = {};
  loadingTables = false;
  skippedEndpoints: { name: string; reason: string }[] = [];
  
  // Step 4: Sync Configuration
  syncMode: 'full' | 'incremental' | 'incremental_timestamp' | 'incremental_id' | 'incremental_cursor' | 'history' = 'full';
  syncFrequency: 'manual' | '15min' | 'hourly' | 'daily' | 'weekly' | 'custom' = 'manual';
  cronExpression = '';
  readonly syncModes: SyncModeOption[];
  
  // Step 5: Job Details
  jobName = '';
  jobDescription = '';
  
  loading = false;
  error: string | null = null;

  constructor(
    private datasyncService: DatasyncService,
    private router: Router
  ) {
    this.syncModes = this.datasyncService.syncModes;
  }

  ngOnInit(): void {
    this.loadConnectors();
  }

  loadConnectors(): void {
    forkJoin({
      source: this.datasyncService.getAvailableConnections('source'),
      destination: this.datasyncService.getAvailableConnections('destination')
    }).subscribe({
      next: ({ source, destination }) => {
        this.sourceConnectors = source;
        this.destinationConnectors = destination;
      },
      error: (err) => {
        this.error = 'Failed to load connectors';
        console.error('Error loading connectors:', err);
      }
    });
  }

  nextStep(): void {
    if (this.currentStep === 1 && !this.selectedSourceConnector) {
      alert('Please select a source connector');
      return;
    }
    
    if (this.currentStep === 2 && !this.selectedDestinationConnector) {
      alert('Please select a destination connector');
      return;
    }
    
    if (this.currentStep === 2) {
      this.prepareConnectorsAndDiscoverTables();
      return;
    }
    
    if (this.currentStep === 3 && this.selectedTables.length === 0) {
      alert('Please select at least one table');
      return;
    }
    
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  discoverTables(): void {
    this.loadingTables = true;
    this.availableTables = [];
    this.skippedEndpoints = [];
    
    this.datasyncService.discoverSchema(this.selectedSourceSyncConnector).subscribe({
      next: (response) => {
        this.availableTables = response.tables || [];
        this.selectedTables = [];
        this.selectedTableLookup = {};
        this.skippedEndpoints = response.skipped_endpoints || [];
        this.loadingTables = false;
      },
      error: (err) => {
        this.error = `Failed to discover tables: ${this.getErrorMessage(err)}`;
        this.loadingTables = false;
        console.error('Error discovering tables:', err?.error || err);
      }
    });
  }

  prepareConnectorsAndDiscoverTables(): void {
    this.loadingTables = true;
    this.error = null;

    forkJoin({
      source: this.datasyncService.importConnection(this.selectedSourceConnector, 'source'),
      destination: this.datasyncService.importConnection(this.selectedDestinationConnector, 'destination')
    }).subscribe({
      next: ({ source, destination }) => {
        this.selectedSourceSyncConnector = source.id || '';
        this.selectedDestinationSyncConnector = destination.id || '';
        this.currentStep++;
        this.discoverTables();
      },
      error: (err) => {
        this.loadingTables = false;
        this.error = `Failed to load the selected EasyConnect connections: ${this.getErrorMessage(err)}`;
        console.error('Error importing selected EasyConnect connections:', err?.error || err);
      }
    });
  }

  toggleTableSelection(table: any): void {
    const index = this.selectedTables.findIndex(t => t.source_table === table.name);
    if (index > -1) {
      this.selectedTables.splice(index, 1);
    } else {
      this.selectedTables.push({
        source_table: table.name,
        destination_table: (this.tablePrefix || '') + (table.destination_name || table.name),
        is_enabled: true,
        cursor_field: table.cursor_field || null,
        primary_key_field: table.primary_key || null
      });
    }
    this.syncSelectedTableLookup();
  }

  isTableSelected(table: any): boolean {
    return !!this.selectedTableLookup[table.name];
  }

  toggleAllTables(): void {
    if (this.selectedTables.length === this.availableTables.length) {
      // Deselect all
      this.selectedTables = [];
    } else {
      // Select all
      this.selectedTables = this.availableTables.map(table => ({
        source_table: table.name,
        destination_table: (this.tablePrefix || '') + (table.destination_name || table.name),
        is_enabled: true,
        cursor_field: table.cursor_field || null,
        primary_key_field: table.primary_key || null
      }));
    }
    this.syncSelectedTableLookup();
  }

  areAllTablesSelected(): boolean {
    return this.availableTables.length > 0 && 
           this.selectedTables.length === this.availableTables.length;
  }

  createJob(): void {
    if (!this.jobName) {
      alert('Please enter a job name');
      return;
    }
    
    this.loading = true;
    this.error = null;
    
    const jobData = {
      name: this.jobName,
      description: this.jobDescription,
      source_connector: this.selectedSourceSyncConnector,
      destination_connector: this.selectedDestinationSyncConnector,
      destination_schema: this.destinationSchema,
      table_prefix: this.tablePrefix,
      sync_mode: this.syncMode,
      sync_frequency: this.syncFrequency,
      cron_expression: this.cronExpression,
      tables: this.selectedTables
    };
    
    this.datasyncService.createJob(jobData).subscribe({
      next: (response) => {
        alert('Sync job created successfully!');
        this.router.navigate(['/datamplify/sync']);
      },
      error: (err) => {
        const detail = this.getErrorMessage(err);
        this.error = 'Failed to create sync job: ' + detail;
        this.loading = false;
        console.error('Error creating job:', err);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/datamplify/sync']);
  }

  getSelectedMode(): SyncModeOption | undefined {
    return this.syncModes.find((mode) => mode.value === this.syncMode);
  }

  trackByTableName(index: number, table: any): string {
    return table.name;
  }

  private getErrorMessage(err: any): string {
    const payload = err?.error;
    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }
    if (payload?.error) {
      return payload.error;
    }
    if (payload?.message) {
      return payload.message;
    }
    if (payload?.detail) {
      return payload.detail;
    }
    if (err?.message) {
      return err.message;
    }
    return 'Unknown error';
  }

  private syncSelectedTableLookup(): void {
    this.selectedTableLookup = this.selectedTables.reduce((lookup, table) => {
      lookup[table.source_table] = true;
      return lookup;
    }, {} as Record<string, boolean>);
  }
}
