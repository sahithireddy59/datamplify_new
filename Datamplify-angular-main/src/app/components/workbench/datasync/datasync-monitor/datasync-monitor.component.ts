import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { DatasyncService, SyncJob, SyncRun } from '../datasync.service';
import { WorkbenchService } from '../../workbench.service';

@Component({
  selector: 'app-datasync-monitor',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './datasync-monitor.component.html',
  styleUrl: './datasync-monitor.component.scss'
})
export class DatasyncMonitorComponent implements OnInit, OnDestroy {
  jobId = '';
  job: SyncJob | null = null;
  runs: SyncRun[] = [];
  selectedRun: SyncRun | null = null;
  selectedRunLogs: any[] = [];
  loading = false;
  loadingLogs = false;
  error: string | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly datasyncService: DatasyncService,
    private readonly workbenchService: WorkbenchService
  ) {}

  ngOnInit(): void {
    this.jobId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.jobId) {
      this.error = 'Sync job id is missing.';
      return;
    }
    this.loadJob();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadJob(): void {
    this.loadJobInternal(true);
  }

  private loadJobInternal(showLoader: boolean): void {
    if (showLoader) {
      this.loading = true;
      this.error = null;
    } else {
      this.workbenchService.disableLoaderForNextRequest();
    }

    this.datasyncService.getJob(this.jobId).subscribe({
      next: (job) => {
        this.job = job;
        this.loadRuns(showLoader);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.detail || 'Failed to load sync job.';
      }
    });
  }

  loadRuns(showLoader: boolean = true): void {
    if (!showLoader) {
      this.workbenchService.disableLoaderForNextRequest();
    }
    this.datasyncService.getJobRuns(this.jobId).subscribe({
      next: (runs) => {
        this.runs = runs.results || runs;
        this.loading = false;
        if (this.runs.length > 0) {
          const activeSelectedRun = this.selectedRun?.id
            ? this.runs.find((run) => run.id === this.selectedRun?.id)
            : null;
          this.selectRun(activeSelectedRun || this.runs[0], showLoader);
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load sync runs.';
      }
    });
  }

  selectRun(run: SyncRun, showLogLoader: boolean = true): void {
    this.selectedRun = run;
    if (!run.id) {
      this.selectedRunLogs = [];
      return;
    }

    if (showLogLoader) {
      this.loadingLogs = true;
    } else {
      this.workbenchService.disableLoaderForNextRequest();
    }
    forkJoin({
      run: this.datasyncService.getRun(run.id),
      logs: this.datasyncService.getRunLogs(run.id)
    }).subscribe({
      next: ({ run: runDetails, logs }) => {
        this.selectedRun = {
          ...run,
          ...runDetails,
        };
        this.selectedRunLogs = this.buildDisplayedLogs(runDetails, logs.results || logs);
        this.loadingLogs = false;
        this.configureAutoRefresh();
      },
      error: () => {
        this.selectedRunLogs = this.buildDisplayedLogs(run, []);
        this.loadingLogs = false;
        this.error = 'Failed to load run logs.';
        this.configureAutoRefresh();
      }
    });
  }

  triggerSync(): void {
    if (!this.job?.id) {
      return;
    }

    this.datasyncService.triggerSync(this.job.id).subscribe({
      next: (response) => {
        if (this.job) {
          this.job.current_run_id = response?.run_id || this.job.current_run_id;
          this.job.current_run_status = 'pending';
          this.job.display_status = 'pending';
        }
        this.loadJob();
      },
      error: (err) => {
        this.error = err.error?.error || err.error?.message || 'Failed to start manual run.';
      }
    });
  }

  cancelSelectedRun(): void {
    if (!this.selectedRun?.id || !['pending', 'running'].includes(this.selectedRun.status)) {
      return;
    }

    this.datasyncService.cancelRun(this.selectedRun.id).subscribe({
      next: () => {
        if (this.selectedRun) {
          this.selectedRun.status = 'cancelled';
        }
        if (this.job) {
          this.job.current_run_status = undefined;
          this.job.display_status = this.job.status === 'paused' ? 'paused' : 'active';
          this.job.status = this.job.status === 'paused' ? 'paused' : 'active';
        }
        this.stopAutoRefresh();
        this.loadJob();
      },
      error: (err) => {
        this.error = err.error?.error || err.error?.message || 'Failed to cancel selected run.';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/datamplify/sync']);
  }

  createNewJob(): void {
    this.router.navigate(['/datamplify/sync/create']);
  }

  editSchedule(): void {
    if (!this.jobId) {
      return;
    }
    this.router.navigate(['/datamplify/sync', this.jobId, 'schedule']);
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'active':
      case 'success':
        return 'badge-success';
      case 'running':
        return 'badge-primary';
      case 'paused':
      case 'pending':
        return 'badge-warning';
      case 'partial_success':
        return 'badge-info';
      case 'error':
      case 'failed':
      case 'cancelled':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  getJobDisplayStatus(): string {
    return this.job?.display_status || this.job?.current_run_status || this.job?.status || 'unknown';
  }

  isJobRunInProgress(): boolean {
    const status = this.getJobDisplayStatus();
    return status === 'pending' || status === 'running';
  }

  formatDate(value?: string): string {
    if (!value) {
      return 'Never';
    }
    return new Date(value).toLocaleString();
  }

  formatLogDetails(details: any): string {
    if (!details) {
      return '';
    }
    if (typeof details === 'string') {
      return details;
    }
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  }

  refreshSelectedRun(): void {
    if (!this.selectedRun?.id) {
      return;
    }
    this.loadRuns(false);
  }

  private configureAutoRefresh(): void {
    const shouldRefresh = this.selectedRun?.status === 'running' || this.selectedRun?.status === 'pending';
    if (!shouldRefresh) {
      this.stopAutoRefresh();
      return;
    }
    if (this.refreshTimer) {
      return;
    }
    this.refreshTimer = setInterval(() => this.pollSelectedRunStatus(), 5000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private pollSelectedRunStatus(): void {
    if (!this.selectedRun?.id) {
      this.stopAutoRefresh();
      return;
    }

    this.workbenchService.disableLoaderForNextRequest();
    this.datasyncService.getRun(this.selectedRun.id).subscribe({
      next: (run) => {
        this.selectedRun = {
          ...this.selectedRun!,
          ...run,
        };
        this.selectedRunLogs = this.buildDisplayedLogs(run, this.selectedRunLogs);

        this.runs = this.runs.map((existingRun) =>
          existingRun.id === run.id ? { ...existingRun, ...run } : existingRun
        );

        if (this.job) {
          if (run.status === 'pending' || run.status === 'running') {
            this.job.current_run_id = run.id;
            this.job.current_run_status = run.status;
            this.job.display_status = run.status;
            this.job.status = 'running';
          } else {
            this.job.current_run_status = undefined;
            this.job.display_status = this.job.status === 'paused' ? 'paused' : 'active';
            if (this.job.status !== 'paused' && this.job.status !== 'error') {
              this.job.status = 'active';
            }
            this.stopAutoRefresh();
          }
        }
      },
      error: () => {
        this.stopAutoRefresh();
      }
    });
  }

  private buildDisplayedLogs(run: SyncRun, logs: any[]): any[] {
    const normalizedLogs = Array.isArray(logs) ? [...logs] : [];

    if (normalizedLogs.length > 0) {
      return normalizedLogs;
    }

    const fallbackLogs: any[] = [];
    if (run.error_message) {
      fallbackLogs.push({
        level: 'error',
        message: run.error_message,
        details: run.error_details,
        timestamp: run.completed_at || run.created_at
      });
    } else if (run.status === 'success') {
      fallbackLogs.push({
        level: 'info',
        message: 'Run completed successfully.',
        details: {
          tables_synced: run.tables_synced,
          rows_inserted: run.rows_inserted,
          rows_updated: run.rows_updated,
          rows_deleted: run.rows_deleted,
          rows_failed: run.rows_failed
        },
        timestamp: run.completed_at || run.created_at
      });
    }

    return fallbackLogs;
  }
}
