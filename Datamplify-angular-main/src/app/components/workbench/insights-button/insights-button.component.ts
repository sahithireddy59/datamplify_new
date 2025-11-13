import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NumberValue } from 'd3';
import { RolespriviledgesService } from '../rolespriviledges.service';

@Component({
  selector: 'app-insights-button',
  standalone: true,
  imports: [NgbModule,CommonModule],
  templateUrl: './insights-button.component.html',
  styleUrl: './insights-button.component.scss'
})
export class InsightsButtonComponent {
  
  @Input() buttonName!: string;
  @Input() classesList!: string;
  @Input() isIcon! : boolean;
  @Input() faIconList! : string;
  @Input() tabIndex! : number;
  @Input()  previledgeId! : number;
  @Input()  previledgeIdsList! : number[];
  @Input() isBtn! : boolean
  @Input() toolTip! : string;
  @Output() btnClickEvent: EventEmitter<any>;
  @Input() gotoSheetButton! : boolean;
  @Input() imageUrl!: string; 
  displayButton : boolean = false;
  constructor(private rolesPrevilidgesService : RolespriviledgesService){
    this.btnClickEvent = new EventEmitter();
  }

  ngOnInit(){
    if(this.previledgeIdsList && this.previledgeIdsList.length > 0) {
      this.displayButton = this.rolesPrevilidgesService.isAnyNumberPresent(this.previledgeIdsList);
    } else {
      this.displayButton = this.rolesPrevilidgesService.userHasPriviledge(this.previledgeId);
    }
  }

  onBtnClick(){
    this.btnClickEvent.emit();
  }
}
