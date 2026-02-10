import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { EmbedAuthService } from './shared/services/embed-auth.service';
export const authGuard: CanActivateFn = (route, state) => {

  const _router = inject(Router);
  const embedAuth = inject(EmbedAuthService);
  const isEmbedRoute = state.url.startsWith('/embed') || window.location.pathname.startsWith('/embed');
  if (isEmbedRoute) {
    return embedAuth.isLoggedIn();
  }
  
  const currentUser = localStorage.getItem( 'currentUser' );

  if(currentUser){
    return true;
  }
  _router.navigate(['authentication/login'])
  return false;
};
