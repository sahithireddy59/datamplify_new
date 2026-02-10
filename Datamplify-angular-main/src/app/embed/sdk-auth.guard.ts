import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { EmbedAuthService } from '../shared/services/embed-auth.service';

export const sdkAuthGuard: CanActivateFn = async (route) => {
  const embedAuth = inject(EmbedAuthService);
  return embedAuth.isLoggedIn();
};
