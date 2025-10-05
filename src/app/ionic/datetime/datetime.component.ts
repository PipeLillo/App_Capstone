import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  IonButtons, IonContent, IonHeader, IonMenuButton, IonTitle, IonToolbar,
  IonDatetime, AlertController,
} from '@ionic/angular/standalone';

type HighlightConfig = {
  date: string | string[];
  textColor?: string;
  backgroundColor?: string;
  border?: string;
};

@Component({
  selector: 'app-datetime',
  templateUrl: './datetime.component.html',
  styleUrls: ['./datetime.component.scss'],
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
    IonDatetime, IonContent,
  ],
})
export class DatetimeComponent implements OnInit, AfterViewInit {
  @ViewChild('mainCal', { read: ElementRef }) mainCalEl!: ElementRef<HTMLElement>;

  /** Solo mostraremos el alert si el último click real fue en una celda de día */
  private lastClickWasDay = false;

  highlightedDates: HighlightConfig[] = [
    { date: '2025-10-05', textColor: '#800080', backgroundColor: '#ffc0cb', border: '1px solid #e91e63' },
    { date: '2025-10-10', textColor: '#09721b', backgroundColor: '#c8e5d0', border: '1px solid #4caf50' },
    { date: '2025-10-20', textColor: 'var(--ion-color-secondary)', backgroundColor: 'rgb(var(--ion-color-secondary-rgb), 0.18)', border: '1px solid var(--ion-color-secondary-shade)' },
    { date: '2025-10-23', textColor: 'rgb(68, 10, 184)', backgroundColor: 'rgb(211, 200, 229)', border: '1px solid rgb(103, 58, 183)' },
  ];

  constructor(private alertController: AlertController) {}
  ngOnInit() {}

  async ngAfterViewInit() {
    const host = this.mainCalEl?.nativeElement as any;

    // Aseguramos que el componente stencil esté listo antes de tocar el shadowRoot
    if (host?.componentOnReady) {
      try { await host.componentOnReady(); } catch {}
    }

    const shadow: ShadowRoot | undefined = host?.shadowRoot;
    if (!shadow) return;

    // Delegación de clics dentro del shadow DOM:
    // - Si la ruta del evento contiene un elemento con part~="calendar-day", marcamos lastClickWasDay=true.
    // - En cualquier otro clic relevante (como month-year), reseteamos a false.
    shadow.addEventListener('click', (ev: Event) => {
      const path = (ev.composedPath?.() || []) as Array<EventTarget & { getAttribute?: (n: string) => string | null }>;
      // ¿Se hizo click en una celda de día?
      const clickedDay = path.some(el => {
        const part = typeof el?.getAttribute === 'function' ? el.getAttribute('part') : null;
        return part?.split(' ').includes('calendar-day');
      });

      // ¿Se hizo click en el botón/área de mes-año o su picker?
      const clickedMonthYear = path.some(el => {
        const part = typeof el?.getAttribute === 'function' ? el.getAttribute('part') : null;
        // Cubre botón y contenido del selector de mes/año
        return !!part && (part.includes('month-year') || part.includes('calendar-month'));
      });

      if (clickedDay) {
        this.lastClickWasDay = true;
      } else if (clickedMonthYear) {
        this.lastClickWasDay = false;
      } else {
        // Otros clics dentro del calendario: no asumimos selección de día
        this.lastClickWasDay = false;
      }
    }, { capture: true }); // capture para interceptar antes que el componente interne maneje el click
  }

  /**
   * ionChange tolerante:
   * - Solo alerta si el último click real fue sobre un "día".
   * - Ignora cambios de mes/año y otros cambios programáticos.
   * - Acepta "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss..."
   */
  async logDateChange(event: any) {
    // Si no fue click en día, ignoramos este change
    if (!this.lastClickWasDay) {
      return;
    }
    // Consumimos la bandera para evitar duplicados si Ionic emite múltiples cambios
    this.lastClickWasDay = false;

    const v = event?.detail?.value;
    const raw = Array.isArray(v) ? v[0] : v;
    if (!raw) return;

    const iso: string = typeof raw === 'string' ? raw : String(raw);
    const ymd = iso.split('T')[0];

    // Debe tener día
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;

    const [y, m, d] = ymd.split('-').map(Number);
    const dateObject = new Date(y, m - 1, d);
    if (isNaN(dateObject.getTime())) {
      const alert = await this.alertController.create({
        header: 'Fecha no válida',
        message: `No se pudo obtener la fecha seleccionada.`,
        buttons: ['OK'],
        cssClass: 'red-alert-text',
      });
      await alert.present();
      return;
    }

    const readableDate = dateObject.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const alert = await this.alertController.create({
      header: 'Fecha Seleccionada',
      message: `La fecha seleccionada es: ${readableDate}`,
      buttons: ['OK'],
      cssClass: 'red-alert-text',
    });
    await alert.present();
  }
}
