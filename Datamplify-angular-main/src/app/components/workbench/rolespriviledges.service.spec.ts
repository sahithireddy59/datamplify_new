import { TestBed } from '@angular/core/testing';

import { RolespriviledgesService } from './rolespriviledges.service';

describe('RolespriviledgesService', () => {
  let service: RolespriviledgesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RolespriviledgesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
