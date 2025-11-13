import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, Inject, Renderer2 } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import Swal from 'sweetalert2';
import { RolespriviledgesService } from '../../workbench/rolespriviledges.service';
import { SharedModule } from '../../../shared/sharedmodule';
import { SwitcherComponent } from '../../../shared/layout-components/switcher/switcher.component';
import { CustomThemeService } from '../../../services/custom-theme.service';
import { LoaderService } from '../../../shared/services/loader.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule,ReactiveFormsModule,SharedModule,FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {

loginForm:FormGroup;


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
  constructor(
    @Inject(DOCUMENT) private document: Document,private elementRef: ElementRef,private router: Router,private switcherComponent: SwitcherComponent,private themeService : CustomThemeService,
    private renderer: Renderer2, private rolesService : RolespriviledgesService, private sanitizer: DomSanitizer,private formBuilder:FormBuilder,private authService:AuthService,private loaderService : LoaderService,
    private toastr: ToastrService
  ) {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      this.router.navigate(['datamplify/home']);
    }
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$')]],
      password: ['', Validators.required],    })
  }

  get f() {
    return this.loginForm.controls;
  }

  ngOnInit(): void {
 
    this.renderer.addClass(this.document.body, 'login-img');
    this.renderer.addClass(this.document.body, 'ltr');
  }
  ngOnDestroy(): void {
    this.renderer.removeClass(this.document.body, 'login-img');
    this.renderer.removeClass(this.document.body, 'ltr');
}

onSubmit(){
this.authService.login(this.f['email'].value,this.f['password'].value)
.subscribe({
  next:(data:any) => {
    this.loaderService.show();
    console.log(data);   
    const userToken = { Token: data.accessToken,};
    const userName = { userName: data.username};
    const userId = data.user_id;
    localStorage.setItem('currentUser', JSON.stringify(userToken));
    localStorage.setItem('username', JSON.stringify(userName));
    localStorage.setItem('userId', userId);  
    if(data.previlages){
      this.rolesService.setRoleBasedPreviledges(data.previlages);
    }
    if(data.accessToken){
      this.router.navigate(['datamplify/home'])
    }
  },
  error:(error:any)=>{
    this.loaderService.hide();
    console.log(error);
    if(error.error.message === 'Account is in In-Active, please Activate your account'){
      this.toastr.info(error.error.message, 'Info');
      this.router.navigate(['/authentication/email-reactivation'])
    }else{
      this.toastr.error(error.error.message, 'Error');
    }
  }
})
}
}