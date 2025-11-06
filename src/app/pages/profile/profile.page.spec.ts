import { ComponentFixture, TestBed, waitForAsync, fakeAsync, tick } from '@angular/core/testing'; // ❗️ 1. IMPORTAMOS fakeAsync y tick
import { IonicModule, ToastController } from '@ionic/angular';
import { RouterTestingModule } from '@angular/router/testing';
import { ReactiveFormsModule } from '@angular/forms'; // 👈 IMPORTANTE: Para los Reactive Forms
import { ProfilePage } from './profile.page';

// 🔹 Importamos el SERVICIO que vamos a simular
import { AuthenticationService, UserInfoResponse } from '../../services/authentication.service';

// --- Inicia el "Suite" de Pruebas ---
describe('ProfilePage', () => {
  let component: ProfilePage;
  let fixture: ComponentFixture<ProfilePage>;

  // --- Variables para nuestros "Mocks" (Simulacros) ---
  let authServiceMock: jasmine.SpyObj<AuthenticationService>;
  let toastCtrlMock: jasmine.SpyObj<ToastController>;
  let mockToast: jasmine.SpyObj<HTMLIonToastElement>; // El objeto que .create() retorna

  // --- Datos Falsos para las Pruebas ---
  const mockUserProfile: UserInfoResponse = {
    // ❗️ AÑADIMOS LAS PROPIEDADES FALTANTES QUE TU TIPO REQUIERE
    FirebaseUid: 'test-uid',
    Email: 'test@test.com',
    DisplayName: 'Test User',
    PhotoURL: 'http://test.com/img.png',
    // -----
    Peso: 75.5,
    Altura: 180,
    Edad: 30,
    ContactoEmergencia: '123456789',
    Direccion: 'Calle Falsa 123',
    Contraindicaciones: 'Ninguna',
    EnfermedadesCronicas: 'Asma;Hipertensión',
    Alergias: 'Polen',
    Discapacidades: '',
    MedicacionPermanente: 'Salbutamol',
  };

  // --- Configuración (beforeEach) ---
  beforeEach(waitForAsync(() => {
    // 1. Creamos los Mocks
    // Simulamos AuthenticationService y sus métodos asíncronos
    authServiceMock = jasmine.createSpyObj('AuthenticationService', [
      'fetchUserInfo',
      'updateUserInfo',
      'logout',
    ]);

    // Simulamos ToastController para que no muestre Toasts reales
    mockToast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
    mockToast.present.and.returnValue(Promise.resolve()); // ❗️ 2. LE DECIMOS A .present() QUE ES ASÍNCRONO

    toastCtrlMock = jasmine.createSpyObj('ToastController', ['create']);
    // Hacemos que .create() devuelva una promesa que resuelva a nuestro mockToast
    toastCtrlMock.create.and.returnValue(Promise.resolve(mockToast));

    // 2. Configuramos el TestBed
    TestBed.configureTestingModule({
      imports: [
        IonicModule.forRoot(),
        RouterTestingModule, // Sigue aquí por si lo usas en el HTML
        ReactiveFormsModule, // 👈 Esencial para que funcione this.fb.group(...)
        ProfilePage, // Es Standalone, así que se importa
      ],
      // 3. Proveemos los Mocks en lugar de los servicios reales
      providers: [
        { provide: AuthenticationService, useValue: authServiceMock },
        { provide: ToastController, useValue: toastCtrlMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    
    // IMPORTANTE: No llamamos fixture.detectChanges() aquí
    // Lo llamaremos en cada 'it()' para controlar el 'ionViewWillEnter'
  }));

  // --- PRUEBA 1: Creación ---
  it('debería crearse correctamente', () => {
    fixture.detectChanges(); // Ejecuta ngOnInit
    expect(component).toBeTruthy();
  });

  // --- PRUEBA 2: Carga de Datos Exitosa (ionViewWillEnter -> loadProfile) ---
  it('debería cargar los datos del perfil y rellenar el formulario en ionViewWillEnter', async () => {
    // 1. Arrange: Configuramos el mock para que devuelva nuestros datos falsos
    authServiceMock.fetchUserInfo.and.returnValue(Promise.resolve(mockUserProfile));

    // 2. Act: Llamamos al método del ciclo de vida (que disparará loadProfile)
    await component.ionViewWillEnter();
    fixture.detectChanges(); // Actualizamos la vista/formulario

    // 3. Assert: Verificamos
    expect(authServiceMock.fetchUserInfo).toHaveBeenCalled();
    expect(component.loading).toBe(false);

    // Verificamos un campo simple
    expect(component.form.value.peso).toBe(75.5);
    expect(component.form.value.contactoEmergencia).toBe('123456789');

    // Verificamos que los strings se convirtieron en FormArray
    expect(component.enfermedadesFA.value).toEqual(['Asma', 'Hipertensión']);
    expect(component.alergiasFA.value).toEqual(['Polen']);
    expect(component.discapacidadesFA.value).toEqual([]); // Vacio
  });

  // --- PRUEBA 3: Carga de Datos Vacía (cuando no hay perfil previo) ---
  it('debería resetear el formulario si fetchUserInfo retorna null', async () => {
    // 1. Arrange: Llenamos el formulario con datos "sucios"
    component.form.patchValue({ peso: 99, direccion: 'Data antigua' });
    component.setAlergiasFromString('Maní');
    expect(component.form.value.peso).toBe(99); // Verificamos estado inicial

    // Configuramos el mock para que devuelva null
    authServiceMock.fetchUserInfo.and.returnValue(Promise.resolve(null));
    spyOn(component.form, 'reset').and.callThrough(); // Espiamos el .reset

    // 2. Act
    await component.ionViewWillEnter();
    fixture.detectChanges();

    // 3. Assert
    expect(authServiceMock.fetchUserInfo).toHaveBeenCalled();
    expect(component.form.reset).toHaveBeenCalled(); // Verificamos que se reseteó
    expect(component.alergiasFA.length).toBe(0); // Verificamos FormArray
    expect(component.form.value.peso).toBeNull(); // Verificamos campo reseteado
    expect(component.loading).toBe(false);
  });

  // --- PRUEBA 4: Carga de Datos con Error ---
  it('debería mostrar un toast de error si loadProfile falla', async () => {
    // 1. Arrange: Configuramos el mock para que RECHACE la promesa
    const errorMsg = 'Error de conexión';
    authServiceMock.fetchUserInfo.and.returnValue(Promise.reject(new Error(errorMsg)));

    // 2. Act
    await component.ionViewWillEnter();
    fixture.detectChanges();

    // 3. Assert
    expect(authServiceMock.fetchUserInfo).toHaveBeenCalled();
    expect(component.loading).toBe(false);
    
    // Verificamos que se llamó al ToastController con un mensaje de error
    expect(toastCtrlMock.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ color: 'danger' })
    );
    expect(mockToast.present).toHaveBeenCalled();
  });

  // --- PRUEBA 5: Envío de Formulario (onSubmit) Exitoso ---
  it('debería procesar los FormArrays a strings y llamar a updateUserInfo', async () => {
    // 1. Arrange: Llenamos el formulario
    fixture.detectChanges(); // Para inicializar el form
    component.form.patchValue({ peso: 80, altura: 175 });
    component.setEnfermedadesFromString('Diabetes');
    component.setAlergiasFromString('Nueces;Polvo');
    
    // Configuramos el mock de actualización
    authServiceMock.updateUserInfo.and.returnValue(Promise.resolve());

    // 2. Act
    await component.onSubmit();

    // 3. Assert
    // Creamos el 'payload' exacto que esperamos que se envíe
    const expectedPayload = {
      peso: 80,
      altura: 175,
      edad: null,
      contactoEmergencia: null,
      direccion: null,
      contraindicaciones: null,
      enfermedadesCronicas: 'Diabetes',
      alergias: 'Nueces;Polvo',
      discapacidades: null,
      medicacionPermanente: null,
    };
    
    expect(authServiceMock.updateUserInfo).toHaveBeenCalledWith(expectedPayload);
    expect(component.loading).toBe(false);
    expect(component.form.pristine).toBe(true); // Se marcó como "sin cambios"
    
    // Verificamos el toast de éxito
    expect(toastCtrlMock.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ color: 'success' })
    );
    expect(mockToast.present).toHaveBeenCalled();
  });
  
  // --- PRUEBA 6: Envío de Formulario (onSubmit) con Error ---
  it('debería mostrar un toast de error si updateUserInfo falla', async () => {
    // 1. Arrange
    fixture.detectChanges();
    component.form.patchValue({ peso: 80 }); // Hacemos un cambio
    component.form.markAsDirty(); // Marcamos como "sucio"
    
    const errorMsg = 'Actualización fallida';
    authServiceMock.updateUserInfo.and.returnValue(Promise.reject(new Error(errorMsg)));

    // 2. Act
    await component.onSubmit();

    // 3. Assert
    expect(authServiceMock.updateUserInfo).toHaveBeenCalled();
    expect(component.loading).toBe(false);
    expect(component.form.pristine).toBe(false); // NO se debe marcar como pristine
    
    // Verificamos el toast de error
    expect(toastCtrlMock.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ message: errorMsg, color: 'danger' })
    );
    expect(mockToast.present).toHaveBeenCalled();
  });

  // --- PRUEBA 7: Lógica de Chips (Añadir) ---
  it('debería añadir un chip a "alergias" y limpiar el input', () => {
    fixture.detectChanges();
    component.alergiaCtrl.setValue(' Maní '); // Con espacios extra

    component.addAlergia();

    expect(component.alergiasFA.value).toEqual(['Maní']); // Normalizado
    expect(component.alergiaCtrl.value).toBe(''); // Limpiado
  });
  
  // --- PRUEBA 8: Lógica de Chips (Duplicado) ---
  // ❗️ 3. USAMOS fakeAsync y tick()
  it('no debería añadir un chip duplicado y debería mostrar un toast', fakeAsync(() => {
    fixture.detectChanges();
    component.setAlergiasFromString('Polen'); // Dato inicial
    component.alergiaCtrl.setValue('polen'); // Intentamos añadir duplicado

    component.addAlergia(); // Esto llama a presentToast (que es async)

    tick(); // 👈 ADELANTAMOS EL RELOJ para que se resuelvan las promesas

    expect(component.alergiasFA.value).toEqual(['Polen']); // Sigue habiendo uno solo
    expect(toastCtrlMock.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ color: 'medium' })
    );
    expect(mockToast.present).toHaveBeenCalled(); // <-- ¡Ahora sí pasará!
  }));
  
  // --- PRUEBA 9: Lógica de Chips (Quitar) ---
  it('debería quitar un chip por índice', () => {
    fixture.detectChanges();
    component.setEnfermedadesFromString('Asma;Hipertensión');
    expect(component.enfermedadesFA.length).toBe(2);

    component.removeEnfermedad(0); // Quitamos 'Asma'

    expect(component.enfermedadesFA.value).toEqual(['Hipertensión']);
    expect(component.enfermedadesFA.length).toBe(1);
  });
  
  // --- PRUEBA 10: Formateo de Números ---
  it('debería formatear un string con coma a número válido en "formatNumber"', () => {
    fixture.detectChanges();
    const pesoCtrl = component.form.get('peso');
    
    // ❗️ Usamos '(pesoCtrl as any)' para simular un input de 'string' 
    // en un control que espera 'number'
    (pesoCtrl as any)?.setValue('75,88'); // Input del usuario con coma
    component.formatNumber('peso'); // Se llama en (ionBlur)
    
    expect(pesoCtrl?.value).toBe(75.88); // Corregido a número

    (pesoCtrl as any)?.setValue(' 180.555 '); // Con espacios y 3 decimales
    component.formatNumber('altura'); // 'altura' usa 2 decimales por defecto
    
    // Nota: 'altura' es el control, pero el valor se actualiza
    const alturaCtrl = component.form.get('altura');
    (alturaCtrl as any)?.setValue(' 180.555 ');
    component.formatNumber('altura');

    expect(alturaCtrl?.value).toBe(180.56); // Redondeado
  });

  // --- PRUEBA 11: Logout ---
  it('debería llamar a authService.logout al ejecutar onLogout', async () => {
    authServiceMock.logout.and.returnValue(Promise.resolve());
    
    await component.onLogout();
    
    expect(authServiceMock.logout).toHaveBeenCalled();
  });

});

