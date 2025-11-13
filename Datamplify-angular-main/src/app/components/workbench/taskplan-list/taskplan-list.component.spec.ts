import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskplanListComponent } from './taskplan-list.component';

describe('JobflowListComponent', () => {
  let component: TaskplanListComponent;
  let fixture: ComponentFixture<TaskplanListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskplanListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TaskplanListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
