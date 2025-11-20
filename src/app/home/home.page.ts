import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  ToastController, // <-- CORREGIDO: Importar ToastController
  ViewWillEnter // Interfaz para ionViewWillEnter
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
export class HomePage implements OnInit, OnDestroy, ViewWillEnter {
  greeting = '¡Hola!';
  private sub?: Subscription;

  public proximosEventos: DoseRecordDto[] = [];
  public isLoading: boolean = true;

  constructor(
    private auth: AuthenticationService,
    private calendarService: CalendarDataService,
    private alertCtrl: AlertController, // Inyectado
    private toastCtrl: ToastController, // <-- CORREGIDO: Inyectar ToastController
    private cdr: ChangeDetectorRef // Inyectado
  ) {}

  ngOnInit(): void {
    // Lógica de saludo
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
    this.loadEventos(); // Carga de datos
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async loadEventos() {
    this.isLoading = true;
    try {
      // Usamos el servicio de datos para obtener todos los registros del usuario
      const todosLosEventos = await this.calendarService.getDoses();
      const now = new Date();

      // Lógica de filtrado y ordenación para obtener solo los 3 próximos eventos
      this.proximosEventos = todosLosEventos
        .filter(evento => new Date(evento.scheduledTime) > now)
        .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
        .slice(0, 3);

      this.cdr.detectChanges(); // Forzar la detección de cambios
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

  // ---------------------------------------------------------------------
  // FUNCIÓN NUEVA: ELIMINAR DOSIS
  // ---------------------------------------------------------------------
  async eliminarDosis(evento: DoseRecordDto) {
    // Asumimos que DoseRecordDto contiene el recordID (clave primaria de DoseRecords)
    const recordID = evento.recordID;

    if (!recordID) {
      console.error('El evento no tiene un recordID válido para la eliminación.');
      return;
    }

    // 1. Mostrar alerta de confirmación antes de llamar a Azure
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que deseas eliminar el registro de ${evento.medicationName}? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.handleDeleteConfirmation(recordID, evento.medicationName);
          }
        }
      ]
    });

    await alert.present();
  }

  private async handleDeleteConfirmation(recordID: number, medicationName: string) {
    try {
      this.isLoading = true;

      // Llamada al método implementado en AuthenticationService
      await this.auth.deleteDoseRecord(recordID);

      // Recargar la lista de eventos para reflejar la eliminación
      await this.loadEventos();

      // CORREGIDO: Usar ToastController para la notificación de éxito
      const successToast = await this.toastCtrl.create({
        message: `El registro de ${medicationName} ha sido eliminado correctamente.`,
        duration: 2500,
        position: 'bottom' // Tostada aparece en la parte inferior
      });
      await successToast.present();

    } catch (error: any) {
      console.error('Error al eliminar la dosis:', error);
      const errorAlert = await this.alertCtrl.create({
        header: 'Error al Eliminar',
        // Mensaje más amigable
        message: error.message || 'No se pudo eliminar la dosis. El registro no existe o no tienes autorización.',
        buttons: ['OK']
      });
      await errorAlert.present();
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges(); // Asegurar que la vista se actualice
    }
  }
  // ---------------------------------------------------------------------

  private capFirst(s: string): string {
    const lower = s.toLocaleLowerCase('es');
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
  }
}