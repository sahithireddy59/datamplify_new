import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';

@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
})
export class PageHeaderComponent {
  @Input() title!: string;
  @Input() title1!:string;
  @Input() activeitem!: string;
  @Input() title2!:string;
  @Input() multiLevel = false;
  @Input() title2Route!:string;
  @Input() moduleId:any;
  @Input() isPublicUrl! : boolean;
  @Output() btnClickEvent: EventEmitter<any>;
  dashbaordName: any;

constructor(private route:Router,private sanitizer: DomSanitizer){
  this.btnClickEvent = new EventEmitter();
}

ngOnInit(){
  this.dashbaordName = this.sanitizer.bypassSecurityTrustHtml(this.title);
}

ngOnChanges(){
  this.dashbaordName = this.sanitizer.bypassSecurityTrustHtml(this.title);
  }

helpRoute(){
  console.log(this.moduleId)
  this.route.navigate([`/datamplify/help-guide/${this.moduleId}`])
}
routeHome(){
  this.route.navigate(['/datamplify/home'])
}

toggleSidebar(){
  this.btnClickEvent.emit();
}
}
