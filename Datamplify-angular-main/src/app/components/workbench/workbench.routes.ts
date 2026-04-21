import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from '../../auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard'
import { datasyncRoutes } from './datasync/datasync.routes';

export const admin: Routes = [

  {
    path: 'datamplify', children: [
      {
        path: 'users/users-list',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./users-dashboard/users-dashboard.component').then((m) => m.UsersDashboardComponent)
      },
      {
        path: 'users/add-user',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./users-dashboard/users-dashboard.component').then((m) => m.UsersDashboardComponent)
      },
      {
        path: 'users/edit-user/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./users-dashboard/users-dashboard.component').then((m) => m.UsersDashboardComponent)
      },
      {
        path: 'roles/roles-list',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./roles-dashboard/roles-dashboard.component').then((m) => m.RolesDashboardComponent)
      },
      {
        path: 'roles/add-role',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./roles-dashboard/roles-dashboard.component').then((m) => m.RolesDashboardComponent)
      },
      {
        path: 'dashboard/role-edit/:id1',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./roles-dashboard/roles-dashboard.component').then((m) => m.RolesDashboardComponent)
      },

      {
        path: 'update-password',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./update-password/update-password.component').then((m) => m.UpdatePasswordComponent),
      },

      {
        path: 'configure-page/configure',
        canActivate: [authGuard, permissionGuard(1)],
        loadComponent: () =>
          import('./configure/configure.component').then((m) => m.ConfigureComponent),
      },

      {
        path: 'easyConnection',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./easy-connection/easy-connection.component').then((m) => m.EasyConnectionComponent),
      },

      {
        path: 'easyConnection/integrations/:type',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./easy-connection/easy-connection.component').then((m) => m.EasyConnectionComponent),
      },

      {
        path: 'easyConnection/newConnection',
        canActivate: [authGuard, permissionGuard(22)],
        loadComponent: () =>
          import('./easy-connection/easy-connection.component').then((m) => m.EasyConnectionComponent),
      },

      {
        path: 'DagBoardList',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./flowboard-list/flowboard-list.component').then((m) => m.FlowboardListComponent),
      },
      
      {
        path: 'TaskRunPlanList',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./taskplan-list/taskplan-list.component').then((m) => m.TaskplanListComponent),
      },

      {
        path: 'monitorList',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./monitor-list/monitor-list.component').then((m) => m.MonitorListComponent),
      },

      {
        path: 'DagBoardList/DagBoard',
        canActivate: [authGuard, permissionGuard(10)],
        loadComponent: () =>
          import('./flowboard/flowboard.component').then((m) => m.FlowboardComponent),
      },

      {
        path: 'DagBoardList/DagBoard/:id1',
        canActivate: [authGuard, permissionGuard(9)],
        loadComponent: () =>
          import('./flowboard/flowboard.component').then((m) => m.FlowboardComponent),
      },

      {
        path: 'home/DagBoard/:id1',
        canActivate: [authGuard, permissionGuard(9)],
        loadComponent: () =>
          import('./flowboard/flowboard.component').then((m) => m.FlowboardComponent),
      },

      {
        path: 'TaskRunPlan/DagBoard/:id1',
        canActivate: [authGuard, permissionGuard(9)],
        loadComponent: () =>
          import('./flowboard/flowboard.component').then((m) => m.FlowboardComponent),
      },

      {
        path: 'monitor/DagBoard/:id1',
        canActivate: [authGuard, permissionGuard(9)],
        loadComponent: () =>
          import('./flowboard/flowboard.component').then((m) => m.FlowboardComponent),
      },

      {
        path: 'TaskRunPlanList/TaskRunPlan',
        canActivate: [authGuard, permissionGuard(16)],
        loadComponent: () =>
          import('./taskplan/taskplan.component').then((m) => m.TaskplanComponent),
      },

      {
        path: 'TaskRunPlanList/TaskRunPlan/:id1',
        canActivate: [authGuard, permissionGuard(15)],
        loadComponent: () =>
          import('./taskplan/taskplan.component').then((m) => m.TaskplanComponent),
      },

      {
        path: 'home/TaskRunPlan/:id1',
        canActivate: [authGuard, permissionGuard(15)],
        loadComponent: () =>
          import('./taskplan/taskplan.component').then((m) => m.TaskplanComponent),
      },

      {
        path: 'monitor/TaskRunPlan/:id1',
        canActivate: [authGuard, permissionGuard(15)],
        loadComponent: () =>
          import('./taskplan/taskplan.component').then((m) => m.TaskplanComponent),
      },

      {
        path: 'monitorList/monitor/:id1',
        canActivate: [authGuard, permissionGuard(29)],
        loadComponent: () =>
          import('./monitor/monitor.component').then((m) => m.MonitorComponent),
      },

      {
        path: 'home',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },

      {
        path: 'scheduler',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./scheduler/scheduler.component').then((m) => m.SchedulerComponent),
      },
      {
        path: 'unauthorized',
        loadComponent: () =>
          import('../workbench/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent)
      },
      {
        path: 'embed-sdk',
        loadComponent: () =>
          import('../workbench/embed-application/embed-application.component').then((m) => m.EmbedApplicationComponent)
      },
      {
        path: 'sync',
        canActivate: [authGuard],
        children: datasyncRoutes
      },
      {
        path: 'datasync',
        pathMatch: 'prefix',
        redirectTo: 'sync'
      },
    ]
  }
 ];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,RouterModule.forChild(admin),
  ],
  exports:[RouterModule]
})
export class WorkbenchModule { 
  static routes = admin;


}
