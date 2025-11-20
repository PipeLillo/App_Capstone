const { app } = require('@azure/functions');
const mssql = require('mssql');

// ---------------------------------------------------------------------
// CONFIG DB
// ---------------------------------------------------------------------
const baseDbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        enableArithAbort: true
    }
};

// ---------------------------------------------------------------------
// FUNCION GLOBAL: VALIDAR TOKEN FIREBASE SIN firebase-admin
// ---------------------------------------------------------------------
async function verifyFirebaseToken(request, context) {
    const auth = request.headers.get("authorization");

    if (!auth || !auth.startsWith("Bearer ")) {
        return { valid: false, error: "No se envió Authorization: Bearer <token>" };
    }

    const idToken = auth.replace("Bearer ", "").trim();

    try {
        // Esta API de Google Identity Toolkit verifica el token y devuelve la información del usuario
        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken })
            }
        );

        const data = await response.json();

        if (data.error) {
            return { valid: false, error: "Token inválido" };
        }

        // uid real proveniente del token
        const uid = data.users[0].localId;

        return { valid: true, uid };

    } catch (err) {
        context.log("Error verificando token:", err);
        return { valid: false, error: "Error interno al validar token" };
    }
}

// ---------------------------------------------------------------------
// FUNCIÓN 1: savetosql
// ---------------------------------------------------------------------
app.http('savetosql', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        // ⚠️ RECOMENDACIÓN DE SEGURIDAD: 
        // ⚠️ Agregar aquí la validación de token (verifyFirebaseToken) para asegurar la identidad.
        
        try {
            const { firebaseUid, userEmail, displayName, photoURL } = await request.json();

            if (!firebaseUid)
                return { status: 400, body: "Por favor, pase un UID válido." };

            await mssql.connect(baseDbConfig);

            const dbRequest = new mssql.Request();
            dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

            const query = `
                MERGE dbo.Users AS target
                USING (SELECT @firebaseUid AS FirebaseUid) AS source
                ON (target.FirebaseUid = source.FirebaseUid)
                WHEN MATCHED THEN UPDATE SET 
                    DisplayName = @displayName,
                    PhotoURL = @photoURL,
                    Email = @userEmail
                WHEN NOT MATCHED THEN INSERT (FirebaseUid, Email, DisplayName, PhotoURL)
                VALUES (@firebaseUid, @userEmail, @displayName, @photoURL);
            `;

            dbRequest.input('userEmail', mssql.NVarChar(255), userEmail || null);
            dbRequest.input('displayName', mssql.NVarChar(255), displayName || null);
            dbRequest.input('photoURL', mssql.NVarChar(512), photoURL || null);

            await dbRequest.query(query);

            return { status: 200, body: `Usuario ${firebaseUid} guardado.` };

        } catch (err) {
            context.log('Error', err);
            return { status: 500, body: "Error al guardar usuario." };
        } finally {
            mssql.close();
        }
    }
});

// ---------------------------------------------------------------------
// FUNCIÓN 2: updateuserinfo
// ---------------------------------------------------------------------
app.http('updateuserinfo', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        // ⚠️ RECOMENDACIÓN DE SEGURIDAD: 
        // ⚠️ Agregar aquí la validación de token (verifyFirebaseToken) para asegurar la identidad.
        
        try {
            const body = await request.json();
            const {
                firebaseUid, peso, altura, edad, contactoEmergencia,
                direccion, contraindicaciones, alergias, enfermedadesCronicas,
                medicacionPermanente, discapacidades
            } = body;

            if (!firebaseUid)
                return { status: 400, body: "firebaseUid requerido" };

            await mssql.connect(baseDbConfig);
            const dbRequest = new mssql.Request();

            const query = `
                UPDATE Users
                SET
                    Peso = @peso, Altura = @altura, Edad = @edad, ContactoEmergencia = @contactoEmergencia,
                    Direccion = @direccion, Contraindicaciones = @contraindicaciones, Alergias = @alergias,
                    EnfermedadesCronicas = @enfermedadesCronicas, MedicacionPermanente = @medicacionPermanente,
                    Discapacidades = @discapacidades
                WHERE FirebaseUid = @firebaseUid
            `;

            dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid);
            dbRequest.input('peso', mssql.Decimal(5, 2), peso ?? null);
            dbRequest.input('altura', mssql.Decimal(5, 2), altura ?? null);
            dbRequest.input('edad', mssql.Int, edad ?? null);
            dbRequest.input('contactoEmergencia', mssql.NVarChar(255), contactoEmergencia || null);
            dbRequest.input('direccion', mssql.NVarChar(512), direccion || null);
            dbRequest.input('contraindicaciones', mssql.NVarChar(mssql.MAX), contraindicaciones || null);
            dbRequest.input('alergias', mssql.NVarChar(mssql.MAX), alergias || null);
            dbRequest.input('enfermedadesCronicas', mssql.NVarChar(mssql.MAX), enfermedadesCronicas || null);
            dbRequest.input('medicacionPermanente', mssql.NVarChar(mssql.MAX), medicacionPermanente || null);
            dbRequest.input('discapacidades', mssql.NVarChar(mssql.MAX), discapacidades || null);

            const result = await dbRequest.query(query);

            if (result.rowsAffected[0] === 0)
                return { status: 404, body: "Usuario no encontrado" };

            return { status: 200, body: "Información actualizada." };

        } catch (err) {
            context.log("Error", err);
            return { status: 500, body: "Error al actualizar usuario" };
        } finally {
            mssql.close();
        }
    }
});

// ---------------------------------------------------------------------
// FUNCIÓN 3: getuserinfo
// ---------------------------------------------------------------------
app.http('getuserinfo', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        // ⚠️ RECOMENDACIÓN DE SEGURIDAD: 
        // ⚠️ Agregar aquí la validación de token (verifyFirebaseToken) para asegurar la identidad.
        
        const firebaseUid = request.query.get('firebaseUid');
        if (!firebaseUid)
            return { status: 400, jsonBody: { error: "firebaseUid requerido" } };

        try {
            await mssql.connect(baseDbConfig);
            const db = new mssql.Request();
            db.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

            const result = await db.query(`
                SELECT * FROM Users WHERE FirebaseUid = @firebaseUid
            `);

            if (!result.recordset.length)
                return { status: 404, jsonBody: { error: "Usuario no encontrado" } };

            return { status: 200, jsonBody: result.recordset[0] };

        } catch (err) {
            context.log("Error", err);
            return { status: 500, jsonBody: { error: "Error interno" } };
        } finally {
            mssql.close();
        }
    }
});

// ---------------------------------------------------------------------
// FUNCIÓN 4: getdoses
// ---------------------------------------------------------------------
app.http('getdoses', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        // ⚠️ RECOMENDACIÓN DE SEGURIDAD: 
        // ⚠️ Agregar aquí la validación de token (verifyFirebaseToken) para asegurar la identidad.
        
        const firebaseUid = request.query.get('firebaseUid');
        if (!firebaseUid)
            return { status: 400, jsonBody: { error: "firebaseUid requerido" } };

        try {
            await mssql.connect(baseDbConfig);

            const db = new mssql.Request();
            db.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

            const result = await db.query(`
                SELECT
                    dr.RecordID AS recordID,
                    m.Name AS medicationName,
                    m.Color AS medicationColor,
                    dr.ScheduledTime AS scheduledTime,
                    dr.Status AS status
                FROM dbo.DoseRecords dr
                JOIN dbo.UserPlans up ON dr.PlanID = up.PlanID
                JOIN dbo.Medications m ON up.MedicationID = m.MedicationID
                WHERE up.OwnerFirebaseUID = @firebaseUid
                ORDER BY dr.ScheduledTime ASC;
            `);

            return { status: 200, jsonBody: result.recordset };

        } catch (err) {
            context.log("Error", err);
            return { status: 500, jsonBody: { error: "Error interno" } };
        } finally {
            mssql.close();
        }
    }
});

// -------------------------------------------------------------
// --- FUNCIÓN: savetreatment (OPTIMIZADA con BULK INSERT) ---
// -------------------------------------------------------------
app.http('savetreatment', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Función HTTP (savetreatment) procesando solicitud.');
        
        // ⚠️ RECOMENDACIÓN DE SEGURIDAD: 
        // ⚠️ Agregar aquí la validación de token (verifyFirebaseToken) para asegurar la identidad.

        try {
            // 1. Recibir datos del Frontend
            const body = await request.json();
            const { 
                firebaseUid, 
                medicationName, 
                medicationColor, 
                userDose, 
                frequencyValue, 
                startDate, 
                endDate, 
                notes 
            } = body;

            // Validaciones
            if (!firebaseUid || !medicationName || !frequencyValue || !startDate || !endDate) {
                return { status: 400, body: "Faltan datos obligatorios para crear el tratamiento." };
            }

            await mssql.connect(baseDbConfig);
            
            // 2. INICIAR TRANSACCIÓN (Todo o Nada)
            const transaction = new mssql.Transaction();
            await transaction.begin();

            try {
                // =================================================================================
                // PASO A: Gestionar el Medicamento (MERGE)
                // =================================================================================
                const requestMed = new mssql.Request(transaction);
                requestMed.input('uid', mssql.VarChar(128), firebaseUid);
                requestMed.input('name', mssql.NVarChar(100), medicationName);
                requestMed.input('color', mssql.VarChar(7), medicationColor);
                
                const queryMed = `
                    MERGE dbo.Medications AS target
                    USING (SELECT @uid AS OwnerFirebaseUID, @name AS Name) AS source
                    ON (target.OwnerFirebaseUID = source.OwnerFirebaseUID AND target.Name = source.Name)
                    WHEN MATCHED THEN
                        UPDATE SET Color = @color 
                    WHEN NOT MATCHED THEN
                        INSERT (OwnerFirebaseUID, Name, Color, DefaultDose, DoseUnit, FormType)
                        VALUES (@uid, @name, @color, 0, 'mg', 'N/A');
                    
                    SELECT MedicationID FROM dbo.Medications WHERE OwnerFirebaseUID = @uid AND Name = @name;
                `;
                
                const resultMed = await requestMed.query(queryMed);
                const medicationID = resultMed.recordset[0].MedicationID;

                // =================================================================================
                // PASO B: Crear el Plan de Tratamiento (UserPlans)
                // =================================================================================
                const requestPlan = new mssql.Request(transaction);
                requestPlan.input('uid', mssql.VarChar(128), firebaseUid);
                requestPlan.input('medId', mssql.Int, medicationID);
                requestPlan.input('dose', mssql.Decimal(10, 2), userDose);
                requestPlan.input('freqType', mssql.NVarChar(50), 'Horas');
                requestPlan.input('freqVal', mssql.NVarChar(255), frequencyValue.toString());
                requestPlan.input('start', mssql.Date, new Date(startDate));
                requestPlan.input('end', mssql.Date, new Date(endDate)); 

                const queryPlan = `
                    INSERT INTO dbo.UserPlans 
                    (OwnerFirebaseUID, MedicationID, UserDose, FrequencyType, FrequencyValue, StartDate, EndDate, IsActive)
                    VALUES 
                    (@uid, @medId, @dose, @freqType, @freqVal, @start, @end, 1);
                    
                    SELECT SCOPE_IDENTITY() AS PlanID;
                `;

                const resultPlan = await requestPlan.query(queryPlan);
                const planID = resultPlan.recordset[0].PlanID;

                // =================================================================================
                // PASO C: Generación Masiva de Eventos (OPTIMIZADO con BULK INSERT)
                // =================================================================================
                
                let currentDate = new Date(startDate);
                const limitDate = new Date(endDate);
                limitDate.setHours(23, 59, 59, 999); // Ajuste al final del día

                const hoursToAdd = parseInt(frequencyValue);
                if (isNaN(hoursToAdd) || hoursToAdd <= 0) {
                    throw new Error("La frecuencia debe ser un número positivo.");
                }

                context.log(`Generando ${Math.floor((limitDate.getTime() - currentDate.getTime()) / (hoursToAdd * 60 * 60 * 1000))} eventos para inserción masiva...`);

                const valuesToInsert = [];

                // --- BUCLE: Generar los valores de inserción ---
                while (currentDate <= limitDate) {
                    // Formato ISO para MSSQL (ej: 2025-01-01 10:00:00.000)
                    const scheduledTime = currentDate.toISOString().replace('T', ' ').substring(0, 23);
                    
                    // Escapar comillas simples en las notas (seguridad de string literal)
                    const notesValue = notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'; 
                    
                    // Acumulamos la fila de datos: (PlanID, ScheduledTime, Status, Notes)
                    valuesToInsert.push(`(${planID}, '${scheduledTime}', 2, ${notesValue})`);

                    // CALCULAMOS LA SIGUIENTE TOMA
                    currentDate = new Date(currentDate.getTime() + (hoursToAdd * 60 * 60 * 1000));
                }

                if (valuesToInsert.length > 0) {
                    // EJECUCIÓN DEL BULK INSERT con una sola llamada
                    const finalBulkQuery = `
                        INSERT INTO dbo.DoseRecords (PlanID, ScheduledTime, Status, Notes)
                        VALUES 
                        ${valuesToInsert.join(',\n')};
                    `;
                    
                    const requestBulk = new mssql.Request(transaction);
                    await requestBulk.query(finalBulkQuery);
                    
                    context.log(`Inserción masiva de ${valuesToInsert.length} registros completada.`);
                }


                // =================================================================================
                // 3. CONFIRMAR TRANSACCIÓN (COMMIT)
                // =================================================================================
                await transaction.commit();
                
                context.log(`Tratamiento creado exitosamente. PlanID: ${planID}`);
                return { status: 200, body: JSON.stringify({ message: "Tratamiento generado correctamente", planId: planID }) };

            } catch (err) {
                // Si falla algo, deshacemos TODO.
                await transaction.rollback();
                context.log('Error', 'Rollback ejecutado debido a un error interno:', err);
                throw err;  
            }

        } catch (err) {
            context.log('Error', 'Error fatal en savetreatment:', err);
            return { status: 500, body: "Error interno al guardar el tratamiento." };
        } finally {
            mssql.close();
        }
    }
});

// ---------------------------------------------------------------------
// FUNCIÓN 5: getfullevents (VALIDADA CON TOKEN DE FIREBASE)
// ---------------------------------------------------------------------
app.http('getfullevents', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous', // Se usa 'anonymous' porque la función maneja la autenticación
    handler: async (request, context) => {

        context.log("Ejecutando getfullevents...");

        // 1. Validación del token (Autenticación)
        const validation = await verifyFirebaseToken(request, context);
        if (!validation.valid) {
            return { status: 401, jsonBody: { error: validation.error } };
        }

        const uidFromToken = validation.uid;

        // 2. Obtener UID desde query o body
        let firebaseUid = null;

        if (request.method === 'GET') {
            firebaseUid = request.query.get('firebaseUid');
        } else {
            // Manejar error si el body no es JSON
            const body = await request.json().catch(() => null);
            firebaseUid = body?.firebaseUid;
        }

        if (!firebaseUid)
            return { status: 400, jsonBody: { error: "firebaseUid requerido" } };

        // 3. Comparar UID del token con UID solicitado (Autorización)
        if (firebaseUid !== uidFromToken) {
            return {
                status: 403,
                jsonBody: { error: "No tienes permiso para consultar datos de otro usuario." }
            };
        }

        // 4. Ejecución normal
        try {
            await mssql.connect(baseDbConfig);

            const db = new mssql.Request();
            db.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

            const result = await db.query(`
                SELECT *
                FROM vw_UserEventsFull
                WHERE FirebaseUid = @firebaseUid
                ORDER BY ScheduledTime ASC;
            `);

            return { status: 200, jsonBody: result.recordset };

        } catch (err) {
            context.log("Error", err);
            return { status: 500, jsonBody: { error: "Error interno al obtener datos" } };
        } finally {
            mssql.close();
        }
    }
});

// ---------------------------------------------------------------------
// FUNCIÓN 6: deletedose
// ---------------------------------------------------------------------
app.http('deletedose', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        // ⚠️ RECOMENDACIÓN DE SEGURIDAD: 
        // ⚠️ Agregar aquí la validación de token (verifyFirebaseToken) para asegurar la identidad.
        
        try {
            // 1. Obtener datos del cuerpo
            const { recordID, firebaseUid } = await request.json();

            // 2. Validación de Entrada
            if (typeof recordID !== 'number' || !firebaseUid) {
                return {
                    status: 400,
                    body: "Se requiere un 'recordID' (número) y 'firebaseUid' válidos."
                };
            }

            await mssql.connect(baseDbConfig);
            const dbRequest = new mssql.Request();

            // 3. Consulta SQL de Eliminación (Segura y Verifica Propiedad)
            const query = `
                DELETE DR
                FROM dbo.DoseRecords AS DR
                INNER JOIN dbo.UserPlans AS UP ON DR.PlanID = UP.PlanID
                WHERE DR.RecordID = @recordID AND UP.OwnerFirebaseUID = @firebaseUid;
            `;
            
            // 4. Asignación de parámetros
            dbRequest.input('recordID', mssql.BigInt, recordID);
            dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid); 

            const result = await dbRequest.query(query);

            // 5. Respuesta basada en el resultado
            if (result.rowsAffected[0] > 0) {
                return { status: 200, body: `Registro ${recordID} eliminado con éxito.` };
            } else {
                return { status: 404, body: `Registro ${recordID} no encontrado o no autorizado.` };
            }

        } catch (err) {
            context.log('Error en deletedose:', err);
            return { status: 500, body: "Error interno al eliminar el registro." };
        } finally {
            mssql.close();
        }
    }
});
