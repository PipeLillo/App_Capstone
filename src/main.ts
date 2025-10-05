import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { routes } from './app/app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { APP_INITIALIZER } from '@angular/core';
import { AuthenticationService } from './app/services/authentication.service';

function initAuth(auth: AuthenticationService) {
  // Debe devolver una función que retorne Promise<void> para bloquear la 1ª navegación
  return () => auth.initAuth();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideIonicAngular(),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [AuthenticationService],
      multi: true,
    },
  ],
});
