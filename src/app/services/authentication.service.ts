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
  Alergias: string | null;
  EnfermedadesCronicas: string | null;
  MedicacionPermanente: string | null;
  Discapacidades: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private app: FirebaseApp;
  private auth: Auth;
  private provider = new GoogleAuthProvider();

  // --- Configuraciones ---
  private firebaseConfig = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
  };

  // --- URLs de Azure Functions ---
  private azureBaseUrl      = '';
  
  private azureSaveUrl      = this.azureBaseUrl + '';
  private azureUpdateUrl    = this.azureBaseUrl + '';
  private azureGetUrl       = this.azureBaseUrl + '';
  private azureDeleteDoseUrl= this.azureBaseUrl + '';

  // --- Keys de Azure Functions ---
  private azureSaveKey      = '';
  private azureUpdateKey    = '';
  private azureGetKey       = '';
  private azureDeleteDoseKey= '';

  private _user$ = new BehaviorSubject<User | null>(null);
  public user$ = this._user$.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.app = getApps().length ? getApps()[0] : initializeApp(this.firebaseConfig);
    this.auth = getAuth(this.app);
  }

  async initAuth(): Promise<void> {
    const isNative = Capacitor.isNativePlatform();

    try {
      await setPersistence(
        this.auth,
        isNative ? indexedDBLocalPersistence : browserLocalPersistence
      );
      console.log(`[Auth] Persistencia lista: ${isNative ? 'indexedDB (nativo)' : 'localStorage (web)'}`);
    } catch (err) {
      console.warn('[Auth] No se pudo establecer persistencia:', err);
    }

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

    onAuthStateChanged(this.auth, (user) => {
      console.log('[Auth] onAuthStateChanged ->', user?.uid || null);
      this._user$.next(user);
    });
  }

  async signInWithGoogle(): Promise<User | null | void> {
    const isNative = Capacitor.isNativePlatform();
    const isCrossIsolated = (window as any).crossOriginIsolated === true;

    console.log('[Auth] signInWithGoogle -> isNative =', isNative, 'crossOriginIsolated =', isCrossIsolated);

    if (isNative || isCrossIsolated) {
      await signInWithRedirect(this.auth, this.provider);
      return null;
    }

    try {
      const result = await signInWithPopup(this.auth, this.provider);
      const user = result.user;
      if (!user) throw new Error('No se obtuvo el usuario tras el inicio de sesión.');
      await this.saveUserToDatabase(user);
      return user;
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

    // Se incluye la clave como parámetro 'code' para compatibilidad
    const url = `${this.azureSaveUrl}?code=${this.azureSaveKey}`;

    await firstValueFrom(
      this.http.post(url, payload, { headers, responseType: 'text' as 'json' })
    );
  }

  async updateUserInfo(userData: {
    peso?: number | null;
    altura?: number | null;
    edad?: number | null;
    contactoEmergencia?: string | null;
    direccion?: string | null;
    contraindicaciones?: string | null;
    alergias?: string | null;
    enfermedadesCronicas?: string | null;
    medicacionPermanente?: string | null;
    discapacidades?: string | null;
  }): Promise<void> {
    const uid = this.currentUser?.uid;
    if (!uid) throw new Error('Debes iniciar sesión para actualizar tu información.');

    const payload = { firebaseUid: uid, ...userData };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-functions-key': this.azureUpdateKey,
    });

    const url = `${this.azureUpdateUrl}?code=${this.azureUpdateKey}`;

    await firstValueFrom(
      this.http.post(url, payload, { headers, responseType: 'text' as 'json' })
    );
  }

  async fetchUserInfo(): Promise<UserInfoResponse | null> {
    const uid = this.currentUser?.uid;
    if (!uid) throw new Error('No hay usuario autenticado.');

    const headers = new HttpHeaders({
      'x-functions-key': this.azureGetKey,
    });

    const url = `${this.azureGetUrl}?firebaseUid=${encodeURIComponent(uid)}&code=${this.azureGetKey}`;

    try {
      return await firstValueFrom(this.http.get<UserInfoResponse>(url, { headers }));
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  }

  /**
   * Llama a la función de Azure para eliminar un registro de dosis específico.
   * @param recordID El ID del registro de dosis a eliminar (bigint).
   */
  async deleteDoseRecord(recordID: number): Promise<void> {
    const uid = this.currentUser?.uid;
    if (!uid) {
      throw new Error('Debes iniciar sesión para eliminar un registro.');
    }

    // CORRECCIÓN CLAVE: Aseguramos que recordID se envíe como un Number.
    // Esto resuelve el error 400 'recordID' (número) y 'firebaseUid' válidos.
    const payload = {
      firebaseUid: uid,
      recordID: Number(recordID) // <-- ¡Aseguramos que sea numérico!
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-functions-key': this.azureDeleteDoseKey,
    });

    const url = `${this.azureDeleteDoseUrl}?code=${this.azureDeleteDoseKey}`;

    console.log(`[Azure] Solicitando eliminación de dosis: ${recordID} para UID: ${uid}`);

    try {
      // La función retorna un 200 si es exitosa o 404/400 si falla o no es autorizado
      await firstValueFrom(
        this.http.post(url, payload, { headers, responseType: 'text' as 'json' })
      );
      console.log(`[Azure] Registro de dosis ${recordID} eliminado con éxito.`);
    } catch (error: any) {
      console.error(`Error al eliminar el registro ${recordID}. Esto puede deberse a que no fue encontrado (404) o el usuario no es el propietario.`, error);
      
      // Propagar un error con un mensaje más detallado si es un 400
      if (error.status === 400 && error.error) {
        throw new Error(error.error); // Usar el mensaje específico del backend (e.g., "Se requiere...")
      }

      throw new Error('Fallo al eliminar el registro de dosis. Por favor, intente de nuevo o contacte a soporte.');
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  get currentUser(): User | null {
    return this._user$.value;
  }

  /** NUEVO — Obtiene el ID Token Firebase firmado para usar en Azure AI Studio */
  async getFirebaseToken(): Promise<string> {
    const user = this.currentUser;

    if (!user) {
      throw new Error("No hay usuario autenticado. No se puede obtener ID Token.");
    }

    return await user.getIdToken(true);
  }
}