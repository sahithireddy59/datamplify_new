import { Component } from '@angular/core';

@Component({
  selector: 'app-authentication-layout',
  templateUrl: './authentication-layout.component.html',
  styleUrls: ['./authentication-layout.component.scss']
})
export class AuthenticationLayoutComponent {
constructor(){
  document.body.classList.remove( 'landing-page');
  document.body.classList.remove('sidebar-mini');
  document.body.classList.remove('app');

}
}
