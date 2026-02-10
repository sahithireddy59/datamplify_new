import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

export const admin: Routes = [
 {path:'authentication',children:[ 
   {
     path: 'login',
     loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
   },
   {
     path: 'register',
    loadComponent: () =>
      import('./register/register.component').then((m) => m.RegisterComponent),
  }, 
  {
    path: 'lock-screen',
    loadComponent: () =>
      import('./lock-screen/lock-screen.component').then((m) => m.LockScreenComponent),
  }, 
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password/:token',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },  
  {
    path: 'under-maintenance',
    loadComponent: () =>
      import('./under-maintainance/under-maintainance.component').then((m) => m.UnderMaintainanceComponent),
  },
  {
    path: 'email-activation/:token',
    loadComponent: () =>
      import('./email-activation/email-activation.component').then((m) => m.EmailActivationComponent),
  },
  {
    path: 'email-reactivation',
    loadComponent: () =>
      import('./email-reactivation/email-reactivation.component').then((m) => m.EmailReactivationComponent),
  },
  {
    path: 'set-password/:token',
    loadComponent: () =>
      import('./set-password/set-password.component').then((m) => m.SetPasswordComponent),
  }
]}
];
@NgModule({
  imports: [RouterModule.forChild(admin),HttpClientModule],
  exports: [RouterModule],
})
export class authenticationRoutingModule {
  static routes = admin;
}