import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { LoaderService } from './loader.service';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { WorkbenchService } from '../../components/workbench/workbench.service';

@Injectable({
  providedIn: 'root'
  })
  export class HttpInterceptorService implements HttpInterceptor {

  constructor(private loaderService: LoaderService,private zone: NgZone, private apiService:WorkbenchService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const skipLoader = this.apiService.shouldSkipLoader();

    // console.log('Interceptor: show loader');
    if (!skipLoader) {
    this.zone.run(() => this.loaderService.show());
    }

    return next.handle(req).pipe(
      finalize(() => {
        // console.log('Interceptor: hide loader');
        if (!skipLoader) {
        this.zone.run(() => this.loaderService.hide());
        }
        this.apiService.resetSkipLoader(); // Reset the flag after request
      })
    );
  }
  
}

// export const HttpInterceptorService: HttpInterceptorFn = (req,next) => {}