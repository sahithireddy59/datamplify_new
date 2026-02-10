import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmbedApplicationComponent } from './embed-application.component';

describe('EmbedApplicationComponent', () => {
  let component: EmbedApplicationComponent;
  let fixture: ComponentFixture<EmbedApplicationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmbedApplicationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EmbedApplicationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
