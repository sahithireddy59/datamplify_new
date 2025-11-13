import { Injectable } from '@angular/core';
import {  HttpInterceptor,  HttpRequest, HttpResponse, HttpHandler, HttpEvent,  HttpErrorResponse} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from './auth.service';
@Injectable({
  providedIn: 'root'
})
export class HttpAuthService {

  constructor(private authService:AuthService) { }
  private isLoggingOut = false; // Flag to prevent multiple logouts

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // const token: any = localStorage.getItem('currentUser');
     return next.handle(request).pipe(
         map((event: HttpEvent<any>) => {
             if (event instanceof HttpResponse) {
                 // console.log('event--->>>', event);
                 // success
             }
             return event;
         }),
         catchError((error: HttpErrorResponse) => {
             let data = {};
             data = {
                 reason: error && error.error.reason ? error.error.reason : '',
                 status: error.status
             };
             if (error.error.message === 'Invalid Access Token' || error.error.message === 'Session Expired, Please login again') {
                if (!this.isLoggingOut) { // Check if already logging out
                    this.isLoggingOut = true; 
                     Swal.fire({
                         icon: 'error',
                         title: 'Oops...',
                         text: 'Session Expired, Please Login!',
                         
                     })

             this.authService.logOut().subscribe(() => {
                this.isLoggingOut = false; // Reset flag after logout
              });;
             }
            }
             return throwError(error);
         }));
 }
}
