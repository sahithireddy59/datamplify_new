import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, Inject, Renderer2 } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-error503',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './error503.component.html',
  styleUrls: ['./error503.component.scss']
})
export class Error503Component {
  constructor(
    @Inject(DOCUMENT) private document: Document,private elementRef: ElementRef,
    private renderer: Renderer2,private sanitizer: DomSanitizer
  ) {}
  ngOnInit(): void {
 
    this.renderer.addClass(this.document.body, 'login-img');
    this.renderer.removeClass(this.document.body, 'ltr');
    this.renderer.removeClass(this.document.body, 'app-sidebar-mini');

  }
  ngOnDestroy(): void {
    this.renderer.removeClass(this.document.body, 'login-img');
    this.renderer.addClass(this.document.body, 'ltr');


}
}
