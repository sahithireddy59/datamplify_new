import { Injectable,NgZone } from '@angular/core';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
resendOtpApi(obj:any){
  return this.http.post<any>(`${environment.apiUrl}/authentication/resendotp/`,obj); 
}
logOut(){
  localStorage.clear();
  window.location.href = '/authentication/login';
}
  
  updatePassword(obj:any){
    const currentUser = localStorage.getItem( 'currentUser' );
    this.accessToken = JSON.parse( currentUser! )['Token'];
    return this.http.put<any>(`${environment.apiUrl}/authentication/updatepassword/`+this.accessToken,obj)
  }
  private buildHeaders(token: string) {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    });
    return headers;
  }
  inviteNewUser(object:any){
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.post<any>(`${environment.apiUrl}/authentication/invite/user/`, object, { headers: this.buildHeaders(this.accessToken) });
  }
  setPassword(token: any, object: any) {
    return this.http.post<any>(`${environment.apiUrl}/authentication/invite/password/${token}`, object, { headers: this.buildHeaders(this.accessToken) });
  }
  getUsersList(page:any, pageSize: any, search: any, role: any){
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.get<any>(`${environment.apiUrl}/authentication/users_list/` + `?page=${page}&page_size=${pageSize}` + (search ? `&search=${search}` : ``) + (role ? `&role=${role}` : ``), { headers: this.buildHeaders(this.accessToken) });
  }
  editUser(object: any){
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.put<any>(`${environment.apiUrl}/authentication/user/`, object, { headers: this.buildHeaders(this.accessToken) });
  }
  deleteUser(id: any){
    const currentUser = localStorage.getItem('currentUser');
    this.accessToken = JSON.parse(currentUser!)['Token'];
    return this.http.delete<any>(`${environment.apiUrl}/authentication/user/delete/${id}`, { headers: this.buildHeaders(this.accessToken) });
  }
}
