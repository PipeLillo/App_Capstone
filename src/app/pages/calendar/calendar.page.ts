import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, ViewWillEnter } from '@ionic/angular';
import { Subject } from 'rxjs';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, calendarOutline, checkmarkCircle, closeOutline, checkmark, add } from 'ionicons/icons';

import { CalendarEvent, CalendarModule, CalendarView } from 'angular-calendar';
import { startOfMonth, isSameMonth, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale'; // Importamos el locale español

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
  // Por defecto, es la fecha de hoy, pero se actualiza con el clic.
  selectedDateForForm: Date = new Date();

  availableColors = [
    '#ad2121', '#1e90ff', '#e3bc08', '#7a04eb', '#2dd36f', '#ff00ff'
  ];

  formData = {
    medicationName: '',
    dose: null as number | null,
    frequency: null as number | null,
    scheduledTime: '',
    endDate: '',
    selectedColor: '#ad2121',
    notes: ''
  };

  // Nueva propiedad para controlar el rango de fechas personalizado
  calendarRange: { start: Date; end: Date } = { start: new Date(), end: new Date() };

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
      'checkmark': checkmark,
      'add': add
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
    this.updateCalendarRange();
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

  // La variable se mantiene, aunque su lógica de prevención de doble clic se elimina.
  private lastClickedDate: Date | null = null;

  /**
   * Mantiene la fecha clickeada seleccionada y actualiza la vista.
   * NO abre el formulario, solo captura el día.
   */
  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    // 1. CAPTURAR EL DÍA SELECCIONADO (hacemos copia para evitar referencias inesperadas)
    this.selectedDateForForm = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    this.selectedDayEvents = events;
    this.lastClickedDate = new Date(date.getTime()); // Mantener la referencia

    // 2. Si se hizo clic en un día de otro mes, cambiar la vista.
    if (!isSameMonth(date, this.viewDate)) {
      this.viewDate = date;
      this.updateCalendarRange();
    }

    // 3. Asegurar que el formulario esté cerrado. El FAB lo abrirá.
    this.setFormOpen(false);
  }

  // Nueva función para encapsular la inicialización del formulario (no muta selectedDateForForm)
  initFormData(date: Date) {
    const now = new Date();

    // Copia de la fecha seleccionada (solo componentes de fecha)
    const baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Definimos hora por defecto igual a la hora actual (componentes locales)
    const startDateForPlan = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      now.getHours(),
      now.getMinutes(),
      0, 0
    );

    const defaultEndDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate() + 7,
      now.getHours(),
      now.getMinutes(),
      0, 0
    );

    this.formData = {
      medicationName: '',
      dose: null,
      frequency: null,
      // scheduledTime guarda un ISO que representa la hora local por defecto
      scheduledTime: startDateForPlan.toISOString(),
      endDate: defaultEndDate.toISOString(),
      selectedColor: this.availableColors[0],
      notes: ''
    };
    this.setFormOpen(true);
  }

  /**
   * FUNCIÓN MODIFICADA: Abre el formulario usando la fecha seleccionada (`this.selectedDateForForm`).
   * Ahora valida sin mutar la fecha original.
   */
  openAddMedicationForm() {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // inicio del día local

    // Copia de la fecha seleccionada (solo fecha)
    const dateToUse = new Date(
      this.selectedDateForForm.getFullYear(),
      this.selectedDateForForm.getMonth(),
      this.selectedDateForForm.getDate()
    );
    const dateStart = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), dateToUse.getDate());

    // 1. Validar que la fecha capturada no sea pasada
    if (dateStart.getTime() >= todayStart.getTime()) {
      // 2. La fecha es válida, inicializamos el formulario con esa fecha.
      this.initFormData(dateToUse);
    } else {
      // 3. Notificación si la fecha es pasada
      this.presentToast('No puedes agregar tratamientos para una fecha pasada. Selecciona el día de hoy o uno futuro.', 'warning');
      this.setFormOpen(false);
    }
  }

  selectColor(color: string) {
    this.formData.selectedColor = color;
  }

  setFormOpen(isOpen: boolean) {
    this.isFormOpen = isOpen;
  }

  // helper: retorna string ISO-like sin zona (YYYY-MM-DDTHH:mm:ss)
  private formatWallClock(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`; // sin Z, sin offset
  }

  // ✅ FUNCIÓN SAVEFORM CONECTADA A AZURE (con logs y campos extra)
  async saveForm() {
    // 1. Validaciones
    if (!this.formData.medicationName) {
      this.presentToast('Falta el nombre del medicamento', 'warning');
      return;
    }
    if (this.formData.dose === null || this.formData.dose === undefined) {
      this.presentToast('Falta ingresar la dosis (mg)', 'warning');
      return;
    }
    if (this.formData.frequency === null || this.formData.frequency === undefined) {
      this.presentToast('Ingresa cada cuántas horas se debe tomar', 'warning');
      return;
    }

    // 2. Preparar Fechas (sin mutar originales)
    // Fecha seleccionada (solo fecha)
    const datePart = new Date(
      this.selectedDateForForm.getFullYear(),
      this.selectedDateForForm.getMonth(),
      this.selectedDateForForm.getDate()
    );

    // Hora seleccionada en el formulario (puede venir como ISO); tomamos horas/minutos locales
    const timePart = new Date(this.formData.scheduledTime);

    // Construimos una nueva Date en HORARIO LOCAL con la fecha seleccionada y la hora del formulario
    const startDateLocal = new Date(
      datePart.getFullYear(),
      datePart.getMonth(),
      datePart.getDate(),
      timePart.getHours(),
      timePart.getMinutes(),
      0,
      0
    );

    const endDateObj = new Date(this.formData.endDate);

    if (endDateObj <= startDateLocal) {
      this.presentToast('La fecha de término debe ser posterior al inicio', 'warning');
      return;
    }

    // --- LOGS para depuración: qué vamos a enviar ---
    console.log('[DEBUG] startDateLocal (toString):', startDateLocal.toString());
    console.log('[DEBUG] startDateLocal (toISOString):', startDateLocal.toISOString());
    console.log('[DEBUG] startDateWallClock (no timezone):', this.formatWallClock(startDateLocal));
    console.log('[DEBUG] timezoneOffsetMinutes:', startDateLocal.getTimezoneOffset());

    // 3. Empaquetar datos (añadimos startDateWallClock y timezoneOffsetMinutes)
    const datosParaGuardar = {
      medicationName: this.formData.medicationName,
      medicationColor: this.formData.selectedColor,
      userDose: this.formData.dose,
      frequencyValue: this.formData.frequency,
      frequencyType: 'Horas',
      // ISO (instante, será interpretado como UTC por el backend)
      startDate: startDateLocal.toISOString(),
      // Wall-clock (string sin Z — la hora exacta que el usuario ve)
      startDateWallClock: this.formatWallClock(startDateLocal),
      // Offset en minutos respecto a UTC (ej. 180 para UTC-3)
      timezoneOffsetMinutes: startDateLocal.getTimezoneOffset(),
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

  changeDate(amount: number): void {
    this.viewDate = addMonths(this.viewDate, amount);
    // Actualizar el rango de fechas para el encabezado
    this.updateCalendarRange();
  }

  // Nueva función para actualizar el rango de fechas
  updateCalendarRange() {
    const start = startOfWeek(this.viewDate, { weekStartsOn: 1 }); // Lunes
    const end = endOfWeek(this.viewDate, { weekStartsOn: 1 }); // Domingo
    this.calendarRange = { start, end };
  }

  setPickerOpen(isOpen: boolean) { this.isPickerOpen = isOpen; }

  handleDateChange(event: any) {
    const newDate = new Date(event.detail.value);
    this.viewDate = startOfMonth(newDate);
    this.setPickerOpen(false);
    this.updateCalendarRange();
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({ message, duration: 3000, position: 'bottom', color });
    toast.present();
  }

  // ✅ FUNCIÓN PARA FILTRAR DUPLICADOS VISUALES EN EL CALENDARIO
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
