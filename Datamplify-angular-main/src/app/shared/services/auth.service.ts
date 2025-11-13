import { Injectable,NgZone } from '@angular/core';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
}
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  authState: any;
  afAuth: any;
  afs: any;
  emailActivationToken:any;
  public showLoader:boolean=false;
  accessToken:any;
  constructor(private afu: AngularFireAuth, private router: Router,public ngZone: NgZone,private http: HttpClient) {
    this.afu.authState.subscribe((auth: any) => {
      this.authState = auth;
    });

  }

  // all firebase getdata functions

  get isUserAnonymousLoggedIn(): boolean {
    return this.authState !== null ? this.authState.isAnonymous : false;
  }

  get currentUserId(): string {
    return this.authState !== null ? this.authState.uid : '';
  }

  get currentUserName(): string {
    return this.authState['email'];
  }

  get currentUser(): any {
    return this.authState !== null ? this.authState : null;
  }

  get isUserEmailLoggedIn(): boolean {
    if (this.authState !== null && !this.isUserAnonymousLoggedIn) {
      return true;
    } else {
      return false;
    }
  }

login(email: string, password: string) {
  return this.http.post<any>(`${environment.apiUrl}/authentication/login/`, {  email,  password,});
}
register(data:any){
  return this.http.post<any>(`${environment.apiUrl}/authentication/signup/`,data);
}
validateOtp(otp:any, emailActivationToken:any) {
  return this.http.post<any>(`${environment.apiUrl}/authentication/activate_account/`+emailActivationToken,otp);
}
forgotPassword(data:any){
  return this.http.post<any>(`${environment.apiUrl}/authentication/reset_password/`,data);
}
resetPassword(token:any,data:any){
  return this.http.put<any>(`${environment.apiUrl}/authentication/reset_password/confirm`+'/'+token,data);
}
reactivateEmail(data:any){
  return this.http.post<any>(`${environment.apiUrl}/authentication/re_activation`+'/',data);

}
getTokenQuickbook(data:any){
  const currentUser = localStorage.getItem( 'currentUser' );
  this.accessToken = JSON.parse( currentUser! )['Token'];
  return this.http.post<any>(`${environment.apiUrl}/quickbooks_token/`+this.accessToken,data); 
}
getTokensalesforce(data:any){
  const currentUser = localStorage.getItem( 'currentUser' );
  this.accessToken = JSON.parse( currentUser! )['Token'];
  return this.http.post<any>(`${environment.apiUrl}/callback/`+this.accessToken,data); 
}
resendOtpApi(obj:any){
  return this.http.post<any>(`${environment.apiUrl}/authentication/resendotp/`,obj); 
}
logOut(){
  localStorage.removeItem('username');
         localStorage.removeItem('currentUser');
        //  this.currentUserSubject.next(this.currentUserValue);
         localStorage.clear();
         //this.userSubject.next(null);
         window.location.reload();
  
         this.router.navigate(['/authentication/signin']) 
        //  .then(() => {
        //  }); 
         return of({ success: false });
  }
  
  updatePassword(obj:any){
    const currentUser = localStorage.getItem( 'currentUser' );
    this.accessToken = JSON.parse( currentUser! )['Token'];
    return this.http.put<any>(`${environment.apiUrl}/authentication/updatepassword/`+this.accessToken,obj)
  }
  setPassword(token: any, data: any) {
    return this.http.put<any>(`${environment.apiUrl}/authentication/setPassword/` + token, data);
  }
}
