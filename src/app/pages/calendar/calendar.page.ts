import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, ViewWillEnter } from '@ionic/angular';
import { Subject } from 'rxjs';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, calendarOutline, checkmarkCircle, closeOutline, checkmark } from 'ionicons/icons';

import { CalendarEvent, CalendarModule, CalendarView } from 'angular-calendar';
import { startOfMonth, isSameMonth, isSameDay, addMonths } from 'date-fns';

import { CalendarDataService, DoseRecordDto } from '../../services/calendar-data.service';
import { AuthenticationService } from '../../services/authentication.service';

const colors = {
  tomado: { primary: '#2dd36f', secondary: '#EAFBEF' },
  default: { primary: '#808080', secondary: '#E0E0E0' },
};

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, CalendarModule],
})
export class CalendarPage implements OnInit, ViewWillEnter {
  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate: Date = startOfMonth(new Date());
  refresh = new Subject<void>();

  events: CalendarEvent[] = [];
  selectedDayEvents: CalendarEvent[] = [];
  isLoading = true;
  isPickerOpen = false;

  // --- VARIABLES FORMULARIO ---
  isFormOpen = false;
  selectedDateForForm: Date = new Date();

  availableColors = [
    '#ad2121', '#1e90ff', '#e3bc08', '#7a04eb', '#2dd36f', '#ff00ff'
  ];

  formData = {
    medicationName: '',
    dose: null,
    frequency: null,
    scheduledTime: '',
    endDate: '',
    selectedColor: '#ad2121',
    notes: ''
  };

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
      'close-outline': closeOutline,
      'checkmark': checkmark
    });
  }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (!user) {
        this.isLoading = false;
        this.events = [];
        this.refresh.next();
      }
    });
  }

  ionViewWillEnter() {
    if (this.authService.currentUser) {
      this.loadEvents();
    }
  }

  async loadEvents() {
    this.isLoading = true;
    try {
      const doseRecords = await this.calendarDataService.getDoses();
      console.log('📦 DATOS RECIBIDOS DE AZURE:', doseRecords);
      this.events = doseRecords.map(this.mapDtoToEvent);
      this.refresh.next();
    } catch (error) {
      this.presentToast('Error al cargar los eventos.', 'danger');
      console.error('Error fetching doses:', error);
    } finally {
      this.isLoading = false;
    }
  }

  mapDtoToEvent = (dose: DoseRecordDto): CalendarEvent => {
    const isTaken = dose.status === 1;
    const dbColor = dose.medicationColor || colors.default.primary;
    const eventColor = isTaken 
      ? colors.tomado 
      : { primary: dbColor, secondary: dbColor + '33' };

    return {
      id: dose.recordID,
      start: new Date(dose.scheduledTime),
      title: `${dose.medicationName}`,
      color: eventColor,
      meta: { isTaken: isTaken },
    };
  };

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) {
      this.presentToast('No se pueden crear registros en fechas pasadas.', 'warning');
      return;
    }

    this.selectedDateForForm = date;
    this.viewDate = date;
    this.selectedDayEvents = events; 

    // Inicializar formulario
    const now = new Date();
    const defaultEndDate = new Date(date);
    defaultEndDate.setDate(defaultEndDate.getDate() + 7); // +7 días por defecto

    this.formData = {
      medicationName: '',
      dose: null,
      frequency: null,
      scheduledTime: now.toISOString(),
      endDate: defaultEndDate.toISOString(), 
      selectedColor: this.availableColors[0],
      notes: ''
    };

    this.setFormOpen(true);
  }

  selectColor(color: string) {
    this.formData.selectedColor = color;
  }

  setFormOpen(isOpen: boolean) {
    this.isFormOpen = isOpen;
  }

  // ✅ FUNCIÓN SAVEFORM CONECTADA A AZURE
  async saveForm() {
    // 1. Validaciones
    if (!this.formData.medicationName) {
      this.presentToast('Falta el nombre del medicamento', 'warning');
      return;
    }
    if (!this.formData.dose) {
      this.presentToast('Falta ingresar la dosis (mg)', 'warning');
      return;
    }
    if (!this.formData.frequency) {
      this.presentToast('Ingresa cada cuántas horas se debe tomar', 'warning');
      return;
    }

    // 2. Preparar Fechas
    const startDateObj = new Date(this.selectedDateForForm);
    const timeComponent = new Date(this.formData.scheduledTime);
    startDateObj.setHours(timeComponent.getHours(), timeComponent.getMinutes());

    const endDateObj = new Date(this.formData.endDate);

    if (endDateObj <= startDateObj) {
      this.presentToast('La fecha de término debe ser posterior al inicio', 'warning');
      return;
    }

    // 3. Empaquetar datos
    const datosParaGuardar = {
      medicationName: this.formData.medicationName,
      medicationColor: this.formData.selectedColor,
      userDose: this.formData.dose,
      frequencyValue: this.formData.frequency, 
      frequencyType: 'Horas',
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString(),
      notes: this.formData.notes
    };

    // 4. Llamada a la Base de Datos
    this.isLoading = true; 
    this.setFormOpen(false);

    try {
      console.log('🚀 Enviando a Azure:', datosParaGuardar);
      
      await this.calendarDataService.saveTreatment(datosParaGuardar);
      
      this.presentToast('¡Tratamiento creado exitosamente!', 'success');
      
      await this.loadEvents();

    } catch (error) {
      console.error('Error al guardar:', error);
      this.presentToast('Error al guardar el tratamiento. Intenta nuevamente.', 'danger');
      this.isLoading = false;
      this.setFormOpen(true);
    }
  }

  getToday(): Date { return new Date(); }
  changeDate(amount: number): void { this.viewDate = addMonths(this.viewDate, amount); }
  setPickerOpen(isOpen: boolean) { this.isPickerOpen = isOpen; }
  handleDateChange(event: any) {
    const newDate = new Date(event.detail.value);
    this.viewDate = startOfMonth(newDate);
    this.setPickerOpen(false);
  }
  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({ message, duration: 3000, position: 'bottom', color });
    toast.present();
  }

  // ✅ FUNCIÓN PARA FILTRAR DUPLICADOS VISUALES EN EL CALENDARIO
  // Esta función debe ser llamada desde el HTML en el *ngFor del template de celda
  getUniqueEvents(events: CalendarEvent[]): CalendarEvent[] {
    const uniqueEvents: CalendarEvent[] = [];
    const seenColors = new Set<string>();

    for (const event of events) {
      const colorPrimary = event.color?.primary;
      // Si hay color y no lo hemos visto antes en este día, lo agregamos
      if (colorPrimary && !seenColors.has(colorPrimary)) {
        seenColors.add(colorPrimary);
        uniqueEvents.push(event);
      }
    }
    return uniqueEvents;
  }
  
}