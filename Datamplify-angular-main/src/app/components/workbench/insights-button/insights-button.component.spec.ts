import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InsightsButtonComponent } from './insights-button.component';

describe('InsightsButtonComponent', () => {
  let component: InsightsButtonComponent;
  let fixture: ComponentFixture<InsightsButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsightsButtonComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InsightsButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
