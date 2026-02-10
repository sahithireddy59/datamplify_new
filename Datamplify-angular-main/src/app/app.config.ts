// import { ApplicationConfig, importProvidersFrom } from '@angular/core';
// import { RouterOutlet, provideRouter } from '@angular/router';
// import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations'
// import { BrowserModule } from '@angular/platform-browser'
// import { NoopAnimationsModule } from '@angular/platform-browser/animations'

// import { App_Route } from './app.routes';
// import { ColorPickerModule, ColorPickerService } from 'ngx-color-picker';
// import { CalendarModule, DateAdapter } from 'angular-calendar';
// import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
// import { AngularFireModule } from '@angular/fire/compat';
// import { environment } from '../environments/environment';
// import { AngularFireAuthModule } from '@angular/fire/compat/auth';
// import { AngularFireDatabaseModule } from '@angular/fire/compat/database';
// import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
// import { ToastrModule } from 'ngx-toastr';
// import { HTTP_INTERCEPTORS, HttpClientModule, provideHttpClient, withFetch, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
// import { LoaderService } from './shared/services/loader.service';
// import { HttpInterceptorService } from './shared/services/http-interceptor.service';
// import { HttpAuthService } from './shared/services/http-auth.service';
// import { AuthPermissionInterceptor } from './shared/interceptors/auth-permission.interceptor';
// import { MaintenanceInterceptor } from './shared/interceptors/maintenance.interceptor';

// export const appConfig: ApplicationConfig = {
//   providers: [provideRouter(App_Route),RouterOutlet,ColorPickerModule,ColorPickerService,provideAnimations(),  AngularFireModule,
//     provideHttpClient(),
//     HttpClientModule,
//     LoaderService,
//     provideHttpClient(withFetch(),withInterceptorsFromDi()),
//     {
//       provide: HTTP_INTERCEPTORS,
//       useClass: HttpInterceptorService,
//       multi: true
//     },
//     { provide: HTTP_INTERCEPTORS, useClass: HttpAuthService,multi: true},
//     { provide: HTTP_INTERCEPTORS, useClass: AuthPermissionInterceptor, multi: true },
//     { provide: HTTP_INTERCEPTORS, useClass: MaintenanceInterceptor, multi: true },
//     importProvidersFrom(HttpClientModule),
//   importProvidersFrom(CalendarModule.forRoot({
//     provide: DateAdapter,
//     useFactory: adapterFactory,
//   }),
//    AngularFireModule.initializeApp(environment.firebase),
//     ToastrModule.forRoot({
//     timeOut: 15000, // 15 seconds
//     closeButton: true,
//     progressBar: true,
//   }),
//  ),
//   // {
//   //   provide: HTTP_INTERCEPTORS,
//   //   useClass: HttpInterceptorService,
//   //   multi: true
//   // },
//   // { provide: HTTP_INTERCEPTORS, useClass: HttpAuthService,multi: true},
// ]
// };

import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, HttpClientModule, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { ToastrModule } from 'ngx-toastr';
import { ColorPickerModule, ColorPickerService } from 'ngx-color-picker';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { AngularFireModule } from '@angular/fire/compat';
import { environment } from '../environments/environment';
import { LoaderService } from './shared/services/loader.service';

// Interceptors
import { HttpInterceptorService } from './shared/services/http-interceptor.service';
import { HttpAuthService } from './shared/services/http-auth.service';
import { AuthPermissionInterceptor } from './shared/interceptors/auth-permission.interceptor';
import { MaintenanceInterceptor } from './shared/interceptors/maintenance.interceptor';

// Routes
import { App_Route } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(App_Route),
    RouterOutlet,
    provideAnimations(),
    ColorPickerModule,
    ColorPickerService,
    LoaderService,

    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    importProvidersFrom(
      HttpClientModule,
      CalendarModule.forRoot({
        provide: DateAdapter,
        useFactory: adapterFactory,
      }),
      AngularFireModule.initializeApp(environment.firebase),
      ToastrModule.forRoot({
        timeOut: 15000,
        closeButton: true,
        progressBar: true,
      })
    ),

    // ✅ Ordered Interceptors
    { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthPermissionInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: MaintenanceInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: HttpAuthService, multi: true },
  ],
};