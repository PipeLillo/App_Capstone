// src/main.ts

import { bootstrapApplication, provideProtractorTestingSupport } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { routes } from './app/app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { APP_INITIALIZER, LOCALE_ID, importProvidersFrom } from '@angular/core'; // 👈 Añadido: importProvidersFrom y LOCALE_ID
import { AuthenticationService } from './app/services/authentication.service';

// --- Importaciones Específicas del Calendario ---
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'; // 👈 Necesario para animaciones
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

// 1. Registrar el idioma español globalmente
registerLocaleData(localeEs);
// ------------------------------------------------

function initAuth(auth: AuthenticationService) {
  return () => auth.initAuth();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideIonicAngular(),
    provideHttpClient(),

    // --- Configuración Global del Calendario e Idioma ---
    // 2. Establecer el idioma global a español
    { provide: LOCALE_ID, useValue: 'es' },
    
    // 3. Importar módulos que no son standalone (BrowserAnimations y CalendarModule)
    importProvidersFrom(
      BrowserAnimationsModule,
      CalendarModule.forRoot({
        provide: DateAdapter,
        useFactory: adapterFactory,
      })
    ),
    // ---------------------------------------------------
    
    // 4. Tu servicio de inicialización de autenticación
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [AuthenticationService],
      multi: true,
    },
  ],
});