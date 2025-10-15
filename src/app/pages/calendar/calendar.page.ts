import { Component} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subject } from 'rxjs';

// --- IMPORTACIONES NECESARIAS PARA ANGULAR-CALENDAR ---
import { CalendarEvent, CalendarModule, CalendarView } from 'angular-calendar';
// --- IMPORTACIÓN CLAVE AÑADIDA ---
import { startOfMonth, startOfDay, endOfDay, subDays, addDays, isSameMonth, isSameDay, addMonths, addWeeks } from 'date-fns';

// Definición de colores para los eventos
const colors: any = {
  rojo: { primary: '#ad2121', secondary: '#FAE3E3' },
  azul: { primary: '#1e90ff', secondary: '#D1E8FF' },
  amarillo: { primary: '#e3bc08', secondary: '#FDF1BA' },
};

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CalendarModule
  ],

})
export class CalendarPage {
  
  // 1. Configuración de la vista
  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;

  // Inicializamos la fecha en el PRIMER día del mes actual.
  viewDate: Date = startOfMonth(new Date());
  
  refresh = new Subject<void>();
  activeDayIsOpen: boolean = false;

  // 2. Definición de eventos iniciales con fechas fijas
  events: CalendarEvent[] = [
    {
      // Evento que dura 3 días, del 8 al 10 del mes actual
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 8),
      end: new Date(new Date().getFullYear(), new Date().getMonth(), 10),
      title: 'Conferencia Anual (días 8-10)',
      color: colors.rojo,
      allDay: true,
      draggable: true,
      resizable: { beforeStart: true, afterEnd: true },
    },
    {
      // Evento en un día y hora específicos: día 15 del mes actual a las 10:00 AM
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 15, 10, 0),
      title: 'Reunión de Equipo a las 10:00 AM',
      color: colors.azul,
    },
    {
      // Evento de todo el día: día 22 del mes actual
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 22),
      title: 'Entrega de Proyecto',
      color: colors.amarillo,
      allDay: true,
    }
  ];

  // --- PROPIEDAD AÑADIDA PARA CORREGIR EL ERROR --- ✅
  // Almacena los eventos del día seleccionado para mostrarlos en la UI.
  selectedDayEvents: CalendarEvent[] = [];

  // 3. Lógica para manejar el clic en un día
  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    // --- CONSOLE.LOG AÑADIDO AQUÍ ---
    console.log('Datos del día presionado:', { date, events });

    if (isSameMonth(date, this.viewDate)) {
      if ((isSameDay(this.viewDate, date) && this.activeDayIsOpen === true) || events.length === 0) {
        this.activeDayIsOpen = false;
        this.selectedDayEvents = []; 
      } else {
        this.activeDayIsOpen = true;
        this.viewDate = date;
        this.selectedDayEvents = events; 
      }
    }
  }

  // 4. Lógica para manejar el arrastre o redimensionamiento de eventos
  eventTimesChanged({ event, newStart, newEnd }: any): void {
    event.start = newStart;
    event.end = newEnd;
    this.refresh.next();
  }

  // 5. Método para cambiar la vista (Mes, Semana, Día)
  setView(view: any) {
    if (view) {
      this.view = view as CalendarView;
    }
  }
  
  // 6. Método para añadir un evento de forma dinámica
  addEvent(): void {
    this.events = [
      ...this.events,
      {
        title: 'Nueva Cita Médica (Dinámica)',
        start: startOfDay(new Date()),
        end: endOfDay(new Date()),
        color: colors.amarillo,
        draggable: true,
        resizable: { beforeStart: true, afterEnd: true },
      },
    ];
    this.refresh.next();
  }

  // 7. Método para navegar entre fechas
  changeDate(amount: number): void {
    let newDate: Date;

    switch (this.view) {
      case CalendarView.Month:
        newDate = addMonths(this.viewDate, amount);
        this.viewDate = startOfMonth(newDate);
        break;
      case CalendarView.Week:
        this.viewDate = addWeeks(this.viewDate, amount);
        break;
      case CalendarView.Day:
        this.viewDate = addDays(this.viewDate, amount);
        break;
    }
    this.refresh.next();
  }
}

