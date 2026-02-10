// import { Injectable } from '@angular/core';
// import {  HttpInterceptor,  HttpRequest, HttpResponse, HttpHandler, HttpEvent,  HttpErrorResponse} from '@angular/common/http';
// import { Observable, throwError } from 'rxjs';
// import { map, catchError } from 'rxjs/operators';
// import { Router } from '@angular/router';
// import Swal from 'sweetalert2';
// import { AuthService } from './auth.service';
// import { EmbedAuthService } from './embed-auth.service';
// @Injectable({
//   providedIn: 'root'
// })
// export class HttpAuthService {

//   constructor(private authService:AuthService, private embedAuthService: EmbedAuthService) { }
//   private isLoggingOut = false;

//   intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
//     // const token: any = localStorage.getItem('currentUser');
//      return next.handle(request).pipe(
//          map((event: HttpEvent<any>) => {
//              if (event instanceof HttpResponse) {
//                  // console.log('event--->>>', event);
//                  // success
//              }
//              return event;
//          }),
//          catchError((error: HttpErrorResponse) => {
//              let data = {};
//              data = {
//                  reason: error && error.error.reason ? error.error.reason : '',
//                  status: error.status
//              };
//              const isEmbed = this.embedAuthService.isEmbedMode();

//              if (isEmbed) {
//                 console.warn('[EMBED] 401 received, skipping logout');
//                 return throwError(() => error);
//              }
//              if (error.error.message === 'Invalid Access Token' || error.error.message === 'Session Expired, Please login again' || error.error.message === 'Access token missing or invalid. Please log in again.') {
//                  if (!this.isLoggingOut && !isEmbed) { // Check if already logging out
//                      this.isLoggingOut = true;
//                      Swal.fire({
//                          icon: 'error',
//                          title: 'Oops...',
//                          text: 'Session Expired, Please Login!',
//                      });
//                      this.authService.logOut().subscribe(() => {
//                          this.isLoggingOut = false; // Reset flag after logout
//                      });;
//                  }
//                  if(isEmbed){
//                     if(this.embedAuthService.getEmbedType() === 'client'){
//                         this.embedAuthService.getAccessTokenFromSdk();
//                     }
//                  }
//              }
//              return throwError(error);
//          }));
//  }
// }



import { Injectable } from '@angular/core';
import {
    HttpInterceptor,
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpErrorResponse
} from '@angular/common/http';
import { EMPTY, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { AuthService } from './auth.service';
import { EmbedAuthService } from './embed-auth.service';

@Injectable({ providedIn: 'root' })
export class HttpAuthService implements HttpInterceptor {

    private isRefreshing = false;
    private isLoggingOut = false;

    constructor(
        private authService: AuthService,
        private embedAuthService: EmbedAuthService
    ) { }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(req).pipe(
            catchError((error: HttpErrorResponse) => {

                const isEmbed = this.embedAuthService.isEmbedMode();

                // Handle 401 in EMBED MODE
                if (error.status === 401 && isEmbed) {
                    return this.handleEmbed401(req, next);
                }

                // Normal app logout
                if (!isEmbed && this.isAuthError(error) && !this.isLoggingOut) {
                    this.isLoggingOut = true;
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Session Expired, Please Login!'
                    });

                    this.authService.logOut();
                }

                return throwError(() => error);
            })
        );
    }

    // ===============================
    // 🔁 EMBED TOKEN REFRESH + RETRY
    // ===============================
    private handleEmbed401(
        request: HttpRequest<any>,
        next: HttpHandler
    ): Observable<HttpEvent<any>> {

        if (!this.isRefreshing) {
            this.isRefreshing = true;
            this.embedAuthService.startRefresh();       // 🔐 invalidate token
            this.embedAuthService.requestTokenFromSdk(); // 🔑 request new token
        }

        return this.embedAuthService.tokenChanges$().pipe(
            filter(token => !!token),
            take(1),
            switchMap(() => {
                this.isRefreshing = false;
                const retryReq = this.attachToken(request);
                return next.handle(retryReq); // 🔁 REPLAY REQUEST
            })
        );
    }

    private attachToken(req: HttpRequest<any>) {
        const token = this.embedAuthService.isEmbedMode()
            ? this.embedAuthService.getToken()
            : JSON.parse(localStorage.getItem('currentUser') || '{}')?.Token;

        if (!token) return req;

        return req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        });
    }

    private isAuthError(error: HttpErrorResponse): boolean {
        return (
            error.error?.message === 'Invalid Access Token' ||
            error.error?.message === 'Session Expired, Please login again' ||
            error.error?.message === 'Access token missing or invalid. Please log in again.'
        );
    }
}