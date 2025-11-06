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

  // --- Pruebas de Lógica (ngOnInit) ---
  it('debería crear el componente', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('debería navegar a /home si el usuario YA está logueado (ngOnInit)', () => {
    userSubject.next(mockUser);
    fixture.detectChanges(); // Dispara ngOnInit
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('NO debería navegar si el usuario NO está logueado (ngOnInit)', () => {
    userSubject.next(null);
    fixture.detectChanges();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  
  // --- Pruebas de Interacción (DOM) ---

  it('debería navegar a /home al hacer clic y tener éxito (Web/Popup)', fakeAsync(() => {
    fixture.detectChanges(); // ngOnInit

    // 1. Arrange
    authServiceSpy.signInWithGoogle.and.resolveTo(mockUser);
    
    // 2. Act
    // 🔥 CORRECCIÓN: Usamos la clase '.google-signin-btn' de tu HTML
    const button = fixture.debugElement.query(By.css('.google-signin-btn'));
    button.triggerEventHandler('click', null);
    
    tick(); // Avanzamos el tiempo para que se resuelva la promesa

    // 3. Assert
    expect(authServiceSpy.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
    expect(component.loading).toBe(false);
  }));

  it('debería mostrar y ocultar el spinner durante el clic', fakeAsync(() => {
    fixture.detectChanges();

    // 1. Arrange
    authServiceSpy.signInWithGoogle.and.resolveTo(null); // Caso redirect (no navega)
    const button = fixture.debugElement.query(By.css('.google-signin-btn'));

    // 2. Act (Inicio del clic)
    button.triggerEventHandler('click', null);
    fixture.detectChanges(); // Actualizamos el DOM para que *ngIf muestre el spinner

    // 3. Assert (Durante la carga)
    // Buscamos el spinner por su etiqueta
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
    // 🔥 CORRECCIÓN: Usamos la clase '.error-text' de tu HTML
    const errorElement = fixture.debugElement.query(By.css('.error-text'));
    expect(errorElement).toBeTruthy(); // El elemento de error debe existir
    expect(errorElement.nativeElement.textContent).toContain('Popup cerrado por el usuario');
    expect(component.loading).toBe(false);
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  }));

  it('NO debería llamar a signInWithGoogle() si ya está "loading"', () => {
    fixture.detectChanges();
    component.loading = true; // Forzamos el estado
    
    // Simulamos clic
    const button = fixture.debugElement.query(By.css('.google-signin-btn'));
    button.triggerEventHandler('click', null);

    expect(authServiceSpy.signInWithGoogle).not.toHaveBeenCalled();
  });

});