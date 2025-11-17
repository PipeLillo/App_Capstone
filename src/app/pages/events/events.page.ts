import { Component, OnInit } from '@angular/core';
// 1. IMPORTA LO QUE NECESITAS (SOBRE TODO CommonModule y FormsModule)
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-events',
  templateUrl: './events.page.html',
  styleUrls: ['./events.page.scss'],
  
  // 2. AÑADE standalone: true
  standalone: true, 

  // 3. AÑADE LOS MÓDULOS QUE USA EL HTML
  imports: [
    IonicModule,     // Para <ion-button>, <ion-datetime>, etc.
    CommonModule,    // Para *ngIf
    FormsModule      // Para [(ngModel)]
  ]
})
export class EventsPage implements OnInit {

  // --- VARIABLES DE ESTADO ---
  isFormVisible: boolean = false;
  
  // Variable para el binding [(ngModel)]
  mensaje: string = ''; 
  
  // Variables para mostrar la fecha formateada
  fechaSeleccionadaDisplay: string = '';
  private fechaISO: string = ''; // Para guardar la fecha en formato ISO

  constructor() { }

  ngOnInit() {
  }

  // --- MÉTODOS (LÓGICA) ---

  /**
   * Se llama CADA VEZ que el usuario cambia la fecha en el calendario.
   */
  fechaSeleccionada(event: any) {
    // 1. Obtenemos el valor de la fecha del evento (viene en formato ISO)
    const fechaISO = event.detail.value;
    
    // 2. Guardamos la fecha ISO para usarla al "Guardar"
    this.fechaISO = fechaISO;

    // 3. Formateamos la fecha para mostrarla (Ej: "6 de Noviembre")
    const fechaObj = new Date(fechaISO);
    this.fechaSeleccionadaDisplay = fechaObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 4. Mostramos el formulario
    this.isFormVisible = true;
  }

  /**
   * Se llama al hacer clic en "Guardar Evento"
   */
  guardarEvento() {
    console.log('--- Evento Guardado ---');
    console.log('Fecha ISO:', this.fechaISO);
    console.log('Mensaje:', this.mensaje);

    // Lógica (aquí iría tu servicio para guardar en la BD)
    
    // Opcional: Ocultar y resetear el formulario
    this.ocultarFormulario();
  }

  /**
   * Se llama al hacer clic en "Cancelar"
   */
  cancelar() {
    this.ocultarFormulario();
  }

  /**
   * Oculta el formulario y limpia las variables
   */
  private ocultarFormulario() {
    this.isFormVisible = false;
    this.mensaje = '';
    this.fechaISO = '';
  }
}