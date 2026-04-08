import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DatasyncService, SyncJob } from '../datasync.service';

@Component({
  selector: 'app-datasync-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './datasync-list.component.html',
  styleUrls: ['./datasync-list.component.scss']
})
export class DatasyncListComponent implements OnInit {
  syncJobs: SyncJob[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private datasyncService: DatasyncService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadSyncJobs();
  }

  loadSyncJobs(): void {
    this.loading = true;
    this.error = null;
    
    this.datasyncService.getJobs().subscribe({
      next: (response) => {
        this.syncJobs = response.results || response;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load sync jobs';
        this.loading = false;
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
      next: () => {
        alert('Sync triggered successfully');
        this.loadSyncJobs();
      },
      error: (err) => {
        alert('Failed to trigger sync: ' + (err.error?.message || err.message));
        console.error('Error triggering sync:', err);
      }
    });
  }

  pauseJob(job: SyncJob, event: Event): void {
    event.stopPropagation();
    
    if (!job.id) return;
    
    this.datasyncService.pauseJob(job.id).subscribe({
      next: () => {
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
      case 'active': return 'badge-success';
      case 'paused': return 'badge-warning';
      case 'error': return 'badge-danger';
      case 'configuring': return 'badge-info';
      default: return 'badge-secondary';
    }
  }

  formatDate(date?: string): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  }

  getNextSyncText(job: SyncJob): string {
    if (job.status === 'paused') return 'Paused';
    if (job.sync_frequency === 'manual') return 'Manual';
    if (job.next_sync_at) return this.formatDate(job.next_sync_at);
    return 'Not scheduled';
  }
}
