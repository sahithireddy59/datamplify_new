import { RouterModule, Routes } from '@angular/router';
import { admin, authenticationRoutingModule } from '../../components/authentication/authentication.routes';
import { NgModule } from '@angular/core';
import { errorRoutingModule } from '../../components/authentication/error-pages/error.routes';

export const authen: Routes = [
    { path: '', children: [
        ...authenticationRoutingModule.routes,
        ...errorRoutingModule.routes
 ] },
 

 
]
@NgModule({
    imports: [RouterModule.forRoot(admin)],
    exports: [RouterModule]
})
export class SaredRoutingModule { }