import { Route } from '@angular/router';
import { AuthenticationLayoutComponent } from './shared/layout-components/layouts/authentication-layout/authentication-layout.component';
import { authen } from './shared/routes/authenticationroutes';
import { workbench } from './shared/routes/workbenckroutes';
import { WorkbenchLayoutsComponent } from './shared/layout-components/layouts/workbench-layouts/workbench-layouts.component';
export const App_Route: Route[] = [
      {
        path: 'embed',
        loadChildren: () => import('../app/embed/embed.module').then(m => m.EmbedModule)
      },
      {
        path: 'workbench',
        component: WorkbenchLayoutsComponent,
        children: [
          { path: '', redirectTo: 'sync', pathMatch: 'full' },
          {
            path: 'sync',
            loadChildren: () => import('./components/workbench/datasync/datasync.routes').then((m) => m.datasyncRoutes)
          },
          {
            path: 'datasync',
            loadChildren: () => import('./components/workbench/datasync/datasync.routes').then((m) => m.datasyncRoutes)
          }
        ]
      },
      { path: '', redirectTo: 'authentication/login', pathMatch: 'full' },
      // {
      //   path: '',
      //   loadComponent: () => import('../app/components/authentication/login/login.component').then((m) => m.LoginComponent),
      // },
      { path: '', component: AuthenticationLayoutComponent, children: authen },
      { path: '', component: WorkbenchLayoutsComponent, children: workbench },
    ]
