import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthenticationService } from './authentication.service';

// ✅ INTERFAZ ACTUALIZADA: Se añade medicationColor.
export interface DoseRecordDto {
  recordID: number;
  medicationName: string;
  medicationColor: string | null; // Color en formato hexadecimal (ej: '#ad2121')
  scheduledTime: string;
  status: number; // 2: Pendiente, 1: Tomado
}

@Injectable({
  providedIn: 'root'
})
export class CalendarDataService {

  private apiUrl = '';
  private apiKey = ''; // ❗ Reemplaza con tu clave de API

  constructor(
    private http: HttpClient,
    private authService: AuthenticationService
  ) { }

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-functions-key': this.apiKey,
    });
  }

  async getDoses(): Promise<DoseRecordDto[]> {
    const uid = this.authService.currentUser?.uid;
    if (!uid) {
      return [];
    }

    const url = `${this.apiUrl}/getdoses?firebaseUid=${uid}&code=${this.apiKey}`;
    
    return firstValueFrom(this.http.get<DoseRecordDto[]>(url, { headers: this.getAuthHeaders() }));
  }
}

