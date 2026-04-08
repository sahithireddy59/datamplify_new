import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DatasyncService, SyncJob, SyncRun } from '../datasync.service';

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
    private readonly datasyncService: DatasyncService
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
    this.loading = true;
    this.error = null;

    this.datasyncService.getJob(this.jobId).subscribe({
      next: (job) => {
        this.job = job;
        this.loadRuns();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.detail || 'Failed to load sync job.';
      }
    });
  }

  loadRuns(): void {
    this.datasyncService.getJobRuns(this.jobId).subscribe({
      next: (runs) => {
        this.runs = runs.results || runs;
        this.loading = false;
        if (this.runs.length > 0) {
          const activeSelectedRun = this.selectedRun?.id
            ? this.runs.find((run) => run.id === this.selectedRun?.id)
            : null;
          this.selectRun(activeSelectedRun || this.runs[0]);
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load sync runs.';
      }
    });
  }

  selectRun(run: SyncRun): void {
    this.selectedRun = run;
    if (!run.id) {
      this.selectedRunLogs = [];
      return;
    }

    this.loadingLogs = true;
    this.datasyncService.getRunLogs(run.id).subscribe({
      next: (logs) => {
        this.selectedRunLogs = logs.results || logs;
        this.loadingLogs = false;
        this.configureAutoRefresh();
      },
      error: () => {
        this.selectedRunLogs = [];
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
      next: () => {
        this.loadJob();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to trigger sync.';
      }
    });
  }

  cancelSelectedRun(): void {
    if (!this.selectedRun?.id || !['pending', 'running'].includes(this.selectedRun.status)) {
      return;
    }

    this.datasyncService.cancelRun(this.selectedRun.id).subscribe({
      next: () => {
        this.loadJob();
      },
      error: (err) => {
        this.error = err.error?.message || err.error?.error || 'Failed to cancel sync run.';
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

  formatDate(value?: string): string {
    if (!value) {
      return 'Never';
    }
    return new Date(value).toLocaleString();
  }

  refreshSelectedRun(): void {
    if (!this.selectedRun?.id) {
      return;
    }
    this.loadRuns();
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
    this.refreshTimer = setInterval(() => this.loadRuns(), 5000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
