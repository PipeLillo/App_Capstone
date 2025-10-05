import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthenticationService } from '../../services/authentication.service';
import { User } from 'firebase/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class LoginPage implements OnInit, OnDestroy {
  errorMessage: string | null = null;
  loading = false;
  sub?: Subscription;

  constructor(private auth: AuthenticationService, private router: Router) {}

  ngOnInit() {
    this.sub = this.auth.user$.subscribe((user: User | null) => {
      if (user) {
        console.log('Usuario autenticado -> redirigiendo a /home');
        this.router.navigateByUrl('/home', { replaceUrl: true });
      } else {
        console.log('Usuario no autenticado -> mostrando login.');
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  async signInWithGoogle() {
    if (this.loading) return;
    this.loading = true;
    this.errorMessage = null;

    try {
      const user = await this.auth.signInWithGoogle();

      // En web (popup) vuelve con user -> navega al tiro
      if (user) {
        this.router.navigateByUrl('/home', { replaceUrl: true });
      }
      // En redirect (nativo o fallback), el regreso se procesa en initAuth() y navegará solo
    } catch (e: any) {
      this.errorMessage = e?.message || 'No se pudo iniciar sesión.';
      console.error(e);
    } finally {
      this.loading = false; // nunca se queda pegado
    }
  }
}
