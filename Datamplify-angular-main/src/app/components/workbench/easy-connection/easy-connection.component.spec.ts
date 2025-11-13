import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EasyConnectionComponent } from './easy-connection.component';

describe('EasyConnectionComponent', () => {
  let component: EasyConnectionComponent;
  let fixture: ComponentFixture<EasyConnectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EasyConnectionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EasyConnectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
