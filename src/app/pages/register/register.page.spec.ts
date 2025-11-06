import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RegisterPage } from './register.page';
import { Router } from '@angular/router'; // Importamos el Router real
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing'; // Importamos el módulo de testing del router
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

// --- NO NECESITAMOS UN MOCK GLOBAL DEL ROUTER ---
// const mockRouter = jasmine.createSpyObj('Router', ['navigateByUrl']); // <-- ELIMINAR ESTO

describe('RegisterPage', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;
  let router: Router; // Variable para sostener el router de prueba
  let navigateSpy: jasmine.Spy; // Variable para sostener nuestro espía

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        RegisterPage,
        IonicModule.forRoot(), // Provee NavController
        FormsModule,
        // Provee un Router funcional y seguro para pruebas
        RouterTestingModule.withRoutes([]), 
      ],
      providers: [
        // --- NO REEMPLAZAMOS EL ROUTER ---
        // { provide: Router, useValue: mockRouter }, // <-- ELIMINAR ESTO
      ],
      // Esto debería silenciar los errores de <ion-icon>
      schemas: [CUSTOM_ELEMENTS_SCHEMA], 
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;

    // --- OBTENEMOS EL ROUTER Y CREAMOS EL ESPÍA ---
    // 1. Obtenemos el Router (de prueba) que el TestBed ha creado
    router = TestBed.inject(Router);
    // 2. Creamos un espía sobre su método 'navigateByUrl'
    navigateSpy = spyOn(router, 'navigateByUrl');

    fixture.detectChanges();
  }));

  it('should create', () => {
    // Esta prueba ahora debería pasar
    expect(component).toBeTruthy();
  });

  it('should NOT navigate if email is missing', async () => {
    component.email = '';
    component.password = '123456';
    spyOn(console, 'log');

    await component.register();

    // Usamos nuestro 'navigateSpy' para la verificación
    expect(navigateSpy).not.toHaveBeenCalled(); 
    expect(console.log).toHaveBeenCalledWith(
      'Error: Por favor, ingresa un correo y una contraseña.'
    );
  });

  it('should NOT navigate if password is missing', async () => {
    component.email = 'test@test.com';
    component.password = '';
    spyOn(console, 'log');

    await component.register();

    // Usamos nuestro 'navigateSpy'
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      'Error: Por favor, ingresa un correo y una contraseña.'
    );
  });

  it('should navigate to /home on successful (simulated) registration', async () => {
    component.email = 'test@test.com';
    component.password = '123456';
    spyOn(console, 'log');

    await component.register();

    // Usamos nuestro 'navigateSpy'
    expect(navigateSpy).toHaveBeenCalledWith('/home', {
      replaceUrl: true,
    });
    expect(console.log).toHaveBeenCalledWith(
      'Simulación de registro exitoso para el usuario:',
      'test@test.com'
    );
  });
});