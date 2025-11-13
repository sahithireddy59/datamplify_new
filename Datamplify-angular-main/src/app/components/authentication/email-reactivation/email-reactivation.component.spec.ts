import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailReactivationComponent } from './email-reactivation.component';

describe('EmailReactivationComponent', () => {
  let component: EmailReactivationComponent;
  let fixture: ComponentFixture<EmailReactivationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailReactivationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EmailReactivationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
