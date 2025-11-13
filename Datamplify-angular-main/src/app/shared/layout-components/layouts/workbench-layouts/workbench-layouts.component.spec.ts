import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkbenchLayoutsComponent } from './workbench-layouts.component';

describe('WorkbenchLayoutsComponent', () => {
  let component: WorkbenchLayoutsComponent;
  let fixture: ComponentFixture<WorkbenchLayoutsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkbenchLayoutsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WorkbenchLayoutsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
