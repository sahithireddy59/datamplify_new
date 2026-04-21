import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DatasyncService, SyncJob } from '../datasync.service';

@Component({
  selector: 'app-datasync-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './datasync-schedule.component.html',
  styleUrl: './datasync-schedule.component.scss'
})
export class DatasyncScheduleComponent implements OnInit {
  jobId = '';
  job: SyncJob | null = null;
  syncFrequency: SyncJob['sync_frequency'] = 'manual';
  cronExpression = '';
  notificationEmail = '';
  loading = false;
  saving = false;
  error: string | null = null;

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

  loadJob(): void {
    this.loading = true;
    this.error = null;

    this.datasyncService.getJob(this.jobId).subscribe({
      next: (job) => {
        this.job = job;
        this.syncFrequency = job.sync_frequency;
        this.cronExpression = job.cron_expression || '';
        this.notificationEmail = job.notification_email || '';
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.detail || 'Failed to load sync job.';
      }
    });
  }

  saveSchedule(): void {
    if (!this.jobId) {
      return;
    }
    if (this.syncFrequency === 'custom' && !this.cronExpression.trim()) {
      this.error = 'Cron expression is required for custom scheduling.';
      return;
    }

    this.saving = true;
    this.error = null;

    this.datasyncService.updateJob(this.jobId, {
      sync_frequency: this.syncFrequency,
      cron_expression: this.syncFrequency === 'custom' ? this.cronExpression.trim() : '',
      notification_email: this.notificationEmail.trim()
    }).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/datamplify/sync', this.jobId]);
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.cron_expression || err.error?.detail || err.error?.error || JSON.stringify(err.error) || 'Failed to update schedule.';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/datamplify/sync', this.jobId]);
  }
}
