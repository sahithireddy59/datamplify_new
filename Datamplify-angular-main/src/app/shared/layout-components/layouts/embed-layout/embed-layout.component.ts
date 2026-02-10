import { Component, ElementRef } from '@angular/core';
import { DashboardComponent } from '../../../../components/workbench/dashboard/dashboard.component';
import { SharedModule } from '../../../sharedmodule';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Menu, NavService } from '../../../services/navservice';
import { filter } from 'rxjs';
import { SwitcherComponent } from '../../switcher/switcher.component';
import { SharedService } from '../../../services/shared.service';

@Component({
  selector: 'app-embed-layout',
  standalone: true,
  imports: [DashboardComponent, SharedModule, RouterOutlet],
  templateUrl: './embed-layout.component.html',
  styleUrl: './embed-layout.component.scss'
})
export class EmbedLayoutComponent {
  public menuItems!: Menu[];
  currentRoute: string | undefined;
  urlData: string[] | undefined;
  document: any;
  switcherInstance!: SwitcherComponent;
  constructor(private router: Router, public navServices: NavService, private elementRef: ElementRef, private sharedService: SharedService) {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
      window.scrollTo(0, 0);
    });
    document.body.classList.remove('landing-page', 'ltr');
    document.body.classList.add('app');
  }

  ngOnInit() {
    this.sharedService.setEmbedMode(true);
    const html = document.documentElement;

    // Force override after Switcher applies settings
    html.setAttribute('data-menu-styles', 'light');
    html.setAttribute('data-theme-mode', 'light');
    html.setAttribute('data-header-styles', 'light');
    html.setAttribute('data-nav-layout', 'horizontal');
  }

  togglesidemenuBody() {
    document.querySelector('.offcanvas-end')?.classList.remove('show')
    document.querySelector("body")!.classList.remove("overflow:hidden");
    document.querySelector("body")!.classList.remove("padding-right:4px");

    if (localStorage.getItem('insightappsverticalstyles') == 'icontext') {
      document.documentElement.removeAttribute('icon-text');
    }
    if (document.documentElement.getAttribute('data-nav-layout') == 'horizontal' && window.innerWidth > 992) {
      this.closeMenu();
    }
    let html = this.elementRef.nativeElement.ownerDocument.documentElement;
    if (window.innerWidth <= 992) {
      html?.setAttribute(
        'data-toggled',
        html?.getAttribute('data-toggled') == 'close' ? 'close' : 'close'
      );
    }
    document
      .querySelector('.header-search')
      ?.classList.remove('searchdrop');
  }

  closeMenu() {
    this.menuItems?.forEach((a: any) => {
      if (this.menuItems) {
        a.active = false;
      }
      a?.children?.forEach((b: any) => {
        if (a.children) {
          b.active = false;
        }
      });
    });
  }
  
  clearToggle() {
    let html = this.elementRef.nativeElement.ownerDocument.documentElement;
    html?.setAttribute('data-toggled', 'open');

    document.querySelector('#responsive-overlay')?.classList.remove('active');
  }
}