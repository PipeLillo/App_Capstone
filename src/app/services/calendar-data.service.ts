import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthenticationService } from './authentication.service';

export interface DoseRecordDto {
  recordID: number;
  medicationName: string;
  medicationColor: string | null;
  scheduledTime: string;
  status: number; 
}

@Injectable({
  providedIn: 'root'
})
export class CalendarDataService {

  private apiUrl = '';

  // 🔑 CLAVE 1: Para LEER datos (getdoses) - La que ya tenías
  private apiKeyGet = '';

  // 🔑 CLAVE 2: Para GUARDAR datos (savetreatment) - La nueva
  private apiKeySave = '';

  
  constructor(
    private http: HttpClient,
    private authService: AuthenticationService
  ) { }

  /**
   * Helper dinámico: Genera los headers usando la clave que le pases.
   */
  private getAuthHeaders(key: string): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-functions-key': key, 
    });
  }

  // --- OBTENER DOSIS (Usa la clave antigua) ---
  async getDoses(): Promise<DoseRecordDto[]> {
    const uid = this.authService.currentUser?.uid;
    if (!uid) {
      return [];
    }
    const url = `${this.apiUrl}/getdoses?firebaseUid=${uid}&_t=${new Date().getTime()}`;
    
    // Pasamos apiKeyGet
    return firstValueFrom(
      this.http.get<DoseRecordDto[]>(url, { headers: this.getAuthHeaders(this.apiKeyGet) })
    );
  }

  // --- GUARDAR TRATAMIENTO (Usa la clave nueva) ---
  async saveTreatment(treatmentData: any): Promise<any> {
    const uid = this.authService.currentUser?.uid;
    if (!uid) throw new Error('No hay usuario logueado');

    const url = `${this.apiUrl}/savetreatment`;
    
    const payload = {
      ...treatmentData,
      firebaseUid: uid
    };

    // Pasamos apiKeySave
    return firstValueFrom(
      this.http.post(url, payload, { headers: this.getAuthHeaders(this.apiKeySave) })
    );
  }
}