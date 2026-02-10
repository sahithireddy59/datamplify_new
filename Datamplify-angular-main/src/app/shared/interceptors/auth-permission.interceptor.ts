import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { EMPTY, Observable, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { PermissionService } from '../../services/permission.service';
import { ToastrService } from 'ngx-toastr';
import { NavigationService } from '../services/navigation.service';
import { EmbedAuthService } from '../services/embed-auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AuthPermissionInterceptor implements HttpInterceptor {

    constructor(private router: Router, private permissionService: PermissionService, private toasterService: ToastrService, private navigationService: NavigationService, private embedAuthService: EmbedAuthService) {
    }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        let accessToken: string | null = null;
        const isEmbedMode = this.embedAuthService.isEmbedMode();
        if (isEmbedMode) {
            accessToken = this.embedAuthService.getToken();
        } else {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            accessToken = user?.Token;
        }
        const airflowToken = localStorage.getItem('airflowToken') ?? '';

        //Define endpoints that DON'T require authentication
        const publicEndpoints = [
            '/authentication/login/',
            '/authentication/signup/',
            '/authentication/activate_account/',
            '/authentication/reset_password/',
            '/authentication/reset_password/confirm',
            '/authentication/re_activation/',
            '/authentication/resendotp/',
            '/authentication/invite/password/',
            '/monitor/airflow_token/'
        ];

        //Skip auth/permission checks for public APIs
        const isPublic = publicEndpoints.some((url) => req.url.includes(url));
        if (isPublic) {
            return next.handle(req);
        }

        const isAirflowApi = req.url.startsWith(environment.airflowApiUrl);

        // const isAirflowApi = req.url.includes('/api/v2/') || req.url.includes('/ui/grid/') || req.url.includes('/ui/dags/') || req.url.includes('/monitor/airflow_token/');

        /**Block if user not logged in */
        if (!accessToken && !isAirflowApi) {
            console.warn('Blocked API call — no token found');
            this.navigationService.navigate(['datamplify','unauthorized'], { replaceUrl: true });
            this.toasterService.error('Unauthorized access — no token found.', 'Access Denied', { positionClass: 'toast-top-right' });
            return EMPTY;
        }

        /**Validate permission before allowing request */
        if (!isAirflowApi) {
            const endpointPermissions = [
                // 🔹 Connections
                { url: '/connections/Connection_list/', method: 'GET', id: 21 },
                { url: '/connections/Database_connection/', method: 'POST', id: 22 },
                { url: '/connections/File_connection/', method: 'POST', id: 22 },
                { url: '/connections/Database_connection/', method: 'PUT', id: 23 },
                { url: '/connections/File_connection/', method: 'PUT', id: 23 },
                { url: '/connections/Database_connection/', method: 'DELETE', id: 24 },
                { url: '/connections/File_connection/', method: 'DELETE', id: 24 },

                // 🔹 Flowboard
                { url: '/flowboard/flow/', method: 'POST', id: 10 },
                { url: '/flowboard/flow/', method: 'PUT', id: 11 },
                { url: '/flowboard/flow/', method: 'GET', id: 9 },
                { url: '/flowboard/flow/', method: 'DELETE', id: 12 },

                // 🔹 TaskPlan
                { url: '/taskplan/task/', method: 'POST', id: 16 },
                { url: '/taskplan/task/', method: 'PUT', id: 17 },
                { url: '/taskplan/task/', method: 'GET', id: 15 },
                { url: '/taskplan/task/', method: 'DELETE', id: 18 },

                { url: '/monitor/Trigger/', method: 'POST', ids: [13, 19] },

                // 🔹 Scheduler
                { url: '/schedule/schedule', method: 'GET', id: 25 },
                { url: '/schedule/schedule', method: 'POST', id: 26 },
                { url: '/schedule/schedule_update/', method: 'PUT', id: 27 },
                { url: '/schedule/schedule_update/', method: 'DELETE', id: 28 },

                // 🔹 Monitor
                { url: '/monitor/kpi_values/', method: 'GET', id: 29 },
                { url: '/monitor/rescent_runs/', method: 'GET', id: 29 }
            ];

            //Find matching endpoint rule
            const matchedRule = endpointPermissions.find(
                rule => req.url.includes(rule.url) && req.method === rule.method
            );

            if (matchedRule) {
                const idsToCheck = Array.isArray(matchedRule.ids)
                    ? matchedRule.ids
                    : [matchedRule.id] as any[];

                const hasPermission = this.permissionService.hasAny(idsToCheck);

                if (!hasPermission) {
                    console.warn(`Forbidden API: Missing permission(s) [${idsToCheck.join(', ')}]`);
                    this.navigationService.navigate(['datamplify','unauthorized'], { replaceUrl: true });
                    this.toasterService.error('Forbidden — insufficient permissions', 'Access Denied', { positionClass: 'toast-top-right' });
                    return EMPTY;
                }
            }
        }

        let authReq = req;
        if (isAirflowApi) {
            //Use Airflow token for Airflow APIs
            if (airflowToken) {
                authReq = req.clone({
                    setHeaders: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${airflowToken}`
                    }
                });
            }
        } else {
            //Use normal app access token for all other APIs
            if (!accessToken) {
                return EMPTY;
            }
            authReq = req.clone({
                setHeaders: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`
                }
            });
        }

        return next.handle(authReq);
    }
}