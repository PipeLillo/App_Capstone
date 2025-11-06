import { ComponentFixture, TestBed, waitForAsync, fakeAsync, tick } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

// Se importa el registro de datos de localización para el idioma español
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

import { CalendarPage } from './calendar.page';
import { CalendarDataService } from '../../services/calendar-data.service';
import { AuthenticationService } from '../../services/authentication.service';

// Se registra el 'locale' español antes de que se ejecuten las pruebas
registerLocaleData(localeEs);

// --- SIMULACIONES (MOCKS) DE LOS SERVICIOS ---
const mockCalendarDataService = {
  getDoses: () => Promise.resolve([]),
};

const mockAuthService = {
  user$: of(null),
};

describe('CalendarPage', () => {
  let component: CalendarPage;
  let fixture: ComponentFixture<CalendarPage>;
  let calendarDataSpy: jasmine.Spy;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule.forRoot(),
        RouterTestingModule,
        HttpClientTestingModule,
        CalendarModule.forRoot({
          provide: DateAdapter,
          useFactory: adapterFactory,
        }),
        CalendarPage,
      ],
      providers: [
        { provide: CalendarDataService, useValue: mockCalendarDataService },
        { provide: AuthenticationService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarPage);
    component = fixture.componentInstance;
    calendarDataSpy = spyOn(mockCalendarDataService, 'getDoses');
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loadEvents on init if user is authenticated', () => {
    mockAuthService.user$ = of({ uid: '123' } as any);
    const loadEventsSpy = spyOn(component, 'loadEvents');
    
    component.ngOnInit();

    expect(loadEventsSpy).toHaveBeenCalled();
  });

  // ✅ PRUEBA CORREGIDA: Se usa fakeAsync y tick() para controlar el tiempo
  it('should populate events from the service on loadEvents', fakeAsync(() => {
    // Arrange: Preparamos los datos que simulará devolver la API
    const mockDoses = [
      { recordID: 1, medicationName: 'Ibuprofeno', scheduledTime: new Date().toISOString(), status: 2, medicationColor: '#1e90ff' },
    ];
    calendarDataSpy.and.returnValue(Promise.resolve(mockDoses));

    // Act: Llamamos a la función asíncrona
    component.loadEvents();
    
    // tick() simula el paso del tiempo, permitiendo que la promesa (getDoses) se resuelva.
    tick();

    // Assert: Ahora que la operación terminó, verificamos los resultados.
    expect(component.events.length).toBe(1);
    expect(component.events[0].title).toBe('Ibuprofeno');
    expect(component.isLoading).toBeFalse();
  }));

  it('should handle API errors gracefully', fakeAsync(() => {
    // Arrange
    calendarDataSpy.and.returnValue(Promise.reject('API Error'));
    const toastSpy = spyOn(component, 'presentToast');

    // Act
    component.loadEvents();
    tick(); // Simula la resolución de la promesa (en este caso, el rechazo)

    // Assert
    expect(toastSpy).toHaveBeenCalledWith('Error al cargar los eventos.');
    expect(component.isLoading).toBeFalse();
  }));
});