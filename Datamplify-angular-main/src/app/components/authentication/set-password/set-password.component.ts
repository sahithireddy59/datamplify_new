import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Renderer2 } from '@angular/core';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';
import { PasswordValidators } from '../../../shared/password-validator';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './set-password.component.html',
  styleUrl: './set-password.component.scss'
})
export class SetPasswordComponent {
  setPasswordForm!: FormGroup;
  confirmPasswordError = false;
  showPassword = false;
  showPassword1 = false;
  toggleClass = "off-line";
  toggleClass1 = "off-line";
  token: any;
  setPasswordUI = true;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private fb: FormBuilder,
    private renderer: Renderer2,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.setPasswordForm = this.fb.group({
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          PasswordValidators.patternValidator(new RegExp('(?=.*[0-9])'), { requiresDigit: true }),
          PasswordValidators.patternValidator(new RegExp('(?=.*[A-Z])'), { requiresUppercase: true }),
          PasswordValidators.patternValidator(new RegExp('(?=.*[a-z])'), { requiresLowercase: true }),
          PasswordValidators.patternValidator(new RegExp('(?=.*[$@^!%*?&])'), { requiresSpecialChars: true }),
        ],
      ],
      confirmPassword: ['', Validators.required],
    });
  }

  // getters
  get requiredValid() { return !this.setPasswordForm.get('password')?.hasError('required'); }
  get minLengthValid() { return !this.setPasswordForm.get('password')?.hasError('minlength'); }
  get requiresDigitValid() { return !this.setPasswordForm.get('password')?.hasError('requiresDigit'); }
  get requiresUppercaseValid() { return !this.setPasswordForm.get('password')?.hasError('requiresUppercase'); }
  get requiresLowercaseValid() { return !this.setPasswordForm.get('password')?.hasError('requiresLowercase'); }
  get requiresSpecialCharsValid() { return !this.setPasswordForm.get('password')?.hasError('requiresSpecialChars'); }

  toggleVisibility() {
    this.showPassword = !this.showPassword;
    this.toggleClass = this.toggleClass === "off-line" ? "line" : "off-line";
  }
  toggleVisibility1() {
    this.showPassword1 = !this.showPassword1;
    this.toggleClass1 = this.toggleClass1 === "off-line" ? "line" : "off-line";
  }

  checkConfirmPassword() {
    this.confirmPasswordError = this.setPasswordForm.value.password !== this.setPasswordForm.value.confirmPassword;
  }

  submitSetPasswordForm() {
    this.checkConfirmPassword();
    if (this.setPasswordForm.invalid || this.confirmPasswordError) return;

    this.token = this.activatedRoute.snapshot.params['token'];
    this.authService.setPassword(this.token, this.setPasswordForm.value).subscribe({
      next: (data: any) => {
        Swal.fire({
          icon: 'success',
          title: 'Password Set Successfully!',
          text: 'Your account is now active. Please sign in.',
          width: '400px'
        });
        this.router.navigate(['authentication/login']);
      },
      error: (error) => {
        this.toastr.error(error.error.message, 'Error');
      }
    });
  }

  ngOnInit(): void {
    this.renderer.addClass(this.document.body, 'login-img');
  }

  ngOnDestroy(): void {
    this.renderer.removeClass(this.document.body, 'login-img');
  }
}
