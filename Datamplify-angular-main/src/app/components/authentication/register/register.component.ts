import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, ElementRef, Inject, Renderer2, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { PasswordValidators } from '../../../shared/password-validator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AuthService } from '../../../shared/services/auth.service';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterModule,ReactiveFormsModule,MatFormFieldModule,CommonModule,FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  signupForm:FormGroup;
  confirmPasswordError = false;
  emailActivationToken:any;
  @ViewChild('inputRef') inputRef!: ElementRef;

  constructor(
    @Inject(DOCUMENT) private document: Document,private elementRef: ElementRef,private authService:AuthService,
    private renderer: Renderer2,private formBuilder:FormBuilder,private router:Router, private toastr: ToastrService
  ) {
    this.signupForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.maxLength(64)]],
      // username: ['', Validators.required],
      email: [
        '',
        [Validators.required, Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$')],
      ],
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
      confirm_password: ['', Validators.required],
    })
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
ngAfterViewInit() {
  this.inputRef.nativeElement.setAttribute('autocomplete', 'off');
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
  return this.signupForm.controls;
}

get passwordValid() {
  return this.signupForm.controls["password"].errors === null;
}

get requiredValid() {
  return !this.signupForm.controls["password"].hasError("required");
}

get minLengthValid() {
  return !this.signupForm.controls["password"].hasError("minlength");
}

get requiresDigitValid() {
  return !this.signupForm.controls["password"].hasError("requiresDigit");
}

get requiresUppercaseValid() {
  return !this.signupForm.controls["password"].hasError("requiresUppercase");
}

get requiresLowercaseValid() {
  return !this.signupForm.controls["password"].hasError("requiresLowercase");
}

get requiresSpecialCharsValid() {
  return !this.signupForm.controls["password"].hasError("requiresSpecialChars");
}

onPaste(event: ClipboardEvent) {
  event.preventDefault(); // Prevent paste action
}
checkConfirmPassword(){
  if(this.signupForm.value.confirm_password === this.signupForm.value.password ){
    this.confirmPasswordError = false;
  } else{
    this.confirmPasswordError = true;
  }

}


onSubmit(){
  this.checkConfirmPassword();
  if (this.signupForm.invalid || this.confirmPasswordError) {
    return;
  } else {
    this.authService.register(this.signupForm.value)
    .subscribe(
      {
        next:(data:any) => {
          console.log(data);
          this.emailActivationToken = data.emailActivationToken;
          this.authService.emailActivationToken = data.emailActivationToken;
          this.router.navigate(['/authentication/email-activation/'+ this.emailActivationToken]);

        },
        error:(error:any)=>{
          console.log(error);

          if (error?.error) {
            const emailError = error.error.email?.[0];
            const usernameError = error.error.username?.[0];

            if (emailError) this.toastr.error(emailError, 'Error');
            if (usernameError) this.toastr.error(usernameError, 'Error');

            if (!emailError && !usernameError && error.error.message) {
              this.toastr.error(error.error.message, 'Error');
            }
          } else {
            this.toastr.error('Something went wrong!', 'Error');
          }
        }
      }
    )
  }
}
}
