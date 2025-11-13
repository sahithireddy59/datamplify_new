import { TestBed } from '@angular/core/testing';

import { DefaultColorPickerService } from './default-color-picker.service';

describe('DefaultColorPickerService', () => {
  let service: DefaultColorPickerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DefaultColorPickerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});