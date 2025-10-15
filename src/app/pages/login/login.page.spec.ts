import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { User } from 'firebase/auth';

import { HomePage } from '../../home/home.page';
import { AuthenticationService } from '../../services/authentication.service';

// --- SIMULACIÓN (MOCK) DEL SERVICIO DE AUTENTICACIÓN ---
const mockAuthService = {
  user$: new BehaviorSubject<User | null>(null)
};

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule.forRoot(),
        RouterTestingModule,
        HttpClientTestingModule,
        HomePage,
      ],
      providers: [
        { provide: AuthenticationService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set greeting with display name on init', () => {
    // Arrange: Preparamos un usuario de prueba con nombre.
    const mockUser = { displayName: 'Felipe Pardo', email: 'test@test.com' } as User;
    mockAuthService.user$.next(mockUser);

    // Act: Disparamos la detección de cambios para que ngOnInit se ejecute.
    fixture.detectChanges();

    // Assert: Verificamos que el saludo se haya formateado correctamente.
    expect(component.greeting).toBe('¡Hola, Felipe!');
  });

  it('should set greeting with email prefix if display name is missing', () => {
    // Arrange: Preparamos un usuario sin nombre pero con email.
    const mockUser = { displayName: null, email: 'invitado@example.com' } as User;
    mockAuthService.user$.next(mockUser);

    // Act
    fixture.detectChanges();

    // Assert: Verificamos que se use el email como fallback.
    expect(component.greeting).toBe('¡Hola, Invitado!');
  });
  
  it('should set default greeting if user is null', () => {
    // Arrange: Simulamos que no hay ningún usuario logueado.
    mockAuthService.user$.next(null);
    
    // Act
    fixture.detectChanges();

    // Assert: Verificamos que se muestre el saludo por defecto.
    expect(component.greeting).toBe('¡Hola!');
  });
});

