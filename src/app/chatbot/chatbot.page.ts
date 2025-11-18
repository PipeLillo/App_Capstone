import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonContent, ToastController } from '@ionic/angular';
import { GeminiAgentService } from '../services/ai-agent.service'; // 🛑 CAMBIO: Usando el nuevo servicio Gemini

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.page.html',
  styleUrls: ['./chatbot.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule
  ]
})
export class ChatbotPage implements OnInit, OnDestroy {

  @ViewChild(IonContent) content!: IonContent;

  nuevoMensaje: string = '';
  cargando: boolean = false;
  private tiempoEspera: any;

  // Inicializar el historial de mensajes
  mensajes: Array<{ 
    texto: string; 
    enviadoPorMi: boolean; 
    hora: string;
    error?: boolean;
  }> = [
    {
      texto: '¡Hola! Soy tu asistente de salud MyZenit. ¿En qué te puedo ayudar hoy?',
      enviadoPorMi: false,
      hora: this.obtenerHoraActual()
    }
  ];

  constructor(
    // 🛑 CAMBIO: Inyectando el nuevo servicio
    private geminiAgent: GeminiAgentService, 
    private toastController: ToastController
  ) {}

  ngOnInit() {}

  ngOnDestroy() {
    // Limpiar timeout si el componente se destruye
    if (this.tiempoEspera) {
      clearTimeout(this.tiempoEspera);
    }
  }

  async enviarMensaje() {
    const texto = this.nuevoMensaje.trim();
    if (!texto || this.cargando) return;

    // 1️⃣ Agregar mensaje del usuario
    this.mensajes.push({
      texto,
      enviadoPorMi: true,
      hora: this.obtenerHoraActual()
    });

    this.nuevoMensaje = '';
    this.scrollAbajo();

    // 2️⃣ Mostrar animación de "escribiendo..."
    this.cargando = true;
    const placeholderIndex = this.mensajes.push({
      texto: 'Escribiendo...',
      enviadoPorMi: false,
      hora: this.obtenerHoraActual()
    }) - 1;

    try {
      // 3️⃣ Enviar al Agente de Gemini con timeout
      const promesaConTimeout = this.crearPromesaConTimeout(texto);
      
      // 🛑 LLAMADA AL NUEVO SERVICIO
      const respuesta = await this.geminiAgent.enviarMensajeAGemini(texto);

      // Reemplazar el placeholder con la respuesta real
      this.mensajes[placeholderIndex] = {
        texto: respuesta,
        enviadoPorMi: false,
        hora: this.obtenerHoraActual()
      };

    } catch (error: any) {
      console.error('Error al comunicarse con el agente:', error);

      // Mostrar mensaje de error
      this.mensajes[placeholderIndex] = {
        texto: this.obtenerMensajeError(error),
        enviadoPorMi: false,
        hora: this.obtenerHoraActual(),
        error: true
      };

      // Mostrar toast de error
      this.mostrarError(error);
    } finally {
      this.cargando = false;
      this.scrollAbajo();
    }
  }

  private crearPromesaConTimeout(texto: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('El agente está tomando más tiempo de lo esperado. Por favor, intenta de nuevo.'));
      }, 45000); // 45 segundos timeout

      try {
        // 🛑 Cambio de servicio en la promesa con timeout
        const respuesta = await this.geminiAgent.enviarMensajeAGemini(texto); 
        clearTimeout(timeout);
        resolve(respuesta);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private obtenerMensajeError(error: any): string {
    // Si el error es un objeto de respuesta HTTP, es mejor manejarlo
    const msg = error?.error?.error || error?.message || 'Error desconocido';

    if (msg.includes('timeout') || msg.includes('tiempo')) {
      return 'El agente está tomando más tiempo de lo esperado. Por favor, intenta de nuevo.';
    } else if (msg.includes('401') || msg.includes('autenticación')) {
      return 'Error de autenticación. Por favor, verifica tu conexión.';
    } else if (msg.includes('network') || msg.includes('red')) {
      return 'Error de conexión. Verifica tu internet e intenta de nuevo.';
    } else {
      // Si Gemini devuelve un error, puede ser que el modelo no pudo procesar la solicitud
      return 'Lo siento, ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo.';
    }
  }

  private async mostrarError(error: any) {
    const toast = await this.toastController.create({
      message: this.obtenerMensajeError(error),
      duration: 4000,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  private obtenerHoraActual(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollAbajo() {
    setTimeout(() => {
      if (this.content) {
        this.content.scrollToBottom(300);
      }
    }, 100);
  }

  // Método para manejar la tecla Enter
  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarMensaje();
    }
  }

  // Limpiar el chat
  limpiarChat() {
    this.mensajes = [
      {
        texto: '¡Hola! Soy tu asistente de salud impulsado por Gemini. ¿En qué te puedo ayudar hoy?',
        enviadoPorMi: false,
        hora: this.obtenerHoraActual()
      }
    ];
  }

  // Reenviar mensaje fallido
  reenviarMensaje(mensaje: any) {
    if (mensaje.error) {
      // Remover el mensaje de error
      const index = this.mensajes.indexOf(mensaje);
      if (index > -1) {
        // Guardamos el texto para reenviar
        const textoOriginal = mensaje.texto; 
        // Eliminamos el mensaje de error
        this.mensajes.splice(index, 1); 
        
        // Usar el texto guardado para reenviar la solicitud
        this.nuevoMensaje = textoOriginal;
        this.enviarMensaje();
      }
    }
  }
}