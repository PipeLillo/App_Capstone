import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthenticationService } from './authentication.service';

// Las funciones 'describe', 'it', 'beforeEach' y 'expect' son globales en Jasmine,
// por lo que no es necesario importarlas.

describe('AuthenticationService', () => {
  let service: AuthenticationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Importamos módulos de prueba para las dependencias del servicio (HttpClient y Router)
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [AuthenticationService]
    });
    service = TestBed.inject(AuthenticationService);
  });

  // Esta es la prueba básica que verifica que el servicio se puede crear sin errores.
  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
