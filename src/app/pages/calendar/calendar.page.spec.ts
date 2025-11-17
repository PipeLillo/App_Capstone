import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { CalendarEvent } from 'angular-calendar';
import { 
  isSameDay, 
  isSameMonth, 
  addMonths 
} from 'date-fns';
import { AuthenticationService } from '../../services/authentication.service';
import { CalendarDataService, DoseRecordDto } from '../../services/calendar-data.service';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
})
export class CalendarPage implements OnInit {
  
  viewDate: Date = new Date();
  events: CalendarEvent[] = [];
  selectedDayEvents: CalendarEvent[] = [];
  isLoading: boolean = false;
  isPickerOpen: boolean = false;

  constructor(
    private calendarDataService: CalendarDataService,
    private authService: AuthenticationService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    // Inicializamos isLoading para evitar parpadeos
    this.isLoading = true;

    this.authService.user$.subscribe((user) => {
      if (user) {
        // CORRECCIÓN #1: Llamar a loadEvents aquí para pasar la prueba del Spy
        this.loadEvents();
      } else {
        this.isLoading = false;
        this.events = [];
        this.selectedDayEvents = [];
      }
    });
  }

  async loadEvents() {
    this.isLoading = true;
    try {
      // Llamada al servicio
      const doses = await this.calendarDataService.getDoses();
      
      // Mapeo de datos (según tus pruebas de "Mapeo de Datos")
      this.events = doses.map(dose => this.mapDtoToEvent(dose));
      
    } catch (error) {
      // Manejo de error (según tu prueba de "Manejo de errores")
      const toast = await this.toastCtrl.create({
        message: 'Error al cargar los eventos.',
        color: 'danger',
        duration: 2000
      });
      await toast.present();
    } finally {
      this.isLoading = false;
    }
  }

  mapDtoToEvent(dose: DoseRecordDto): CalendarEvent {
    // Lógica deducida de tus pruebas unitarias
    let primaryColor = '#808080'; // Gris por defecto
    let isTaken = false;

    if (dose.status === 1) {
      primaryColor = '#2dd36f'; // Verde si está tomada
      isTaken = true;
    } else if (dose.medicationColor) {
      primaryColor = dose.medicationColor; // Color del medicamento si existe
    }

    return {
      id: dose.recordID,
      start: new Date(dose.scheduledTime),
      title: dose.medicationName,
      color: {
        primary: primaryColor,
        secondary: primaryColor + '33', // Transparencia inferida de la prueba
      },
      meta: {
        isTaken: isTaken,
        originalData: dose
      }
    };
  }

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    // 1. Si es otro mes, no hacemos nada
    if (!isSameMonth(date, this.viewDate)) {
      return;
    }

    // CORRECCIÓN #2: Lógica de Toggle
    // Si es el mismo día y ya hay eventos seleccionados, limpiamos (deseleccionamos)
    if (isSameDay(this.viewDate, date) && this.selectedDayEvents.length > 0) {
      this.selectedDayEvents = [];
    } else {
      // Si no, seleccionamos el día y mostramos eventos
      this.viewDate = date;
      this.selectedDayEvents = events;
    }
  }

  changeDate(increment: number): void {
    this.viewDate = addMonths(this.viewDate, increment);
  }

  setPickerOpen(isOpen: boolean): void {
    this.isPickerOpen = isOpen;
  }

  handleDateChange(event: any): void {
    const dateValue = event.detail.value;
    if (dateValue) {
      this.viewDate = new Date(dateValue);
      // Establecemos el primer día del mes para evitar saltos raros si el día actual es 31
      this.viewDate.setDate(1); 
      this.isPickerOpen = false;
    }
  }
}