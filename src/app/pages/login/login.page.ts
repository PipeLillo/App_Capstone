import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule]
})
export class LoginPage {

  email!: string;
  password!: string;

  constructor(private router: Router) { }

  async login() {
    if (!this.email || !this.password) {
      console.log('Error: Por favor, ingresa tu correo y contraseña.');
      // Muestra una alerta o un mensaje de error al usuario
      return;
    }

    // Lógica temporal que simula un inicio de sesión exitoso
    console.log('Simulación de inicio de sesión exitoso para el usuario:', this.email);
    console.log('Redirigiendo a la página de inicio...');

    // Navega a la página de inicio
    this.router.navigateByUrl('/home', { replaceUrl: true });
  }
}