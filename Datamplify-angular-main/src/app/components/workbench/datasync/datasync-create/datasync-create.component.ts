import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { DatasyncService, AvailableSyncConnection, SyncModeOption } from '../datasync.service';

interface DiscoverableTable {
  name: string;
  label?: string;
  destination_name?: string;
  primary_key?: string | null;
  cursor_field?: string | null;
  row_count?: number | null;
  supports_history?: boolean;
  supports_incremental?: boolean;
  discovery_status?: 'pending' | 'ready' | 'partial';
  discovery_error?: string | null;
}

interface SelectedSyncTable {
  source_table: string;
  destination_table: string;
  is_enabled: boolean;
  sync_mode?: 'full' | 'incremental' | 'history';
  cursor_field?: string | null;
  primary_key_field?: string | null;
}

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
  destinationSchema = '';
  tablePrefix = '';
  
  // Step 3: Tables
  availableTables: DiscoverableTable[] = [];
  filteredTables: DiscoverableTable[] = [];
  visibleTables: DiscoverableTable[] = [];
  selectedTables: SelectedSyncTable[] = [];
  selectedTableLookup: Record<string, boolean> = {};
  loadingTables = false;
  loadingTableMetadata = false;
  skippedEndpoints: { name: string; reason: string }[] = [];
  tableSearch = '';
  readonly tablePageSize = 100;
  private currentVisibleCount = 100;
  
  // Step 4: Sync Configuration
  syncMode: 'full' | 'incremental' | 'incremental_timestamp' | 'incremental_id' | 'incremental_cursor' | 'history' = 'full';
  syncFrequency: 'manual' | '15min' | 'hourly' | 'daily' | 'weekly' | 'custom' = 'manual';
  cronExpression = '';
  readonly syncModes: SyncModeOption[];
  
  // Step 5: Job Details
  jobName = '';
  jobDescription = '';
  notificationEmail = '';
  
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
    this.fetchConnectors().subscribe({
      next: ({ source, destination }) => {
        this.sourceConnectors = source;
        this.destinationConnectors = destination;
        this.syncSelectedConnectorDetails();
      },
      error: (err) => {
        this.error = 'Failed to load connectors';
        console.error('Error loading connectors:', err);
      }
    });
  }

  private fetchConnectors(): Observable<{
    source: AvailableSyncConnection[];
    destination: AvailableSyncConnection[];
  }> {
    return forkJoin({
      source: this.datasyncService.getAvailableConnections('source'),
      destination: this.datasyncService.getAvailableConnections('destination')
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

  selectDestinationConnector(connector: AvailableSyncConnection): void {
    this.selectedDestinationConnector = connector.hierarchy_id;
    this.destinationSchema = connector.schema || 'public';
  }

  discoverTables(): void {
    this.loadingTableMetadata = true;
    this.skippedEndpoints = [];

    this.datasyncService.discoverSchema(this.selectedSourceSyncConnector).subscribe({
      next: (response) => {
        const discoveredTables = (response.tables || []).map((table: DiscoverableTable) => ({
          ...table,
          supports_history: this.isHistorySupported(table)
        })) as DiscoverableTable[];
        const discoveredByName = new Map<string, DiscoverableTable>(
          discoveredTables.map((table: DiscoverableTable) => [table.name, table])
        );

        this.availableTables = this.availableTables.map((table: DiscoverableTable) => {
          const discoveredTable = discoveredByName.get(table.name);
          return discoveredTable ? discoveredTable : table;
        });

        for (const discoveredTable of discoveredTables as DiscoverableTable[]) {
          if (!this.availableTables.some((table) => table.name === discoveredTable.name)) {
            this.availableTables.push(discoveredTable);
          }
        }

        this.tableSearch = this.tableSearch || '';
        this.refreshVisibleTables();
        this.selectedTables = this.selectedTables.map((selectedTable: SelectedSyncTable) => {
          const discoveredTable = discoveredByName.get(selectedTable.source_table);
          if (!discoveredTable) {
            return selectedTable;
          }
          return {
            ...selectedTable,
            sync_mode: this.resolveTableSyncMode(discoveredTable),
            cursor_field: discoveredTable.cursor_field || null,
            primary_key_field: discoveredTable.primary_key || null,
          };
        });
        this.syncSelectedTableLookup();
        this.skippedEndpoints = response.skipped_endpoints || [];
        this.loadingTableMetadata = false;
      },
      error: (err) => {
        this.loadingTableMetadata = false;
        console.error('Error discovering table metadata:', err?.error || err);
      }
    });
  }

  loadTables(): void {
    this.loadingTables = true;
    this.availableTables = [];
    this.filteredTables = [];
    this.visibleTables = [];
    this.skippedEndpoints = [];

    this.datasyncService.listTables(this.selectedSourceSyncConnector).subscribe({
      next: (response) => {
        this.availableTables = (response.tables || []).map((table: DiscoverableTable) => ({
          ...table,
          supports_history: this.isHistorySupported(table)
        }));
        this.tableSearch = '';
        this.currentVisibleCount = this.tablePageSize;
        this.refreshVisibleTables();
        this.selectedTables = [];
        this.selectedTableLookup = {};
        this.loadingTables = false;
        this.discoverTables();
      },
      error: (err) => {
        this.error = `Failed to load tables: ${this.getErrorMessage(err)}`;
        this.loadingTables = false;
        console.error('Error loading tables:', err?.error || err);
      }
    });
  }

  prepareConnectorsAndDiscoverTables(): void {
    this.loadingTables = true;
    this.error = null;

    this.fetchConnectors().subscribe({
      next: ({ source, destination }: { source: AvailableSyncConnection[]; destination: AvailableSyncConnection[] }) => {
        this.sourceConnectors = source;
        this.destinationConnectors = destination;
        this.syncSelectedConnectorDetails();
        this.importSelectedConnectors();
      },
      error: (err: unknown) => {
        this.loadingTables = false;
        this.error = `Failed to refresh connector details: ${this.getErrorMessage(err)}`;
        console.error('Error refreshing connectors:', err);
      }
    });
  }

  private importSelectedConnectors(): void {
    forkJoin({
      source: this.datasyncService.importConnection(this.selectedSourceConnector, 'source'),
      destination: this.datasyncService.importConnection(this.selectedDestinationConnector, 'destination')
    }).subscribe({
      next: ({ source, destination }) => {
        this.selectedSourceSyncConnector = source.id || '';
        this.selectedDestinationSyncConnector = destination.id || '';
        this.currentStep++;
        this.loadTables();
      },
      error: (err) => {
        this.loadingTables = false;
        this.error = `Failed to load the selected EasyConnect connections: ${this.getErrorMessage(err)}`;
        console.error('Error importing selected EasyConnect connections:', err?.error || err);
      }
    });
  }

  toggleTableSelection(table: DiscoverableTable): void {
    const index = this.selectedTables.findIndex(t => t.source_table === table.name);
    if (index > -1) {
      this.selectedTables.splice(index, 1);
    } else {
      this.selectedTables.push({
        source_table: table.name,
        destination_table: (this.tablePrefix || '') + (table.destination_name || table.name),
        is_enabled: true,
        sync_mode: this.resolveTableSyncMode(table),
        cursor_field: table.cursor_field || null,
        primary_key_field: table.primary_key || null
      });
    }
    this.syncSelectedTableLookup();
  }

  isTableSelected(table: DiscoverableTable): boolean {
    return !!this.selectedTableLookup[table.name];
  }

  toggleAllTables(): void {
    if (this.selectedTables.length === this.filteredTables.length && this.filteredTables.length > 0) {
      // Deselect all
      const visibleTableNames = new Set(this.filteredTables.map((table) => table.name));
      this.selectedTables = this.selectedTables.filter((table) => !visibleTableNames.has(table.source_table));
    } else {
      const selectedByName = new Map(this.selectedTables.map((table) => [table.source_table, table]));
      for (const table of this.filteredTables) {
        if (!selectedByName.has(table.name)) {
          selectedByName.set(table.name, {
            source_table: table.name,
            destination_table: (this.tablePrefix || '') + (table.destination_name || table.name),
            is_enabled: true,
            sync_mode: this.resolveTableSyncMode(table),
            cursor_field: table.cursor_field || null,
            primary_key_field: table.primary_key || null
          });
        }
      }
      this.selectedTables = Array.from(selectedByName.values());
    }
    this.syncSelectedTableLookup();
  }

  areAllTablesSelected(): boolean {
    return this.filteredTables.length > 0 &&
      this.filteredTables.every((table) => !!this.selectedTableLookup[table.name]);
  }

  onTableSearchChange(): void {
    this.currentVisibleCount = this.tablePageSize;
    this.refreshVisibleTables();
  }

  loadMoreTables(): void {
    this.currentVisibleCount += this.tablePageSize;
    this.refreshVisibleTables();
  }

  getHistoryEligibleCount(): number {
    return this.selectedTables.filter((table) => table.sync_mode === 'history').length;
  }

  getNonHistorySelectedCount(): number {
    return this.selectedTables.filter((table) => table.sync_mode !== 'history').length;
  }

  isHistoryTable(table: DiscoverableTable): boolean {
    return this.resolveTableSyncMode(table) === 'history';
  }

  createJob(): void {
    if (!this.jobName) {
      alert('Please enter a job name');
      return;
    }
    
    this.syncSelectedTableModes();
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
      notification_email: this.notificationEmail.trim(),
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

  setSyncMode(mode: 'full' | 'incremental' | 'incremental_timestamp' | 'incremental_id' | 'incremental_cursor' | 'history'): void {
    this.syncMode = mode;
    this.syncSelectedTableModes();
  }

  trackByTableName(index: number, table: DiscoverableTable): string {
    return table.name;
  }

  getDisplayTableName(table: DiscoverableTable): string {
    const label = this.normalizeDisplayName(table.label || '');
    const rawName = this.normalizeDisplayName(this.getReadableTableName(table.name));

    if (label && rawName && label.toLowerCase() === rawName.toLowerCase()) {
      return label;
    }

    return label || rawName || table.name;
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

  private refreshVisibleTables(): void {
    const search = this.tableSearch.trim().toLowerCase();
    this.filteredTables = this.availableTables.filter((table) => {
      if (!search) {
        return true;
      }
      return (table.label || table.name).toLowerCase().includes(search) || table.name.toLowerCase().includes(search);
    });
    this.visibleTables = this.filteredTables.slice(0, this.currentVisibleCount);
  }

  private isHistorySupported(table: DiscoverableTable): boolean {
    if (typeof table.supports_history === 'boolean') {
      return table.supports_history;
    }
    return !!table.primary_key;
  }

  private resolveTableSyncMode(table: DiscoverableTable): 'full' | 'incremental' | 'history' {
    if (this.syncMode !== 'history') {
      return this.syncMode === 'incremental' ? 'incremental' : 'full';
    }
    if (this.isHistorySupported(table)) {
      return 'history';
    }
    if (table.cursor_field) {
      return 'incremental';
    }
    return 'full';
  }

  private syncSelectedTableModes(): void {
    this.selectedTables = this.selectedTables.map((selectedTable) => {
      const discoveredTable = this.availableTables.find((table) => table.name === selectedTable.source_table);
      if (!discoveredTable) {
        return selectedTable;
      }
      return {
        ...selectedTable,
        sync_mode: this.resolveTableSyncMode(discoveredTable)
      };
    });
  }

  private syncSelectedConnectorDetails(): void {
    if (this.selectedDestinationConnector) {
      const selectedDestination = this.destinationConnectors.find(
        (connector) => connector.hierarchy_id === this.selectedDestinationConnector
      );
      if (selectedDestination) {
        this.destinationSchema = selectedDestination.schema || 'public';
      }
    }
  }

  private getReadableTableName(value?: string): string {
    if (!value) {
      return '';
    }

    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return '';
    }

    const slashSegments = normalizedValue.split('/').filter(Boolean);
    const lastSlashSegment = slashSegments[slashSegments.length - 1];
    const finalSegment = lastSlashSegment || normalizedValue;
    const dotSegments = finalSegment.split('.').filter(Boolean);

    return dotSegments[dotSegments.length - 1] || finalSegment;
  }

  private normalizeDisplayName(value: string): string {
    const words = value
      .trim()
      .replace(/[_-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const collapsedWords = words.filter((word, index) => (
      index === 0 || word.toLowerCase() !== words[index - 1].toLowerCase()
    ));

    return collapsedWords.join(' ');
  }
}
