import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonList,
  IonChip,
  IonSpinner
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';

import { AuthenticationService, UserInfoResponse } from '../../services/authentication.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonIcon,
    IonButtons,
    IonBackButton,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonList,
    IonChip,
    IonSpinner
  ]
})
export class ProfilePage implements OnInit {
  loading: Boolean = false;

  // Controles auxiliares para inputs de chips
  enfermedadCtrl = new FormControl<string>('', { nonNullable: true });
  alergiaCtrl = new FormControl<string>('', { nonNullable: true });
  discapacidadCtrl = new FormControl<string>('', { nonNullable: true });

  form = this.fb.group({
    peso: [null as number | null, [Validators.min(0), Validators.max(999)]],
    altura: [null as number | null, [Validators.min(0), Validators.max(300)]],
    edad: [null as number | null, [Validators.min(0), Validators.max(130)]],
    contactoEmergencia: ['' as string | null, [Validators.maxLength(255)]],
    direccion: ['' as string | null, [Validators.maxLength(512)]],
    contraindicaciones: ['' as string | null],

    // Chips
    enfermedadesCronicas: this.fb.array<FormControl<string>>([]),
    alergias: this.fb.array<FormControl<string>>([]),
    discapacidades: this.fb.array<FormControl<string>>([]),

    medicacionPermanente: ['' as string | null],
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private toastCtrl: ToastController
  ) {}

  
  ngOnInit() {
    // opcional: cargar también aquí la primera vez
    // this.loadProfile();
  }

  /** 🔁 Se ejecuta cada vez que entras a la página */
  async ionViewWillEnter() {
    await this.loadProfile();
  }

  // Getters de FormArray
  get enfermedadesFA(): FormArray<FormControl<string>> {
    return this.form.get('enfermedadesCronicas') as FormArray<FormControl<string>>;
  }
  get alergiasFA(): FormArray<FormControl<string>> {
    return this.form.get('alergias') as FormArray<FormControl<string>>;
  }
  get discapacidadesFA(): FormArray<FormControl<string>> {
    return this.form.get('discapacidades') as FormArray<FormControl<string>>;
  }

  // Helpers comunes
  private normalize(s: string): string { return (s || '').trim(); }

  private addChip(ctrl: FormControl<string>, fa: FormArray<FormControl<string>>, label: string) {
    const raw = this.normalize(ctrl.value);
    if (!raw) return;

    const exists = fa.value.some(v => this.normalize(v).toLowerCase() === raw.toLowerCase());
    if (exists) {
      ctrl.setValue('');
      this.presentToast(`Ya agregaste "${label}"`, 'medium');
      return;
    }

    fa.push(new FormControl<string>(raw, { nonNullable: true }));
    ctrl.setValue('');
  }

  private removeChip(fa: FormArray<FormControl<string>>, index: number) {
    fa.removeAt(index);
  }

  private setFromString(fa: FormArray<FormControl<string>>, semicolSeparated: string) {
    fa.clear();
    (semicolSeparated || '')
      .split(';')
      .map(s => this.normalize(s))
      .filter(Boolean)
      .forEach(item => fa.push(new FormControl<string>(item, { nonNullable: true })));
  }

  private joined(fa: FormArray<FormControl<string>>): string | null {
    const items = fa.value.map(v => this.normalize(v)).filter(Boolean);
    return items.length ? items.join(';') : null;
  }

  // Enfermedades
  addEnfermedad() { this.addChip(this.enfermedadCtrl, this.enfermedadesFA, 'esa enfermedad'); }
  removeEnfermedad(i: number) { this.removeChip(this.enfermedadesFA, i); }
  setEnfermedadesFromString(s: string) { this.setFromString(this.enfermedadesFA, s); }
  getEnfermedadesJoined() { return this.joined(this.enfermedadesFA); }

  // Alergias
  addAlergia() { this.addChip(this.alergiaCtrl, this.alergiasFA, 'esa alergia'); }
  removeAlergia(i: number) { this.removeChip(this.alergiasFA, i); }
  setAlergiasFromString(s: string) { this.setFromString(this.alergiasFA, s); }
  getAlergiasJoined() { return this.joined(this.alergiasFA); }

  // Discapacidades
  addDiscapacidad() { this.addChip(this.discapacidadCtrl, this.discapacidadesFA, 'esa discapacidad'); }
  removeDiscapacidad(i: number) { this.removeChip(this.discapacidadesFA, i); }
  setDiscapacidadesFromString(s: string) { this.setFromString(this.discapacidadesFA, s); }
  getDiscapacidadesJoined() { return this.joined(this.discapacidadesFA); }

  /** 🔹 Cargar datos del backend y prellenar */
  private async loadProfile() {
    try {
      this.loading = true;
      const data: UserInfoResponse | null = await this.authService.fetchUserInfo();

      if (!data) {
        // No había datos guardados aún: limpia
        this.form.reset({
          peso: null, altura: null, edad: null,
          contactoEmergencia: '', direccion: '',
          contraindicaciones: '', medicacionPermanente: ''
        }, { emitEvent: false });
        this.enfermedadesFA.clear();
        this.alergiasFA.clear();
        this.discapacidadesFA.clear();
        return;
      }

      // Campos simples
      this.form.patchValue({
        peso: data.Peso ?? null,
        altura: data.Altura ?? null,
        edad: data.Edad ?? null,
        contactoEmergencia: data.ContactoEmergencia ?? '',
        direccion: data.Direccion ?? '',
        contraindicaciones: data.Contraindicaciones ?? '',
        medicacionPermanente: data.MedicacionPermanente ?? '',
      }, { emitEvent: false });

      // Chips desde strings
      this.setEnfermedadesFromString(data.EnfermedadesCronicas ?? '');
      this.setAlergiasFromString(data.Alergias ?? '');
      this.setDiscapacidadesFromString(data.Discapacidades ?? '');

      this.form.markAsPristine();
      this.form.markAsUntouched();
    } catch (e) {
      console.error('No se pudo cargar el perfil:', e);
      await this.presentToast('No se pudo cargar tu información. Intenta nuevamente.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.loading) return;
    this.loading = true;

    try {
      const raw = this.form.value;

      const payload = {
        peso: raw.peso ?? null,
        altura: raw.altura ?? null,
        edad: raw.edad ?? null,
        contactoEmergencia: raw.contactoEmergencia || null,
        direccion: raw.direccion || null,
        contraindicaciones: raw.contraindicaciones || null,

        // Arrays -> "a;b;c"
        enfermedadesCronicas: this.getEnfermedadesJoined(),
        alergias: this.getAlergiasJoined(),
        discapacidades: this.getDiscapacidadesJoined(),

        medicacionPermanente: raw.medicacionPermanente || null,
      };

      await this.authService.updateUserInfo(payload);
      await this.presentToast('Información actualizada correctamente ✅', 'success');
      this.form.markAsPristine();
      this.form.markAsUntouched();
    } catch (e: any) {
      console.error('Error al actualizar información:', e);
      await this.presentToast(e?.message || 'No se pudo actualizar. Intenta nuevamente.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async onLogout(): Promise<void> {
    await this.authService.logout();
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'medium') {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }

  // Enter para inputs (evita submit accidental del formulario)
preventFormSubmit(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();
}

  /**
   * Normaliza un control numérico a número o null al salir del campo (ionBlur).
   * Soporta coma o punto. Limita decimales (por defecto 2).
   */
  formatNumber(controlName: 'peso' | 'altura', decimals = 2) {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return;

    const raw = (ctrl.value ?? '').toString().trim();
    if (!raw) { ctrl.setValue(null); return; }

    // Reemplaza coma por punto y elimina caracteres no numéricos/decimal
    const cleaned = raw
      .replace(',', '.')
      .replace(/[^0-9.]/g, '');

    // Más de un punto decimal -> no cambia
    if ((cleaned.match(/\./g) || []).length > 1) return;

    const n = Number(cleaned);
    if (Number.isNaN(n)) return;

    // Limitar decimales
    const fixed = decimals >= 0 ? Number(n.toFixed(decimals)) : n;

    // Rango lógico
    if (controlName === 'peso' && (fixed < 0 || fixed > 999)) return;
    if (controlName === 'altura' && (fixed < 0 || fixed > 300)) return;

    ctrl.setValue(fixed);
  }

  // Enter para inputs de chips
onEnfermedadKeydown(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();
  this.addEnfermedad();
}

onAlergiaKeydown(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();
  this.addAlergia();
}

onDiscapacidadKeydown(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();
  this.addDiscapacidad();
}


}
