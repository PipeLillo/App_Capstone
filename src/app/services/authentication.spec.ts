import { TestBed } from '@angular/core/testing';
import { AuthenticationService } from './authentication.service';
import { beforeEach, describe, it } from 'node:test';

describe('AuthenticationService', () => {
  let service: AuthenticationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthenticationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
function expect(service: AuthenticationService) {
  throw new Error('Function not implemented.');
}

