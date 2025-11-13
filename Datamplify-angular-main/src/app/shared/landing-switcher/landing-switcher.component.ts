import { Component, ElementRef, HostListener, Renderer2 } from '@angular/core';
import { NgxColorsModule } from 'ngx-colors';
import * as switcher from '../layout-components/switcher/switcher';
import { DOCUMENT } from '@angular/common';
@Component({
  selector: 'app-landing-switcher',
  templateUrl: './landing-switcher.component.html',
  styleUrls: ['./landing-switcher.component.scss']
})
export class LandingSwitcherComponent {
  body: any;

  SwitcherClose(){
    document.querySelector('.offcanvas-end')?.classList.remove('show')
    document.querySelector(".offcanvas-end")?.classList.toggle("hidden");
  }
  
  constructor(
    public renderer: Renderer2,

    private elementRef: ElementRef
  ) {
    const htmlElement =
      this.elementRef.nativeElement.ownerDocument.documentElement;
    this.renderer.setAttribute(htmlElement, 'data-nav-layout', 'horizontal');
    this.renderer.setAttribute(htmlElement, 'data-nav-style', 'menu-click');
    this.renderer.setAttribute(htmlElement, 'data-menu-position', 'fixed');
    this.renderer.setAttribute(htmlElement, 'data-theme-mode', 'light');
    this.renderer.setAttribute(htmlElement, 'data-header-styles','light');
    this.renderer.setAttribute(htmlElement, 'data-menu-styles','light');
    this.renderer.removeAttribute(htmlElement, 'loader');
    this.renderer.removeAttribute(htmlElement, 'data-width');
    this.renderer.removeAttribute(htmlElement, 'data-bg-img');
    this.renderer.removeAttribute(htmlElement, 'data-vertical-style');

    this.renderer.removeAttribute(htmlElement, 'data-nav-style', 'icon-click');


  }
 
  CheckOpe = () => {
    if (localStorage.getItem('insightapps-dir') == 'rtl') {
      this.RtlChecked = true;
    }
    if (localStorage.getItem('insightapps-dir') == 'rtl') {
      this.darkchecked = true;
    }
  };
  // public localdata = localStorage;

  ngOnInit(): void {
 
    switcher.localStorageBackUp();
    this.CheckOpe();


  }

  themeChange(type: string, type1: string) {
    const htmlElement =
      this.elementRef.nativeElement.ownerDocument.documentElement;
  
    this.renderer.setAttribute(htmlElement, 'data-theme-mode', type);
    localStorage.setItem('insightapps-theme-mode', type);
  
    this.renderer.setAttribute(htmlElement, 'data-header-styles', type1);
    localStorage.setItem('insightappsHeader', type1);
  
    if (localStorage.getItem('insightappsHeader') === type1) {
      this.renderer.removeAttribute(htmlElement, 'style');
     
    }
  }
  primary(type: string) {

    this.elementRef.nativeElement.ownerDocument.documentElement?.style.setProperty('--primary-rgb', type);
    localStorage.setItem('insightapps-primary-mode', type);
   
   
    
    // localStorage.removeItem('insightappslight-primary-color');
  }
  
  color1 = '#1457e6';
 //primary theme change
 public dynamicLightPrimary(data: any): void {
  this.color1 = data.color;

  const dynamicPrimaryLight = document.querySelectorAll(
    'button.pcr-button'
  );

  switcher.dynamicLightPrimaryColor(dynamicPrimaryLight, this.color1);

  localStorage.setItem('insightappslight-primary-color', switcher.hexToRgba(this.color1) || '');
  localStorage.setItem('insightappslight-primary-color1', switcher.hexToRgba(this.color1) || '');
  localStorage.setItem('insightappslight-mode', 'true');
  this.body?.classList.remove('transparent-mode');

  // Adding
  this.body?.classList.add('light-mode');

  // Removing
  this.body?.classList.remove('dark');
  this.body?.classList.remove('bg-img1');

  // removing data from session storage

  // switcher.checkOptions();
  localStorage.removeItem('insightapps-primary-mode');
}
  DirectionsChange(type: string) {
    const htmlElement =
      this.elementRef.nativeElement.ownerDocument.documentElement;
    this.renderer.setAttribute(htmlElement, 'dir', type);
    localStorage.setItem('insightapps-dir', type);
  }
  public localDark = localStorage;
  public localdata = localStorage;
  public darkchecked: any;
  public RtlChecked: any;
  reset() {
    localStorage.clear();
    const htmlElement = this.elementRef.nativeElement.ownerDocument.documentElement;
    htmlElement.setAttribute('data-theme-mode', 'light');
    htmlElement.setAttribute('dir', 'ltr');
    htmlElement.setAttribute('data-nav-layout', 'horizontal');
    htmlElement.setAttribute('data-page-style', 'regular');
    htmlElement.setAttribute('data-header-styles', 'light');
    htmlElement.setAttribute('data-menu-styles', 'light');
    htmlElement.setAttribute('bg-img', 'dark');
    htmlElement.removeAttribute('data-toggled');
    htmlElement.removeAttribute('style');
    // switcher.checkOptions();
     this.toggleExpand();
  }
  expande = false;
expande1 = false;
expande2 = false;
toggleExpand(): void {
  this.expande = !this.expande;   
 if (localStorage.getItem('data-menu-styles') == 'light') {
   document
     .querySelector('html')
     ?.setAttribute('data-menu-styles', 'light');
 } else if (localStorage.getItem('data-menu-styles') == 'dark') {
   document
     .querySelector('html')
     ?.setAttribute('data-menu-styles', 'dark');
 }
}

}
