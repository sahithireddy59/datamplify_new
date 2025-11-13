import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
export const authGuard: CanActivateFn = (route, state) => {

  const _router = inject(Router);
  // let isLoggedIn = sessionStorage.getItem("isLoggedIn")
  const currentUser = localStorage.getItem( 'currentUser' );

  if(currentUser){
    return true;
  }
  _router.navigate(['authentication/login'])
  return false;
};
