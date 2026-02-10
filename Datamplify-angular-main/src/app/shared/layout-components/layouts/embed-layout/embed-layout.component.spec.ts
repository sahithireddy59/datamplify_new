import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmbedLayoutComponent } from './embed-layout.component';

describe('EmbedLayoutComponent', () => {
  let component: EmbedLayoutComponent;
  let fixture: ComponentFixture<EmbedLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmbedLayoutComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EmbedLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
