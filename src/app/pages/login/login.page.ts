// login.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

// Importaciones de Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LoginPage implements OnInit {

  email: string = '';
  password: string = '';

  firebaseUser: User | null = null;
  errorMessage: string | null = null;

  // ❌ ATENCIÓN: Por favor, elimina este bloque manualmente antes de subir a Git.
  // Este es el único lugar donde se definen las claves para que puedas borrarlas fácilmente.
  // Para una seguridad óptima, se recomienda usar un archivo .env.
  private API_KEYS = {
    firebaseConfig: {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: "",
      measurementId: ""
    },
    azureFunctionUrl: '',
    azureFunctionKey: ''
  };
  
  private firebaseConfig = this.API_KEYS.firebaseConfig;
  private auth: any;
  private azureFunctionUrl = this.API_KEYS.azureFunctionUrl;
  private functionKey = this.API_KEYS.azureFunctionKey;


  constructor(private router: Router) { }

  ngOnInit() {
    try {
      const app = initializeApp(this.firebaseConfig);
      this.auth = getAuth(app);

      // Listener de autenticación, ahora asíncrono
      onAuthStateChanged(this.auth, async (user: User | null) => {
        this.firebaseUser = user;
        if (user) {
          console.log('Usuario autenticado:', user);
          this.router.navigateByUrl('/home', { replaceUrl: true });
        } else {
          console.log('Usuario no autenticado');
        }
      });
    } catch (error: any) {
      this.errorMessage = 'Error de inicialización de Firebase: ' + error.message;
      console.error('Error de inicialización de Firebase:', error);
    }
  }

  // Método para iniciar sesión con Google
  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      console.log('Inicio de sesión con Google exitoso. Llamando a la función de Azure...');

      // Llama a la función de Azure para guardar los datos en la base de datos
      await this.saveUserToDatabase(result.user.uid, result.user.email);

    } catch (error: any) {
      this.errorMessage = 'Error al iniciar sesión: ' + error.message;
      console.error('Error al iniciar sesión:', error);
    }
  }

  // Nuevo método para llamar a la función de Azure
  private async saveUserToDatabase(uid: string, email: string | null) {
    try {
      const urlWithKey = `${this.azureFunctionUrl}?code=${this.functionKey}`;

      // Configura los headers para una solicitud POST con JSON
      const response = await fetch(urlWithKey, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firebaseUid: uid,
          userEmail: email
        })
      });

      if (response.ok) {
        console.log('Usuario guardado exitosamente en la base de datos.');
      } else {
        const errorData = await response.json();
        console.error('Error al guardar en la base de datos:', errorData);
      }
    } catch (error: any) {
      // Este error captura problemas de red, como CORS
      console.error('Error de red al llamar a la función de Azure:', error);
    }
  }

  // Método para el login tradicional
  async login() {
    // Aquí iría tu lógica de autenticación tradicional
  }
}