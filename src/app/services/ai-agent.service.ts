import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthenticationService } from './authentication.service';

// Tipos para simplificar la interacción con la API de Gemini
interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
}

interface GeminiContent {
  role: 'user' | 'model' | 'function';
  parts: GeminiPart[];
}

interface GeminiResponse {
  text?: string;
  functionCalls?: { name: string, args: any }[];
}


@Injectable({ providedIn: 'root' })
export class GeminiAgentService {

    // 🛑 CLAVE DE API DE GEMINI (Placeholder, usa tu clave real si es diferente)
    private apiKey = ""; 

    // 🛑 ENDPOINT REAL DE TU FUNCIÓN EXTERNA DE AZURE
    private getEventsFunctionUrl = '';

    private modelName = '';

    constructor(
        private http: HttpClient,
        private auth: AuthenticationService
    ) {}
    
    // ---------------------------------------------------------------------
    // FUNCIÓN DE AZURE/BACKEND: getfullevents (Ejecuta la herramienta)
    // ---------------------------------------------------------------------
    private async callAzureFunction_getfullevents(firebaseUid: string): Promise<any> {
        // Obtenemos el token de Firebase para validar la Azure Function (seguridad)
        const token = await this.auth.getFirebaseToken();
        
        const headers = new HttpHeaders({
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        });
        
        const urlWithParams = `${this.getEventsFunctionUrl}?firebaseUid=${firebaseUid}`;
        
        console.log(`[Tool] Llamando a la función externa: ${urlWithParams}`);
        
        try {
            const result = await firstValueFrom(this.http.get<any>(urlWithParams, { headers }));
            return result;
        } catch (error) {
            console.error('[Tool Error] Error al obtener eventos:', error);
            // Devolver un un error controlado
            return { error: 'Error al conectar con la base de datos de eventos.' };
        }
    }

    // ---------------------------------------------------------------------
    // FUNCIÓN PRINCIPAL DE INTERACCIÓN CON GEMINI (Maneja Function Calling)
    // ---------------------------------------------------------------------
    async enviarMensajeAGemini(mensaje: string): Promise<string> {
        // Asegura que el usuario esté autenticado para obtener el UID
        if (!this.auth.currentUser || !this.auth.currentUser.uid) {
            throw new Error("Usuario no autenticado. No se puede llamar a Gemini.");
        }
        const uid = this.auth.currentUser.uid;
        
        // 1. Definición del Esquema (Tool)
        const tools = [{
            functionDeclarations: [{
                name: "getfullevents",
                description: "Obtiene todos los eventos programados de un usuario (dosis de medicamentos, citas, etc.) verificando la autenticación.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        firebaseUid: {
                            type: "STRING",
                            description: `El ID único de Firebase del usuario logueado. Debe usarse el UID del usuario actual: ${uid}`
                        }
                    },
                    required: ["firebaseUid"]
                }
            }]
        }];
        
        // Inicializar el historial de conversación con el mensaje del usuario
        let conversationHistory: GeminiContent[] = [{ role: 'user', parts: [{ text: mensaje }] }];
        let response: GeminiResponse;

        while (true) {
            
            // 2. Primera Llamada (o siguiente turno) a Gemini
            response = await this.callGeminiApi(conversationHistory, tools);

            // 3. Verificar si el modelo solicitó una llamada a función
            if (response.functionCalls && response.functionCalls.length > 0) {
                const call = response.functionCalls[0];
                
                // Añadir la solicitud de función al historial
                conversationHistory.push({ 
                    role: 'model', 
                    parts: [{ functionCall: call }] 
                });

                if (call.name === 'getfullevents') {
                    
                    const firebaseUidToQuery = call.args['firebaseUid'] || uid; 
                    
                    // 4. Ejecutar la función externa real
                    const functionResult = await this.callAzureFunction_getfullevents(firebaseUidToQuery);
                    
                    // 5. Añadir el resultado de la función al historial
                    const functionResponsePart: GeminiContent = {
                        role: 'function', 
                        parts: [{ 
                            functionResponse: {
                                name: 'getfullevents',
                                // Corrección clave: Envolvemos el resultado en un objeto con la clave 'result'.
                                response: {
                                    result: functionResult 
                                }
                            } 
                        }]
                    };
                    conversationHistory.push(functionResponsePart);
                    
                    // El bucle continuará para enviar el resultado a Gemini
                } else {
                    return `Error: Gemini solicitó una función desconocida (${call.name}).`;
                }

            } else {
                // 6. Si no hay llamadas a función, la respuesta final está lista
                break;
            }
        }
        
        // 7. Devolver la respuesta final en texto
        return response.text || "No se recibió respuesta final de Gemini.";
    }


    // ---------------------------------------------------------------------
    // MÉTODO AUXILIAR PARA LA INTERACCIÓN CON LA API REST DE GEMINI
    // ---------------------------------------------------------------------
    private async callGeminiApi(contents: GeminiContent[], tools: any[]): Promise<GeminiResponse> {
        
        const headers = new HttpHeaders({
            "Content-Type": "application/json",
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
        
        // 🛑 GENERACIÓN DEL PROMPT PERSONALIZADO (System Instruction)
        const currentDateTime = new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const systemInstructionText = `
Eres 'MyZemot', un asistente avanzado de planificación de salud y medicamentos, desarrollado por Google Gemini.
Tu rol es proporcionar información proactiva y contextual sobre la agenda médica y las dosis del usuario.

**Directrices Clave:**
1. CONTEXTO ACTUAL: La fecha y hora actual es: ${currentDateTime}.
2. ROL: Eres un asistente, no un médico. Prioriza la seguridad y la precisión. Nunca diagnostiques ni modifiques tratamientos.
3. FUNCIÓN PRINCIPAL: Utiliza la herramienta 'getfullevents' inmediatamente y de forma proactiva cada vez que el usuario haga una pregunta relacionada con su salud, medicamentos, dosis o citas.
4. ENTRADA DE DATOS: Si la función devuelve datos, resúmelos y preséntalos de forma legible y clara (por ejemplo, en una lista con viñetas o una tabla). Si no devuelve datos, informa al usuario de manera amigable.
5. TONO: Tu tono debe ser siempre empático, tranquilizador y profesional.

Tienes La siguiente información del usuario por medio de la llamada a getfullevents: Eventos de toma de medicamentos, Medicamentos, Alergias, Peso, Edad, Altura, Enfermedades, etc.
SI EL USUARIO SOLICITA CUALQUIERA DE ESA INFORMACIÓN, LLAMARÁS A LA FUNCIÓN PARA EXTRAER CONTEXTO

Si vas a proveer información del usuario, hazlo de manera ORDENADA, y no extiendas tanto los mensajes a no ser que el usuario te lo pida
`;
        
        const body = {
            // AÑADIDO: Incluir la instrucción del sistema
            systemInstruction: {
                parts: [{ text: systemInstructionText }]
            },
            contents: contents,
            tools: tools
        };

        try {
            const apiResponse = await firstValueFrom(this.http.post<any>(url, body, { headers }));
            
            const firstCandidate = apiResponse.candidates?.[0];
            const parts = firstCandidate?.content?.parts || [];
            
            const functionCalls = parts
                .filter((part: any) => part.functionCall)
                .map((part: any) => ({ name: part.functionCall.name, args: part.functionCall.args }));
            
            const textPart = parts.find((part: any) => part.text);
                
            return {
                text: textPart?.text,
                functionCalls: functionCalls.length > 0 ? functionCalls : undefined
            };

        } catch (error) {
            console.error("Error al llamar a la API de Gemini:", error);
            return { text: "Lo siento, hubo un error de conexión con el servicio de IA." };
        }
    }
}