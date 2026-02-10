import { Injectable } from '@angular/core';
import {
    HttpInterceptor,
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpErrorResponse
} from '@angular/common/http';
import { EMPTY, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { NavigationService } from '../services/navigation.service';

@Injectable({
    providedIn: 'root'
})
export class MaintenanceInterceptor implements HttpInterceptor {

    constructor( private router: Router, private toastr: ToastrService, private navigationService: NavigationService) { 
    }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(req).pipe(
            catchError((error: HttpErrorResponse) => {
                // ✅ Detect network or backend errors
                console.log(error);
                const isNetworkError = error.status === 0 && error.error instanceof ProgressEvent;
                const isMaintenance = error.status === 503 || error.status === 0 || isNetworkError;

                if (isMaintenance) {
                    console.error('Backend unavailable or under maintenance', error);

                    // ✅ Redirect to maintenance page
                    this.navigationService.navigate(['authentication','under-maintenance'], { replaceUrl: true });

                    // ✅ Optional toast (only once)
                    this.toastr.warning('Our servers are currently under maintenance. Please try again later.','Service Unavailable',{ positionClass: 'toast-top-right' });

                    // Prevent further error propagation
                    return EMPTY;
                }

                // Pass through other errors
                return throwError(() => error);
            })
        );
    }
}