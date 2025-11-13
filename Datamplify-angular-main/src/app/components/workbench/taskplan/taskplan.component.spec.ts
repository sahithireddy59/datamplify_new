import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskplanComponent } from './taskplan.component';

describe('EtlJobFlowComponent', () => {
  let component: TaskplanComponent;
  let fixture: ComponentFixture<TaskplanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskplanComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TaskplanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
