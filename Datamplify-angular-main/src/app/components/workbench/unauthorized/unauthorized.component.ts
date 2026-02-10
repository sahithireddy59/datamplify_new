import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NavigationService } from '../../../shared/services/navigation.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unauthorized.component.html',
  styleUrl: './unauthorized.component.scss'
})
export class UnauthorizedComponent {
  constructor(private router: Router, private navigationService: NavigationService) {}

  goHome() {
    this.navigationService.navigate(['datamplify','home']);
  }

  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.navigationService.navigate(['datamplify','home']);
    }
  }
}
