import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { DatasyncService, SyncJob, SyncRun } from '../datasync.service';
import { WorkbenchService } from '../../workbench.service';

@Component({
  selector: 'app-datasync-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './datasync-list.component.html',
  styleUrl: './datasync-list.component.scss'
})
export class DatasyncListComponent implements OnInit, OnDestroy {
  syncJobs: SyncJob[] = [];
  loading = false;
  error: string | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private trackedRuns: Record<string, { runId: string; status: SyncRun['status'] }> = {};

  constructor(
    private datasyncService: DatasyncService,
    private router: Router,
    private workbenchService: WorkbenchService
  ) { }

  ngOnInit(): void {
    const cachedJobs = this.datasyncService.getCachedJobs();
    if (cachedJobs && cachedJobs.length > 0) {
      this.syncJobs = cachedJobs;
      this.loading = false;
      this.loadSyncJobsInternal(false);
      return;
    }
    this.loadSyncJobs();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadSyncJobs(): void {
    this.loadSyncJobsInternal(true);
  }

  private loadSyncJobsInternal(showLoader: boolean): void {
    if (showLoader) {
      this.loading = true;
      this.error = null;
    } else {
      this.workbenchService.disableLoaderForNextRequest();
    }
    
    this.datasyncService.getJobs().subscribe({
      next: (response) => {
        this.syncJobs = response.results || response;
        this.datasyncService.setCachedJobs(this.syncJobs);
        this.loading = false;
        this.applyTrackedRunStates();
        this.syncTrackedRuns();
      },
      error: (err) => {
        this.error = 'Failed to load sync jobs';
        this.loading = false;
        this.stopAutoRefresh();
        console.error('Error loading sync jobs:', err);
      }
    });
  }

  createNewJob(): void {
    this.router.navigate(['/datamplify/sync/create']);
  }

  viewJob(job: SyncJob): void {
    this.router.navigate(['/datamplify/sync', job.id]);
  }

  editSchedule(job: SyncJob, event: Event): void {
    event.stopPropagation();
    if (!job.id) return;
    this.router.navigate(['/datamplify/sync', job.id, 'schedule']);
  }

  triggerSync(job: SyncJob, event: Event): void {
    event.stopPropagation();
    
    if (!job.id) return;
    
    this.datasyncService.triggerSync(job.id).subscribe({
      next: (response) => {
        this.datasyncService.clearJobsCache();
        if (response?.run_id) {
          this.trackedRuns[job.id!] = {
            runId: response.run_id,
            status: 'pending'
          };
        }
        job.current_run_id = response?.run_id || job.current_run_id;
        job.current_run_status = 'pending';
        job.display_status = 'pending';
        this.configureAutoRefresh();
        alert('Manual run started successfully');
        this.loadSyncJobs();
      },
      error: (err) => {
        alert('Failed to start manual run: ' + (err.error?.error || err.error?.message || err.message));
        console.error('Error triggering sync:', err);
      }
    });
  }

  pauseJob(job: SyncJob, event: Event): void {
    event.stopPropagation();
    
    if (!job.id) return;
    
    this.datasyncService.pauseJob(job.id).subscribe({
      next: () => {
        this.datasyncService.clearJobsCache();
        alert('Job paused. Scheduled runs are paused, but you can still start a manual run.');
        this.loadSyncJobs();
      },
      error: (err) => {
        alert('Failed to pause job');
        console.error('Error pausing job:', err);
      }
    });
  }

  activateJob(job: SyncJob, event: Event): void {
    event.stopPropagation();
    
    if (!job.id) return;
    
    this.datasyncService.activateJob(job.id).subscribe({
      next: () => {
        this.datasyncService.clearJobsCache();
        alert('Job activated. Scheduled runs can resume.');
        this.loadSyncJobs();
      },
      error: (err) => {
        alert('Failed to activate job');
        console.error('Error activating job:', err);
      }
    });
  }

  deleteJob(job: SyncJob, event: Event): void {
    event.stopPropagation();
    
    if (!job.id) return;
    
    if (confirm(`Are you sure you want to delete "${job.name}"?`)) {
      this.datasyncService.deleteJob(job.id).subscribe({
        next: () => {
          this.datasyncService.clearJobsCache();
          this.loadSyncJobs();
        },
        error: (err) => {
          alert('Failed to delete job');
          console.error('Error deleting job:', err);
        }
      });
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'running': return 'badge-primary';
      case 'pending': return 'badge-warning';
      case 'active': return 'badge-success';
      case 'success': return 'badge-success';
      case 'paused': return 'badge-warning';
      case 'partial_success': return 'badge-info';
      case 'error': return 'badge-danger';
      case 'failed': return 'badge-danger';
      case 'cancelled': return 'badge-danger';
      case 'configuring': return 'badge-info';
      default: return 'badge-secondary';
    }
  }

  getDisplayStatus(job: SyncJob): string {
    return job.display_status || job.current_run_status || job.status || 'unknown';
  }

  isRunInProgress(job: SyncJob): boolean {
    const status = this.getDisplayStatus(job);
    return status === 'pending' || status === 'running';
  }

  formatDate(date?: string): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  }

  getNextSyncText(job: SyncJob): string {
    if (this.isRunInProgress(job)) return 'Run in progress';
    if (job.status === 'paused') return 'Paused';
    if (job.sync_frequency === 'manual') return 'Manual';
    if (job.next_sync_at) return this.formatDate(job.next_sync_at);
    return 'Not scheduled';
  }

  private configureAutoRefresh(): void {
    const hasTrackedRun = Object.keys(this.trackedRuns).length > 0;
    if (!hasTrackedRun) {
      this.stopAutoRefresh();
      return;
    }
    if (this.refreshTimer) {
      return;
    }
    this.refreshTimer = setInterval(() => this.loadSyncJobsInternal(false), 5000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private syncTrackedRuns(): void {
    const trackedEntries = Object.entries(this.trackedRuns);
    if (trackedEntries.length === 0) {
      this.configureAutoRefresh();
      return;
    }

    forkJoin(
      trackedEntries.map(([jobId, trackedRun]) => {
        this.workbenchService.disableLoaderForNextRequest();
        return this.datasyncService.getRun(trackedRun.runId);
      })
    ).subscribe({
      next: (runs) => {
        runs.forEach((run, index) => {
          const [jobId] = trackedEntries[index];
          this.trackedRuns[jobId].status = run.status;
          if (!['pending', 'running'].includes(run.status)) {
            delete this.trackedRuns[jobId];
          }
        });
        this.applyTrackedRunStates();
        this.configureAutoRefresh();
      },
      error: () => {
        this.applyTrackedRunStates();
        this.configureAutoRefresh();
      }
    });
  }

  private applyTrackedRunStates(): void {
    this.syncJobs = this.syncJobs.map((job) => {
      if (!job.id) {
        return job;
      }

      const trackedRun = this.trackedRuns[job.id];
      if (!trackedRun) {
        return job;
      }

      return {
        ...job,
        current_run_id: trackedRun.runId,
        current_run_status: trackedRun.status,
        display_status: trackedRun.status,
      };
    });
  }
}
