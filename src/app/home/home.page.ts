import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonTabBar,
  IonTabButton,
  IonLabel,
  IonCard,
  IonItem,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';

import { AuthenticationService } from '../services/authentication.service';
import { CalendarDataService, DoseRecordDto } from '../services/calendar-data.service';

// --> AÑADIDO: Importa el controlador de Alertas
import { AlertController } from '@ionic/angular'; 

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    CommonModule,
    RouterModule,
    IonContent,
    IonButton,
    IonIcon,
    IonTabBar,
    IonTabButton,
    IonLabel,
    IonCard,
    IonItem,
    IonSpinner,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  greeting = '¡Hola!';
  private sub?: Subscription;

  public proximosEventos: DoseRecordDto[] = [];
  public isLoading: boolean = true;

  constructor(
    private auth: AuthenticationService,
    private calendarService: CalendarDataService,
    private alertCtrl: AlertController // --> AÑADIDO: Inyecta el AlertController
  ) {}

  ngOnInit(): void {
    // (Tu lógica de saludo existente...)
    this.sub = this.auth.user$.subscribe(user => {
      const display = user?.displayName?.trim() || '';
      let first = '';
      if (display) {
        first = display.split(/\s+/)[0];
      } else if (user?.email) {
        first = user.email.split('@')[0];
      }
      if (first) {
        this.greeting = `¡Hola, ${this.capFirst(first)}!`;
      } else {
        this.greeting = '¡Hola!';
      }
    });
  }

  ionViewWillEnter() {
    this.loadEventos();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
  
  async loadEventos() {
    this.isLoading = true;
    try {
      const todosLosEventos = await this.calendarService.getDoses();
      const now = new Date();

      // ESTA LÓGICA CUMPLE TU REQUISITO DE ORDENACIÓN:
      this.proximosEventos = todosLosEventos
        .filter(evento => new Date(evento.scheduledTime) > now) // 1. Solo futuros
        .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()) // 2. Ordena por fecha más próxima
        .slice(0, 3); // 3. Toma solo los 3 primeros

  } catch (error) {
      console.error('Error al cargar los eventos', error);
    } finally {
      this.isLoading = false;
    }
  }

  // --> AÑADIDO: Nueva función para la alerta
  async marcarComoTomado(evento: DoseRecordDto) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Toma',
      message: `¿Confirmas que has tomado tu ${evento.medicationName}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          // Este es el botón de confirmación que pediste
          text: 'He tomado mi medicamento',
          handler: () => {
            console.log('Medicamento tomado:', evento.recordID);
            // NOTA: Aquí es donde deberías llamar a tu servicio
            // para guardar en la BD que este evento.status cambió.
            // Por ejemplo: this.calendarService.updateDoseStatus(evento.recordID, 1);
          }
        }
      ]
    });

    await alert.present();
  }

  private capFirst(s: string): string {
    const lower = s.toLocaleLowerCase('es');
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
  }
}