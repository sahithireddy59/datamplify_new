import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, ElementRef, Inject, Renderer2 } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PasswordValidators } from '../../../shared/password-validator';
import Swal from 'sweetalert2';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterModule,ReactiveFormsModule,CommonModule,FormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  forgotPasswordForm!:FormGroup;
  resetPasswordForm!:FormGroup;
  resetPasswordUI = false;
  isforgotPassword = false;
  confirmPasswordError = false;
  token:any
  constructor(
    @Inject(DOCUMENT) private document: Document,private elementRef: ElementRef,private router:Router,private formBuilder:FormBuilder,
    private renderer: Renderer2,private sanitizer: DomSanitizer,private authService:AuthService,private activatedRoute: ActivatedRoute, private toastr: ToastrService

  ) {
    const currentUrl = this.router.url;
    if ( currentUrl.includes( 'authentication/forgot-password' ) ) {
      this.isforgotPassword = true;
      this.forgotPasswordForm = this.formBuilder.group({
        email: [
          '',
          [Validators.required, Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$')],
        ],
      })
     
    } else if( currentUrl.includes( 'authentication/reset-password' )) {
      this.resetPasswordUI = true;
      this.resetPasswordForm = this.formBuilder.group({
        password: ['', [Validators.required, Validators.compose([
          Validators.required,
          Validators.minLength(8),
          PasswordValidators.patternValidator(new RegExp("(?=.*[0-9])"), {
            requiresDigit: true
          }),
          PasswordValidators.patternValidator(new RegExp("(?=.*[A-Z])"), {
            requiresUppercase: true
          }),
          PasswordValidators.patternValidator(new RegExp("(?=.*[a-z])"), {
            requiresLowercase: true
          }),
          PasswordValidators.patternValidator(new RegExp("(?=.*[$@^!%*?&])"), {
            requiresSpecialChars: true
          })
          ])]],
        confirmPassword: ['', Validators.required],
      });
    }
  }
  showPassword = false;
showPassword1 = false;
toggleClass = "off-line";
toggleClass1 = "off-line";
toggleVisibility() {
  this.showPassword = !this.showPassword;
  if (this.toggleClass === "off-line") {
    this.toggleClass = "line";
  } else {
    this.toggleClass = "off-line";
  }
}
toggleVisibility1() {
  this.showPassword1 = !this.showPassword1;
  if (this.toggleClass1 === "off-line") {
    this.toggleClass1 = "line";
  } else {
    this.toggleClass1 = "off-line";
  }
}
  get f() {
    return this.forgotPasswordForm.controls;
  }
  get fv() {
    return this.resetPasswordForm.controls;
  }
  get passwordValid() {
    return this.resetPasswordForm.controls["password"].errors === null;
  }
  
  get requiredValid() {
    return !this.resetPasswordForm.controls["password"].hasError("required");
  }
  
  get minLengthValid() {
    return !this.resetPasswordForm.controls["password"].hasError("minlength");
  }
  
  get requiresDigitValid() {
    return !this.resetPasswordForm.controls["password"].hasError("requiresDigit");
  }
  
  get requiresUppercaseValid() {
    return !this.resetPasswordForm.controls["password"].hasError("requiresUppercase");
  }
  
  get requiresLowercaseValid() {
    return !this.resetPasswordForm.controls["password"].hasError("requiresLowercase");
  }
  
  get requiresSpecialCharsValid() {
    return !this.resetPasswordForm.controls["password"].hasError("requiresSpecialChars");
  }
  checkConfirmPassword(){
    if(this.resetPasswordForm.value.confirmPassword === this.resetPasswordForm.value.password ){
      this.confirmPasswordError = false;
    } else{
      this.confirmPasswordError = true;
    }
  
  }
  ngOnInit(): void {
 
    this.renderer.addClass(this.document.body, 'login-img');
    this.renderer.addClass(this.document.body, 'ltr');
    this.renderer.addClass(this.document.body, 'app-sidebar-mini');
  
  }
  ngOnDestroy(): void {
    this.renderer.removeClass(this.document.body, 'login-img');
    this.renderer.removeClass(this.document.body, 'ltr');
}
submitForgotPasswordForm(){
  if (this.forgotPasswordForm.invalid) {
    return;
  } else {
    this.authService.forgotPassword(this.forgotPasswordForm.value)
.subscribe(
  {
    next:(data:any) => {      
      console.log(data);
      if (data.message='Password reset email sent'){
        Swal.fire({
          icon: 'success',
          title: 'Reset link sent to mail ',
          text: 'please check your mail to reset password',
          width: '400px',
         })
         this.router.navigate(['authentication/login']);
      }
    },
    error:(error:any)=>{
      console.log(error);
      this.toastr.error(error.error.message, 'Error');
      // if(error){
      //   Swal.fire({
      //     icon: 'warning',
      //     title: 'Oops!',
      //     text: error.error.message,
      //     width: '400px',
      //    })
      // }
    }
  }
) 
  }
}
submitResetPasswordForm(){
  this.checkConfirmPassword();
   
  if (this.resetPasswordForm.invalid || this.confirmPasswordError){
   return;
  }else{}
  this.activatedRoute.queryParams.subscribe(params => {
   this.token = this.activatedRoute.snapshot.params['token'];
   // console.log(this.token);
 });

  this.authService.resetPassword(this.token,this.resetPasswordForm.value)
  .subscribe(
   {
 next:(data:any) => {
   console.log(data);
       //this.userProviderMessage = data.message;
       Swal.fire({
         icon: 'success',
         title: 'Congratulations!',
         text: 'Your password changed Successfully!.Please SignIn',
         width: '400px',
        })
       this.router.navigate(['authentication/login']);
   }, 
   error:(error:any)=>{
    console.log(error);
    // Swal.fire({
    //   icon: 'error',
    //   title: 'OOps!',
    //   text: error.error.message,
    //   width: '400px',
    //  })
     this.toastr.error(error.error.message, 'Error');
   }
 });
}

}
