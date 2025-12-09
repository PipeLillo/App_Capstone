import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { environment } from '../../environments/environment';

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

  private apiUrl = environment.CALENDAR_API_URL;

  // 🔑 Clave para obtener dosis (getdoses)
  private apiKeyGet = environment.CALENDAR_API_KEY_GET;

  // 🔑 Clave para guardar tratamiento (savetreatment)
  private apiKeySave = environment.CALENDAR_API_KEY_SAVE;


  
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