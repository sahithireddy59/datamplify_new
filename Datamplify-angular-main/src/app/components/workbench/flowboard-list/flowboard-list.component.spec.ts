import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlowboardListComponent } from './flowboard-list.component';

describe('DataflowListComponent', () => {
  let component: FlowboardListComponent;
  let fixture: ComponentFixture<FlowboardListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlowboardListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FlowboardListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
