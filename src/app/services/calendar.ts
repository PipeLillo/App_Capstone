import { Injectable } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { startOfDay, subDays, addDays } from 'date-fns';

// ... (Tu objeto de colores puede ir aquí también)

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  // Los eventos ahora viven aquí, en el servicio
  private events: CalendarEvent[] = [
    {
      start: subDays(startOfDay(new Date()), 1),
      title: 'Cita de Seguimiento',
      // ...
    },
    // ... otros eventos
  ];

  constructor() { }

  // Método para obtener todos los eventos
  getEvents(): CalendarEvent[] {
    return this.events;
  }

  // Método para añadir un nuevo evento
  addEvent(newEvent: CalendarEvent): void {
    this.events.push(newEvent);
  }
}