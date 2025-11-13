import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RolesDashboardComponent } from './roles-dashboard.component';

describe('RolesDashboardComponent', () => {
  let component: RolesDashboardComponent;
  let fixture: ComponentFixture<RolesDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolesDashboardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RolesDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
