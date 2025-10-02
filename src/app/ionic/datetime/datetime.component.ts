import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
// 🔑 Importamos AlertController (y todos los demás) para usarlos en el TS y la inyección
import { IonButtons, IonContent, IonHeader, IonMenuButton, IonTitle, 
  IonToolbar, IonDatetime, IonDatetimeButton, IonModal, IonLabel, 
  IonItem, IonButton, AlertController  } from '@ionic/angular/standalone';


@Component({
  selector: 'app-datetime',
  templateUrl: './datetime.component.html',
  styleUrls: ['./datetime.component.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    FormsModule,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonLabel,
    IonItem,
    IonButton,
    IonContent
  ] 
})
export class DatetimeComponent  implements OnInit {

  @ViewChild('datetime') dateTime!: IonDatetime // Usamos '!' para asignación diferida

  date: any;


  // 🔑 INYECTAMOS AlertController en el constructor
  constructor(private alertController: AlertController) { } 

  ngOnInit() {}
  
  // MÉTODO EXISTENTE: Lógica para changeTime
  changeTime(ev: any){
    console.log('changeTime ->', ev);
    console.log('dateTime.value ->', this.dateTime.value);
    const select: any = this.dateTime.value;
    const date = new Date(select);
    console.log('date ->', date);
  }

  // 🔑 MÉTODO PRINCIPAL: Muestra la información en un cuadro de diálogo
  async logDateChange(event: any) {
    const selectedDateValue = event.detail.value;
    
    // 1. Procesa el valor a un formato legible
    const dateObject = new Date(selectedDateValue);
    const readableDate = dateObject.toLocaleDateString(); 
    
    // 2. Crea la alerta
    const alert = await this.alertController.create({
      header: 'Fecha Seleccionada',
      message: `La fecha seleccionada es: ${readableDate}`,
      buttons: ['OK'],
      // 🔑 AÑADIMOS la clase CSS global
      cssClass: 'red-alert-text' 
    });

    // 3. Muestra la alerta
    await alert.present();
  }

  save() {
    console.log('save ->', this.date);
  }

}
