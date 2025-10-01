import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, IonButtons, IonBackButton } from '@ionic/angular/standalone'; 

// RUTA CORREGIDA: Sube dos niveles para llegar a 'services'
import { AuthenticationService } from '../../services/authentication.service'; 

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, IonButtons, IonBackButton
  ]
})
export class ProfilePage implements OnInit {

  // Inyectar el servicio de autenticación
  constructor(private authService: AuthenticationService) { }

  ngOnInit() { }
  
  /**
   * Método llamado por el botón del HTML para cerrar sesión.
   */
  async onLogout(): Promise<void> {
    console.log('Iniciando proceso de cierre de sesión...');
    await this.authService.logout(); // Llama a la lógica central del servicio
  }
}