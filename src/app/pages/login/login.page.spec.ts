//
// 📍 LUGAR: src/app/pages/login/login.page.spec.ts
//
import { ComponentFixture, TestBed, waitForAsync, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { User } from 'firebase/auth';
import { By } from '@angular/platform-browser'; // Importar 'By'

// Componente y Servicio a probar/simular
import { LoginPage } from './login.page';
import { AuthenticationService } from '../../services/authentication.service';

// --- Creamos un usuario falso para las pruebas ---
const mockUser = { uid: 'test-uid-123', email: 'test@test.com' } as User;


describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;

  // --- Mocks (simuladores) de las dependencias ---
  let authServiceSpy: jasmine.SpyObj<AuthenticationService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let userSubject: BehaviorSubject<User | null>;

  beforeEach(waitForAsync(() => {
    
    userSubject = new BehaviorSubject<User | null>(null);

    authServiceSpy = jasmine.createSpyObj(
      'AuthenticationService',
      ['signInWithGoogle'],
      { user$: userSubject.asObservable() }
    );
    
    routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl']);

    TestBed.configureTestingModule({
      imports: [
        LoginPage, // Importamos el componente Standalone
        IonicModule.forRoot()
      ],
      providers: [
        { provide: AuthenticationService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
  }));

  // --- Prueba Fundamental (Genérica) ---
  // Comentario: Esta es la prueba más genérica (de humo o "smoke test").
  // Verifica que el componente se compile y cree correctamente con sus dependencias.
  it('debería crear el componente', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });


  // -----------------------------------------------------------------
  // --- 1. PRUEBAS DE VALOR (LÓGICA DE AUTENTICACIÓN Y NAVEGACIÓN) ---
  // -----------------------------------------------------------------
  describe('✅ Pruebas de Valor (Lógica de Autenticación)', () => {

    // Comentario: Prueba de VALOR. Esta es la regla de negocio principal:
    // "Si un usuario ya autenticado llega a esta página, debe ser redirigido".
    it('debería navegar a /home si el usuario YA está logueado (ngOnInit)', () => {
      userSubject.next(mockUser);
      fixture.detectChanges(); // Dispara ngOnInit
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
    });

    // Comentario: Prueba de VALOR. Este es el "camino feliz" (happy path)
    // principal del componente. Verifica que la interacción del usuario
    // (clic) + la lógica de negocio (login exitoso) producen el resultado esperado (navegación).
    it('debería navegar a /home al hacer clic y tener éxito (Web/Popup)', fakeAsync(() => {
      fixture.detectChanges(); // ngOnInit

      // 1. Arrange
      authServiceSpy.signInWithGoogle.and.resolveTo(mockUser);
      
      // 2. Act
      const button = fixture.debugElement.query(By.css('.google-signin-btn'));
      button.triggerEventHandler('click', null);
      
      tick(); // Avanzamos el tiempo para que se resuelva la promesa

      // 3. Assert
      expect(authServiceSpy.signInWithGoogle).toHaveBeenCalledTimes(1);
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
      expect(component.loading).toBe(false);
    }));

    // Comentario: Prueba de VALOR. Este es el "camino triste" (unhappy path).
    // Verifica que el componente maneja correctamente un fallo en la lógica de
    // negocio (error de login) y da retroalimentación al usuario (muestra error).
    it('debería mostrar un mensaje de error en el HTML si el login falla', fakeAsync(() => {
      fixture.detectChanges();

      // 1. Arrange
      const errorSimulado = { message: 'Popup cerrado por el usuario' };
      authServiceSpy.signInWithGoogle.and.rejectWith(errorSimulado);
      const button = fixture.debugElement.query(By.css('.google-signin-btn'));

      // 2. Act
      button.triggerEventHandler('click', null);
      tick(); // Resolvemos la promesa (con error)
      fixture.detectChanges(); // Actualizamos el DOM para mostrar el error

      // 3. Assert
      const errorElement = fixture.debugElement.query(By.css('.error-text'));
      expect(errorElement).toBeTruthy(); // El elemento de error debe existir
      expect(errorElement.nativeElement.textContent).toContain('Popup cerrado por el usuario');
      expect(component.loading).toBe(false);
      expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    }));
  });


  // -----------------------------------------------------------------
  // --- 2. PRUEBAS GENÉRICAS (ESTADO DE UI E INTEGRACIÓN) ---
  // -----------------------------------------------------------------
  describe('⚙️ Pruebas Genéricas (Estado de UI e Integración)', () => {

    // Comentario: Prueba GENÉRICA. Verifica el estado por defecto del
    // componente. Es el inverso de la prueba de valor; asegura que
    // si la condición (usuario logueado) no se cumple, la acción (navegar) no ocurre.
    it('NO debería navegar si el usuario NO está logueado (ngOnInit)', () => {
      userSubject.next(null);
      fixture.detectChanges();
      expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    });

    // Comentario: Prueba GENÉRICA. Esta prueba no verifica la lógica de
    // negocio (si el login funciona o no), sino el estado de la UI (el spinner).
    // Asegura que el usuario recibe retroalimentación visual *mientras* la promesa se resuelve.
    it('debería mostrar y ocultar el spinner durante el clic', fakeAsync(() => {
      fixture.detectChanges();

      // 1. Arrange
      authServiceSpy.signInWithGoogle.and.resolveTo(null); // Caso redirect (no navega)
      const button = fixture.debugElement.query(By.css('.google-signin-btn'));

      // 2. Act (Inicio del clic)
      button.triggerEventHandler('click', null);
      fixture.detectChanges(); // Actualizamos el DOM para que *ngIf muestre el spinner

      // 3. Assert (Durante la carga)
      const spinner = fixture.debugElement.query(By.css('ion-spinner'));
      expect(spinner).toBeTruthy(); // El spinner DEBE existir
      expect(component.loading).toBe(true);

      // 4. Act (Fin de la promesa)
      tick(); // Resolvemos la promesa
      fixture.detectChanges(); // Actualizamos el DOM para que *ngIf oculte el spinner

      // 5. Assert (Después de la carga)
      const spinnerFinal = fixture.debugElement.query(By.css('ion-spinner'));
      expect(spinnerFinal).toBeFalsy(); // El spinner DEBE desaparecer
      expect(component.loading).toBe(false);
    }));

    // Comentario: Prueba GENÉRICA. Es una prueba de "guarda" (guard).
    // Verifica una protección de la UI para prevenir llamadas duplicadas
    // si el usuario hace doble clic. Es una prueba de robustez.
    it('NO debería llamar a signInWithGoogle() si ya está "loading"', () => {
      fixture.detectChanges();
      component.loading = true; // Forzamos el estado
      
      // Simulamos clic
      const button = fixture.debugElement.query(By.css('.google-signin-btn'));
      button.triggerEventHandler('click', null);

      expect(authServiceSpy.signInWithGoogle).not.toHaveBeenCalled();
    });
  });

});