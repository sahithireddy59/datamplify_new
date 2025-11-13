import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, Inject, Renderer2 } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgOtpInputModule } from 'ng-otp-input';
import Swal from 'sweetalert2';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-email-activation',
  standalone: true,
  imports: [RouterModule,NgOtpInputModule, FormsModule, ReactiveFormsModule],
  templateUrl: './email-activation.component.html',
  styleUrl: './email-activation.component.scss'
})
export class EmailActivationComponent {

  config = {
    allowNumbersOnly: true,
    length: 5,
    isPasswordInput: false,
    disableAutoFocus: false,
    placeholder: '',
    inputStyles: {
      'width': '50px',
      'height': '50px'
    }
  };
  display: any;
  resendOtp: boolean = false;
  displayTimer: boolean = false;
  otp:any;
  emailActivationToken:any;
constructor( @Inject(DOCUMENT) private document: Document,private elementRef: ElementRef,private authService:AuthService,private router:Router,private toasterService:ToastrService,
private renderer: Renderer2,private sanitizer: DomSanitizer, private activatedRoute: ActivatedRoute){
  this.activatedRoute.queryParams.subscribe(params => {
    this.emailActivationToken = this.activatedRoute.snapshot.params['token'];
    console.log(this.emailActivationToken);
  });
}

ngOnInit(): void {
 
  this.renderer.addClass(this.document.body, 'login-img');
  this.renderer.addClass(this.document.body, 'ltr');
  this.renderer.addClass(this.document.body, 'app-sidebar-mini');
  this.start(1);

}
ngOnDestroy(): void {
  this.renderer.removeClass(this.document.body, 'login-img');
  this.renderer.removeClass(this.document.body, 'ltr');
}


start(minute:any) {
  this.displayTimer = true;
  this.resendOtp = false;
  // let minute = 1;
  let seconds = minute * 60;
  let textSec: any = '0';
  let statSec = 60;

  const prefix = minute < 10 ? '0' : '';

  const timer = setInterval(() => {
    seconds--;
    if (statSec != 0) statSec--;
    else statSec = 59;

    // if (statSec < 10) textSec = "0" + statSec;
    // textSec = statSec;

    if (statSec < 10) {
      // console.log('inside', statSec);
      textSec = '0' + statSec;
    } else {
      // console.log('else', statSec);
      textSec = statSec;
    }

    // this.display = prefix + Math.floor(seconds / 60) + ":" + textSec;
    this.display = `${prefix}${Math.floor(seconds / 60)}:${textSec}`;

    if (seconds == 0) {
      console.log('finished');
      clearInterval(timer);
      this.resendOtp = true;
      this.displayTimer = false;
    }
  }, 1000);
}
onOtpChange(value:any){
  this.otp=value;
}
validateOtp(){
  const obj ={
    otp:this.otp
  }
  this.authService.validateOtp(obj, this.emailActivationToken)
  .subscribe(
    {
      next:(data) => {
        console.log(data);
        if(data.message ='Account successfully activated'){
          Swal.fire({
            icon: 'success',
            title: 'Congratulations!',
            text: 'Your Email is verified, Please Login',
            width: '400px',
          }).then((result:any)=>{
            this.router.navigate(['/authentication/login']);
          })
        }
      },
      error:(error)=>{
        console.log(error)
        // if(error){
        //   Swal.fire({
        //     icon: 'error',
        //     title: 'error!',
        //     text: error.error.message,
        //     width: '400px',
        //   })
        // }
        this.toasterService.error(error.error.message, 'Error');
      }
    }
  )
}
resendOtpApi(){
  this.activatedRoute.queryParams.subscribe(params => {
    this.emailActivationToken = this.activatedRoute.snapshot.params['token'];
    // console.log(this.token);
  });
  const obj={
  token:this.emailActivationToken
  }
  this.authService.resendOtpApi(obj)
  .subscribe(
    {
      next:(data) => {
        this.toasterService.success('OTP sent to registered Mail','success',{ positionClass: 'toast-top-right'});

        this.start(1); 
      },
      error:(error)=>{
        console.log(error)
        // if(error){
        //   Swal.fire({
        //     icon: 'error',
        //     title: 'error!',
        //     text: error.error.message,
        //     width: '400px',
        //   })
        // }
        this.toasterService.error(error.error.message, 'Error');
      }
    }
  )
}


}
