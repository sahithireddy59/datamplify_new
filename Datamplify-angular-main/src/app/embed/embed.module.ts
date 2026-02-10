import { NgModule } from '@angular/core';
import { Router, RouterModule, Routes } from '@angular/router';
import { workbench } from '../shared/routes/workbenckroutes';
import { sdkAuthGuard } from './sdk-auth.guard';
import { EmbedLayoutComponent } from '../shared/layout-components/layouts/embed-layout/embed-layout.component';
import { DashboardComponent } from '../components/workbench/dashboard/dashboard.component';
import { admin } from '../components/workbench/workbench.routes';

const datamplify = admin.find(r => r.path === 'datamplify');

const routes: Routes = [
  { 
    path: '',
    canActivate: [sdkAuthGuard],
    component: EmbedLayoutComponent,
    children: [
      {
        path: 'datamplify',
        children: datamplify?.children ?? []
      },
      { path: '', redirectTo: 'datamplify/home', pathMatch: 'full' },
    ]
  }
];

@NgModule({
  imports: [ EmbedLayoutComponent, RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EmbedModule {

  constructor(router: Router) {
    console.log("EmbedModule Loaded. Current URL:", router.url);
  }
}

