import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, calendarOutline, checkmarkCircle } from 'ionicons/icons';

// --- IMPORTACIONES NECESARIAS PARA ANGULAR-CALENDAR ---
import { CalendarEvent, CalendarModule, CalendarView } from 'angular-calendar';
import { startOfMonth, isSameMonth, isSameDay, addMonths } from 'date-fns';

// --- SERVICIOS ---
// ✅ La interfaz DoseRecordDto ahora incluye 'medicationColor'.
import { CalendarDataService, DoseRecordDto } from '../../services/calendar-data.service';
import { AuthenticationService } from '../../services/authentication.service';

// ✅ COLORES ACTUALIZADOS: Ya no se necesita el color 'pendiente' fijo.
const colors = {
  tomado: { primary: '#2dd36f', secondary: '#EAFBEF' },   // Verde para dosis tomadas
  default: { primary: '#808080', secondary: '#E0E0E0' }, // Gris si no viene color de la BD
};

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, CalendarModule],
})
export class CalendarPage implements OnInit {
  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate: Date = startOfMonth(new Date());
  refresh = new Subject<void>();

  events: CalendarEvent[] = [];
  selectedDayEvents: CalendarEvent[] = [];
  isLoading = true;
  isPickerOpen = false;

  constructor(
    private toastController: ToastController,
    private calendarDataService: CalendarDataService,
    private authService: AuthenticationService
  ) {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'calendar-outline': calendarOutline,
      'checkmark-circle': checkmarkCircle,
    });
  }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.loadEvents();
      } else {
        this.isLoading = false;
        this.events = [];
        this.refresh.next();
      }
    });
  }

  async loadEvents() {
    this.isLoading = true;
    try {
      const doseRecords = await this.calendarDataService.getDoses();
      this.events = doseRecords.map(this.mapDtoToEvent);
      this.refresh.next();
    } catch (error) {
      this.presentToast('Error al cargar los eventos.');
      console.error('Error fetching doses:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Convierte un registro de dosis de la BD a un evento del calendario,
   * usando el color dinámico del medicamento.
   */
  mapDtoToEvent = (dose: DoseRecordDto): CalendarEvent => {
    const isTaken = dose.status === 1;

    // ✅ LÓGICA DE COLOR ACTUALIZADA:
    // - Si la dosis ya fue tomada, se usa el color verde.
    // - Si está pendiente, se usa el color que viene de la base de datos.
    // - Si no viene un color, se usa un gris por defecto.
    const eventColor = isTaken 
      ? colors.tomado 
      : { 
          primary: dose.medicationColor || colors.default.primary, 
          secondary: `${dose.medicationColor || colors.default.primary}33` // Añade transparencia
        };

    return {
      id: dose.recordID,
      start: new Date(dose.scheduledTime),
      title: `${dose.medicationName}`,
      color: eventColor, // Se asigna el color dinámico
      meta: {
        isTaken: isTaken,
      },
    };
  };

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    if (!isSameMonth(date, this.viewDate)) return;

    if (isSameDay(this.viewDate, date) && this.selectedDayEvents.length > 0) {
      this.selectedDayEvents = [];
    } else {
      this.viewDate = date;
      this.selectedDayEvents = events;
    }
  }

  getToday(): Date {
    return new Date();
  }

  changeDate(amount: number): void {
    this.viewDate = addMonths(this.viewDate, amount);
  }

  setPickerOpen(isOpen: boolean) {
    this.isPickerOpen = isOpen;
  }

  handleDateChange(event: any) {
    const newDate = new Date(event.detail.value);
    this.viewDate = startOfMonth(newDate);
    this.setPickerOpen(false);
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    toast.present();
  }
}

