import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { PermissionService } from '../../services/permission.service';
import { NavigationService } from '../services/navigation.service';

export const permissionGuard = (permissionId: number) => {
  return () => {
    const router = inject(Router);
    const permissionService = inject(PermissionService);
    const navigationService = inject(NavigationService);

    // If permissionId not provided → allow route
    if (!permissionId) return true;

    // Check permission
    const hasPermission = permissionService.hasPermission(permissionId);

    if (hasPermission) {
      return true;
    } else {
      // Redirect to unauthorized page
      // return router.parseUrl('/datamplify/unauthorized');
      console.log('dgfhjkgfdsa')
      navigationService.navigate(['datamplify','unauthorized'], { replaceUrl: true });
      return false;
    }
  };
};