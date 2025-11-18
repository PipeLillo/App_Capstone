import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';       // <--- Necesario para *ngFor y *ngIf
import { FormsModule } from '@angular/forms';         // <--- Necesario para [(ngModel)]
import { IonicModule } from '@ionic/angular';         // <--- Necesario para todos los componentes ion-

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.page.html',
  styleUrls: ['./chatbot.page.scss'],
  standalone: true,  // <--- Indica que es un componente autónomo
  imports: [         // <--- AQUÍ AGREGAMOS LAS HERRAMIENTAS
    IonicModule, 
    CommonModule, 
    FormsModule
  ]
})
export class ChatbotPage implements OnInit {
  
  // Solución al error del signo de exclamación (!)
  @ViewChild('content') content!: any; // Usamos 'any' temporalmente o IonContent si lo importas arriba

  nuevoMensaje: string = '';
  
  mensajes = [
    { texto: '¡Hola! Soy tu asistente de salud. ¿En qué te puedo ayudar hoy?', enviadoPorMi: false, hora: '09:00' },
  ];

  constructor() { }

  ngOnInit() {}

  enviarMensaje() {
    if (!this.nuevoMensaje.trim()) return;

    // Agregar mi mensaje
    this.mensajes.push({
      texto: this.nuevoMensaje,
      enviadoPorMi: true,
      hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });

    this.nuevoMensaje = '';
    
    // Pequeño truco para hacer scroll abajo
    setTimeout(() => {
      if(this.content && this.content.scrollToBottom) {
        this.content.scrollToBottom(300);
      }
    }, 100);

    // Simular respuesta del bot
    setTimeout(() => {
      this.mensajes.push({
        texto: 'Entendido. Estoy consultando tu calendario de medicamentos...',
        enviadoPorMi: false,
        hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      });
      
      setTimeout(() => {
        if(this.content && this.content.scrollToBottom) {
          this.content.scrollToBottom(300);
        }
      }, 100);
      
    }, 1500);
  }
}