import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, Auth, User, signOut, getRedirectResult,
  setPersistence, browserLocalPersistence, indexedDBLocalPersistence
} from 'firebase/auth';

import { Capacitor } from '@capacitor/core';

export interface UserInfoResponse {
  FirebaseUid: string;
  Email: string | null;
  DisplayName: string | null;
  PhotoURL: string | null;
  Peso: number | null;
  Altura: number | null;
  Edad: number | null;
  ContactoEmergencia: string | null;
  Direccion: string | null;
  Contraindicaciones: string | null;
  Alergias: string | null;              // "a;b;c"
  EnfermedadesCronicas: string | null;  // "a;b;c"
  MedicacionPermanente: string | null;
  Discapacidades: string | null;        // "a;b;c"
}

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private app: FirebaseApp;
  private auth: Auth;
  private provider = new GoogleAuthProvider();

  // ⚠️ Mueve esto a environment.ts en producción
   private firebaseConfig = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
  };
  private azureSaveUrl    = '';
  private azureUpdateUrl  = '';
  private azureGetUrl     = '';
  private azureSaveKey    = '';
  private azureUpdateKey  = '';
  private azureGetKey     = '';

  private _user$ = new BehaviorSubject<User | null>(null);
  public user$ = this._user$.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Inicializa Firebase una sola vez
    this.app = getApps().length ? getApps()[0] : initializeApp(this.firebaseConfig);
    this.auth = getAuth(this.app);
  }

  /**
   * Inicialización BLOQUEANTE de Auth (la llama APP_INITIALIZER):
   * 1) Persistencia
   * 2) Procesa redirect (si lo hubo)
   * 3) Activa listener
   */
  async initAuth(): Promise<void> {
    const isNative = Capacitor.isNativePlatform();

    // 1) Persistencia
    try {
      await setPersistence(
        this.auth,
        isNative ? indexedDBLocalPersistence : browserLocalPersistence
      );
      console.log(`[Auth] Persistencia lista: ${isNative ? 'indexedDB (nativo)' : 'localStorage (web)'}`);
    } catch (err) {
      console.warn('[Auth] No se pudo establecer persistencia:', err);
    }

    // 2) Procesar redirect ANTES de que el router haga su primera navegación
    try {
      const result = await getRedirectResult(this.auth);
      if (result?.user) {
        console.log('[Auth] Redirect OK -> usuario recibido', result.user.uid);
        await this.saveUserToDatabase(result.user);
        this.router.navigateByUrl('/home', { replaceUrl: true });
      } else {
        console.log('[Auth] No hay redirect pendiente');
      }
    } catch (e) {
      console.log('[Auth] Error al procesar redirect (no fatal):', e);
    }

    // 3) Listener de sesión
    onAuthStateChanged(this.auth, (user) => {
      console.log('[Auth] onAuthStateChanged ->', user?.uid || null);
      this._user$.next(user);
    });
  }

  /**
   * Inicia sesión con Google:
   * - Nativo (Capacitor): redirect
   * - Web: popup (recomendado). Si popup bloqueado -> fallback a redirect.
   * - Si el usuario cierra el popup, mostramos un mensaje claro.
   */
  async signInWithGoogle(): Promise<User | null | void> {
    const isNative = Capacitor.isNativePlatform();
    const isCrossIsolated = (window as any).crossOriginIsolated === true;
    console.log('[Auth] signInWithGoogle -> isNative =', isNative, 'crossOriginIsolated =', isCrossIsolated);

    // En nativo o páginas aisladas COOP/COEP: usa redirect
    if (isNative || isCrossIsolated) {
      await signInWithRedirect(this.auth, this.provider);
      return null;
    }

    // Web normal -> POPUP + fallback
    try {
      const result = await signInWithPopup(this.auth, this.provider);
      const user = result.user;
      if (!user) throw new Error('No se obtuvo el usuario tras el inicio de sesión.');
      await this.saveUserToDatabase(user);
      return user; // Permite navegar inmediatamente en LoginPage
    } catch (err: any) {
      const code = err?.code as string | undefined;

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('Inicio cancelado. Vuelve a intentar y no cierres la ventana de Google.');
      }
      if (code === 'auth/popup-blocked') {
        console.warn('[Auth] Popup bloqueado -> usando Redirect');
        await signInWithRedirect(this.auth, this.provider);
        return null;
      }

      throw err;
    }
  }

  /** Guarda/actualiza el usuario en Azure Function (registro inicial) */
  private async saveUserToDatabase(user: User): Promise<void> {
    const payload = {
      firebaseUid: user.uid,
      userEmail: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-functions-key': this.azureSaveKey,
    });

    // También añadimos la key en query (?code=) por compatibilidad
    const url = `${this.azureSaveUrl}?code=${this.azureSaveKey}`;

    // La Function responde TEXTO; pide texto (hack typings: 'text' as 'json')
    await firstValueFrom(
      this.http.post(url, payload, { headers, responseType: 'text' as 'json' })
    );
  }

  /** Actualiza información adicional del usuario (updateuserinfo) */
  async updateUserInfo(userData: {
    peso?: number | null;
    altura?: number | null;
    edad?: number | null;
    contactoEmergencia?: string | null;
    direccion?: string | null;
    contraindicaciones?: string | null;
    alergias?: string | null;              // "a;b;c"
    enfermedadesCronicas?: string | null;  // "a;b;c"
    medicacionPermanente?: string | null;
    discapacidades?: string | null;        // "a;b;c"
  }): Promise<void> {
    const uid = this.currentUser?.uid;
    if (!uid) throw new Error('Debes iniciar sesión para actualizar tu información.');

    const payload = { firebaseUid: uid, ...userData };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-functions-key': this.azureUpdateKey,
    });

    // IMPORTANTE: también anexamos ?code=
    const url = `${this.azureUpdateUrl}?code=${this.azureUpdateKey}`;

    // La Function responde TEXTO; pide texto (hack typings: 'text' as 'json')
    await firstValueFrom(
      this.http.post(url, payload, { headers, responseType: 'text' as 'json' })
    );
  }

  /** Lee la información del usuario para prellenar el formulario (getuserinfo) */
  async fetchUserInfo(): Promise<UserInfoResponse | null> {
    const uid = this.currentUser?.uid;
    if (!uid) throw new Error('No hay usuario autenticado.');

    const headers = new HttpHeaders({
      'x-functions-key': this.azureGetKey,
    });

    const url = `${this.azureGetUrl}?firebaseUid=${encodeURIComponent(uid)}&code=${this.azureGetKey}`;

    try {
      return await firstValueFrom(
        this.http.get<UserInfoResponse>(url, { headers })
      );
    } catch (e: any) {
      if (e?.status === 404) return null; // sin datos aún
      throw e;
    }
  }

  /** Cierra sesión y redirige al login */
  async logout(): Promise<void> {
    await signOut(this.auth);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  /** Snapshot del usuario actual */
  get currentUser(): User | null {
    return this._user$.value;
  }
}
