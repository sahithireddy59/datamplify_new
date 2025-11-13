import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EtlLoggerViewComponent } from './etl-logger-view.component';

describe('EtlLoggerViewComponent', () => {
  let component: EtlLoggerViewComponent;
  let fixture: ComponentFixture<EtlLoggerViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EtlLoggerViewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EtlLoggerViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
