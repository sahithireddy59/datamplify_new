import { Routes } from '@angular/router';
import { DatasyncListComponent } from './datasync-list/datasync-list.component';
import { DatasyncCreateComponent } from './datasync-create/datasync-create.component';
import { DatasyncMonitorComponent } from './datasync-monitor/datasync-monitor.component';
import { DatasyncScheduleComponent } from './datasync-schedule/datasync-schedule.component';

export const datasyncRoutes: Routes = [
  {
    path: '',
    component: DatasyncListComponent
  },
  {
    path: 'create',
    component: DatasyncCreateComponent
  },
  {
    path: ':id/schedule',
    component: DatasyncScheduleComponent
  },
  {
    path: ':id',
    component: DatasyncMonitorComponent
  }
];
