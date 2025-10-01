import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, signOut } from 'firebase/auth'; 
import { ToastController } from '@ionic/angular'; // Importar el controlador de Toast

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  // Inyectamos el Router y el ToastController
  constructor(private router: Router, private toastController: ToastController) { }

  /**
   * Función auxiliar para crear una pausa de N milisegundos.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cierra la sesión del usuario con Toast y retardo de 2 segundos.
   */
  async logout(): Promise<void> {
    // 1. Mostrar el Toast de carga
    const loadingToast = await this.toastController.create({
      message: 'Cerrando sesión...',
      duration: 0, // Duración 0 significa que no desaparecerá solo
      position: 'bottom',
      color: 'dark',
      buttons: [{
        icon: 'hourglass-outline', // Icono de animación de carga
        side: 'start'
      }]
    });

    await loadingToast.present();

    try {
      // 2. Ejecutar la acción real
      const auth = getAuth();
      await signOut(auth);

      // 3. Simular el retardo de 2 segundos antes de la redirección
      await this.delay(2000); 

      // 4. Descartar el Toast
      await loadingToast.dismiss();
      
      // 5. Redirigir al login
      this.router.navigate(['/login']); 
      console.log('Sesión cerrada exitosamente.');

    } catch (error) {
      // Si falla, descartar el toast y mostrar error
      await loadingToast.dismiss();
      const errorToast = await this.toastController.create({
        message: 'Error al cerrar sesión. Inténtalo de nuevo.',
        duration: 3000,
        color: 'danger'
      });
      await errorToast.present();
      
      console.error('Error al cerrar sesión:', error);
    }
  }
}