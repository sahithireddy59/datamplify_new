import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import Swal from 'sweetalert2';
import { PasswordValidators } from '../../../shared/password-validator';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [ReactiveFormsModule,RouterModule,CommonModule],
  templateUrl: './update-password.component.html',
  styleUrl: './update-password.component.scss'
})
export class UpdatePasswordComponent {
  updatePasswordForm!:FormGroup;
  confirmPasswordError = false;

 constructor(
   private router:Router,private formBuilder:FormBuilder
    ,private authService:AuthService,private activatedRoute: ActivatedRoute

  ) {
    this.updatePasswordForm = this.formBuilder.group({
       new_password: ['', [Validators.required, Validators.compose([
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
              confirm_password: ['', Validators.required],
            current_password: ['', Validators.required],

          });
  }

  get fv() {
    return this.updatePasswordForm.controls;
  }
  get passwordValid() {
    return this.updatePasswordForm.controls["new_password"].errors === null;
  }
  
  get requiredValid() {
    return !this.updatePasswordForm.controls["new_password"].hasError("required");
  }
  
  get minLengthValid() {
    return !this.updatePasswordForm.controls["new_password"].hasError("minlength");
  }
  
  get requiresDigitValid() {
    return !this.updatePasswordForm.controls["new_password"].hasError("requiresDigit");
  }
  
  get requiresUppercaseValid() {
    return !this.updatePasswordForm.controls["new_password"].hasError("requiresUppercase");
  }
  
  get requiresLowercaseValid() {
    return !this.updatePasswordForm.controls["new_password"].hasError("requiresLowercase");
  }
  
  get requiresSpecialCharsValid() {
    return !this.updatePasswordForm.controls["new_password"].hasError("requiresSpecialChars");
  }

  checkConfirmPassword(){
    if(this.updatePasswordForm.value.confirm_password === this.updatePasswordForm.value.new_password ){
      this.confirmPasswordError = false;
    } else{
      this.confirmPasswordError = true;
    }
  
  }
  showPassword = false;
showPassword1 = false;
showPassword2 = false;
toggleClass = "off-line";
toggleClass1 = "off-line";
toggleClass2 = "off-line";
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
toggleVisibility2() {
  this.showPassword2 = !this.showPassword2;
  if (this.toggleClass2 === "off-line") {
    this.toggleClass2 = "line";
  } else {
    this.toggleClass2 = "off-line";
  }
}
submitUpdatePasswordForm(){
  this.checkConfirmPassword();
   
  if (this.updatePasswordForm.invalid || this.confirmPasswordError){
   return;
  }else{}

  this.authService.updatePassword(this.updatePasswordForm.value)
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
        this.authService.logOut();
       this.router.navigate(['authentication/login']);
   }, 
   error:(error:any)=>{
    console.log(error);
    Swal.fire({
      icon: 'error',
      title: 'OOps!',
      text: error.error.message,
      width: '400px',
     })
   }
 });
}
}
