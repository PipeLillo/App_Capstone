import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule} from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule]
})
export class RegisterPage {

  email!: string;
  password!: string;

  constructor(private router: Router) { }

  async register() {
    if (!this.email || !this.password) {
      console.log('Error: Por favor, ingresa un correo y una contraseña.');
      // Aquí podrías agregar una alerta o un mensaje de error visual para el usuario
      return;
    }

    // Esta es la lógica temporal que simula el registro
    console.log('Simulación de registro exitoso para el usuario:', this.email);
    console.log('Redirigiendo a la página de inicio...');

    // Navega a la página de inicio
    this.router.navigateByUrl('/home', { replaceUrl: true });
  }
}