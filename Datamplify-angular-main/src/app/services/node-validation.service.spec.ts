import { TestBed } from '@angular/core/testing';

import { NodeValidationService } from './node-validation.service';

describe('NodeValidationService', () => {
  let service: NodeValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NodeValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
