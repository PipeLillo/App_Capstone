import { Component, OnInit, OnDestroy } from '@angular/core';
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
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';

import { AuthenticationService } from '../services/authentication.service';

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
  ],
})
export class HomePage implements OnInit, OnDestroy {
  greeting = '¡Hola!';
  private sub?: Subscription;

  constructor(private auth: AuthenticationService) {}

  ngOnInit(): void {
    this.sub = this.auth.user$.subscribe(user => {
      const display = user?.displayName?.trim() || '';
      let first = '';

      if (display) {
        first = display.split(/\s+/)[0]; // primer nombre
      } else if (user?.email) {
        first = user.email.split('@')[0]; // fallback por email
      }

      if (first) {
        this.greeting = `¡Hola, ${this.capFirst(first)}!`;
      } else {
        this.greeting = '¡Hola!';
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Deja solo la primera letra en mayúscula y el resto en minúscula (con locale ES) */
  private capFirst(s: string): string {
    const lower = s.toLocaleLowerCase('es');
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
  }
}
