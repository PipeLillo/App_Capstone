import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; // <-- 1. AÑADIDO: ChangeDetectorRef
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
  AlertController,
  ViewWillEnter // <-- 2. AÑADIDO: Interfaz para ionViewWillEnter
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';

import { AuthenticationService } from '../services/authentication.service';
import { CalendarDataService, DoseRecordDto } from '../services/calendar-data.service';

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
export class HomePage implements OnInit, OnDestroy, ViewWillEnter { // <-- 3. Implementa ViewWillEnter
  greeting = '¡Hola!';
  private sub?: Subscription;

  public proximosEventos: DoseRecordDto[] = [];
  public isLoading: boolean = true;

  constructor(
    private auth: AuthenticationService,
    private calendarService: CalendarDataService,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef // <-- 4. INYECTADO: Change Detector Ref
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
    this.loadEventos(); // ✅ La carga de datos se hace en el hook correcto.
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
  
  async loadEventos() {
    this.isLoading = true;
    try {
      const todosLosEventos = await this.calendarService.getDoses();
      const now = new Date();

      // Lógica de filtrado y ordenación
      this.proximosEventos = todosLosEventos
        .filter(evento => new Date(evento.scheduledTime) > now)
        .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
        .slice(0, 3);

      // 🚨 FIX: Forzamos a Angular a revisar la variable para que se muestre en la vista
      this.cdr.detectChanges(); // <-- 5. LLAMADA CLAVE para solucionar el problema de renderizado inicial

    } catch (error) {
      console.error('Error al cargar los eventos', error);
    } finally {
      this.isLoading = false;
    }
  }

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
          text: 'He tomado mi medicamento',
          handler: () => {
            console.log('Medicamento tomado:', evento.recordID);
            // NOTA: Aquí iría la llamada a this.calendarService.updateDoseStatus(...)
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