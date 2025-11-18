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
    // Hacemos el callback async para poder usar await
    this.sub = this.auth.user$.subscribe(async (user: User | null) => {
      if (user) {
        console.log('Usuario autenticado:', user.uid);

        try {
          // --- AQUÍ OBTENEMOS EL TOKEN ---
          const token = await user.getIdToken();
          console.log('🔥 FIREBASE ID TOKEN:', token);
          // -------------------------------
        } catch (error) {
          console.error('Error obteniendo el token:', error);
        }

        console.log('Redirigiendo a /home...');
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

      if (user) {
        // Opcional: También puedes imprimirlo aquí si el login es directo (popup)
        const token = await user.getIdToken();
        console.log('🔥 Token tras login manual:', token);
        
        this.router.navigateByUrl('/home', { replaceUrl: true });
      }
    } catch (e: any) {
      this.errorMessage = e?.message || 'No se pudo iniciar sesión.';
      console.error(e);
    } finally {
      this.loading = false;
    }
  }
}