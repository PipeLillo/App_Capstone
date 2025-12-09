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

    const firebaseUid = request.query.get('firebaseUid');
    if (!firebaseUid) return { status: 400, jsonBody: { error: "firebaseUid requerido" } };

    try {
      await mssql.connect(baseDbConfig);

      const db = new mssql.Request();
      db.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

      // IMPORTANTE: convertimos ScheduledTime a string ISO con offset (style 127)
      const result = await db.query(`
        SELECT
          dr.RecordID AS recordID,
          m.Name AS medicationName,
          m.Color AS medicationColor,
          CONVERT(varchar(33), dr.ScheduledTime, 127) AS scheduledTime,
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
// --- FUNCIÓN: savetreatment (COMPLETA y CORREGIDA) ---
// -------------------------------------------------------------
app.http('savetreatment', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Función HTTP (savetreatment) procesando solicitud.');

    try {
      // 1. Recibir datos del Frontend (incluyendo endDate, startDateWallClock, timezoneOffsetMinutes)
      const body = await request.json();

      // Log del payload recibido (útil para debug)
      context.log('[DBG] Payload recibido (body):', JSON.stringify(body));

      const { 
        firebaseUid, 
        medicationName, 
        medicationColor, 
        userDose, 
        frequencyValue, 
        startDate, 
        endDate, // Fecha de término en ISO (UTC)
        startDateWallClock, // "YYYY-MM-DDTHH:mm:ss" (sin Z) - opcional
        timezoneOffsetMinutes, // offset cliente en minutos (ej. 180 para UTC-3) - opcional
        notes 
      } = body;

      // Validaciones de seguridad
      if (!firebaseUid || !medicationName || !frequencyValue || !startDate || !endDate) {
        return { status: 400, body: "Faltan datos obligatorios para crear el tratamiento." };
      }

      await mssql.connect(baseDbConfig);
      
      // 2. INICIAR TRANSACCIÓN (Todo o Nada)
      const transaction = new mssql.Transaction();
      await transaction.begin();

      try {
        // =================================================================================
        // PASO A: Gestionar el Medicamento (Evitar Duplicados con MERGE)
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
            UPDATE SET Color = @color -- Si existe, actualizamos el color
          WHEN NOT MATCHED THEN
            INSERT (OwnerFirebaseUID, Name, Color, DefaultDose, DoseUnit, FormType)
            VALUES (@uid, @name, @color, 0, 'mg', 'N/A');
          
          -- Recuperamos el ID (del existente o del nuevo)
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
        requestPlan.input('freqType', mssql.NVarChar(50), 'Horas'); // Asumimos horas por el input numérico
        requestPlan.input('freqVal', mssql.NVarChar(255), frequencyValue.toString());

        // --- Mantener Start/End como DateTime2 (recomendado para planes) ---
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        context.log('[DBG] startDateObj.toISOString():', startDateObj.toISOString());
        context.log('[DBG] endDateObj.toISOString():', endDateObj.toISOString());

        requestPlan.input('start', mssql.DateTime2, startDateObj);
        requestPlan.input('end', mssql.DateTime2, endDateObj);

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
        // PASO C: Generación Masiva de Eventos (El Bucle)
        // =================================================================================

        // Parámetros de bucle
        const hoursToAdd = parseInt(frequencyValue);
        if (isNaN(hoursToAdd) || hoursToAdd <= 0) {
          throw new Error("La frecuencia debe ser un número positivo.");
        }

        // Variables paralelas:
        // - currentUtc: usamos startDateObj (instante en UTC) para contar iteraciones y comparaciones
        // - currentWallClock: usamos la hora local (wall-clock) para construir el datetimeoffset que guardaremos
        let currentUtc = new Date(startDateObj.getTime());
        const limitUtc = new Date(endDateObj.getTime());
        limitUtc.setHours(23, 59, 59, 999);

        // Determinar timezone offset en minutos (cliente). Si no viene, fallback y aviso en logs.
        const tzOffset = typeof timezoneOffsetMinutes === 'number' ? timezoneOffsetMinutes : null;
        if (tzOffset === null) {
          context.log('[WARN] timezoneOffsetMinutes no provisto por el cliente. Se usará 0 (UTC) para construir datetimeoffset.');
        }

        // Construir currentWallClock: intenta usar startDateWallClock (si viene) como referencia,
        // si no viene, derivamos la wall-clock local restando el offset al instante UTC.
        let currentWallClock;
        if (startDateWallClock && tzOffset !== null) {
          // startDateWallClock se espera en formato "YYYY-MM-DDTHH:mm:ss" (sin Z)
          const m = startDateWallClock.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
          if (m) {
            const y = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1;
            const d = parseInt(m[3], 10);
            const hh = parseInt(m[4], 10);
            const mm = parseInt(m[5], 10);
            const ss = m[6] ? parseInt(m[6], 10) : 0;
            // Construimos una Date con esos componentes (tratada como "local" por JS, pero sólo usaremos componentes)
            currentWallClock = new Date(y, mo, d, hh, mm, ss, 0);
          } else {
            context.log('[WARN] startDateWallClock presente pero no coincide con el patrón. Se derivará desde startDate.');
          }
        }

        if (!currentWallClock) {
          // Derivamos la wall-clock a partir del instante UTC y del offset del cliente:
          // wallClockMillis = utcMillis - (tzOffsetMinutes * 60000)
          const derivedOffset = tzOffset !== null ? tzOffset : 0;
          currentWallClock = new Date(startDateObj.getTime() - (derivedOffset * 60 * 1000));
          context.log('[DBG] wallClock derivado desde startDateObj y timezoneOffsetMinutes:', currentWallClock.toString());
        } else {
          context.log('[DBG] wallClock inicial desde startDateWallClock:', currentWallClock.toString());
        }

        context.log(`Generando eventos desde (UTC) ${currentUtc.toISOString()} hasta (UTC) ${limitUtc.toISOString()} cada ${hoursToAdd} horas.`);
        context.log('[DBG] timezoneOffsetMinutes usado:', tzOffset);

        // Helper: formatear offset en ±HH:MM a partir de minutes (ej: 180 => -03:00)
        function formatOffset(minutesOffset) {
          // minutesOffset: valor como getTimezoneOffset() o el enviado por cliente.
          // Si minutesOffset = 180 (UTC-3), la cadena debería ser "-03:00"
          const sign = minutesOffset > 0 ? '-' : '+';
          const abs = Math.abs(minutesOffset);
          const hh = Math.floor(abs / 60).toString().padStart(2, '0');
          const mm = (abs % 60).toString().padStart(2, '0');
          return `${sign}${hh}:${mm}`;
        }

        // Helper: crear wall-clock string "YYYY-MM-DDTHH:mm:ss" desde Date local (componentes)
        function formatWallClockString(dateObj) {
          const pad = n => n.toString().padStart(2, '0');
          return `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
        }

        // --- BUCLE: Mientras currentUtc <= limitUtc ---
        while (currentUtc <= limitUtc) {
          // Construir wall-clock string para la inserción (mantiene hora local que el usuario vio)
          const wallClockStr = formatWallClockString(currentWallClock);

          // Construir offset (si tzOffset no provisto, usamos +00:00)
          const offsetStr = tzOffset !== null ? formatOffset(tzOffset) : '+00:00';

          const dtOffsetStr = `${wallClockStr}${offsetStr}`; // e.g. "2025-12-09T02:50:00-03:00"

          context.log('[DBG] Insertando DoseRecord - wallClock:', wallClockStr, ' offset:', offsetStr, ' dtOffsetStr:', dtOffsetStr);

          const requestDose = new mssql.Request(transaction);
          requestDose.input('planId', mssql.Int, planID);
          // Pasamos la cadena (NVARCHAR) y en la consulta hacemos CAST(... AS datetimeoffset(3))
          requestDose.input('schedTimeStr', mssql.NVarChar(50), dtOffsetStr);
          requestDose.input('notes', mssql.NVarChar(500), notes || null);

          // Insertamos la dosis individual usando CAST para asegurarnos que SQL interprete el offset correctamente
          await requestDose.query(`
            INSERT INTO dbo.DoseRecords (PlanID, ScheduledTime, Status, Notes)
            VALUES (@planId, CAST(@schedTimeStr AS datetimeoffset(3)), 2, @notes); -- Status 2 = Pendiente
          `);

          // Avanzar ambas representaciones: UTC (para límite) y wall-clock (para la hora local mostrada)
          currentUtc = new Date(currentUtc.getTime() + (hoursToAdd * 60 * 60 * 1000));
          currentWallClock.setHours(currentWallClock.getHours() + hoursToAdd);
        }

        // =================================================================================
        // 3. CONFIRMAR TRANSACCIÓN (COMMIT)
        // =================================================================================
        await transaction.commit();
        
        context.log(`Tratamiento creado exitosamente. PlanID: ${planID}`);
        return { status: 200, body: JSON.stringify({ message: "Tratamiento generado correctamente", planId: planID }) };

      } catch (err) {
        // Si falla algo en el bucle o en las inserciones, deshacemos TODO.
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
  authLevel: 'anonymous',
  handler: async (request, context) => {

    context.log("Ejecutando getfullevents...");

    // 1. Validación del token
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
      const body = await request.json().catch(() => null);
      firebaseUid = body?.firebaseUid;
    }

    if (!firebaseUid)
      return { status: 400, jsonBody: { error: "firebaseUid requerido" } };

    // 3. Comparar UID del token con UID solicitado
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

      // Selección explícita desde la vista, convertimos los DATETIMEOFFSET a ISO con offset (127)
      const result = await db.query(`
        SELECT
          FirebaseUid,
          DisplayName,
          Email,
          Edad,
          Peso,
          Altura,
          EnfermedadesCronicas,
          Alergias,
          Contraindicaciones,
          CONVERT(varchar(33), ScheduledTime, 127) AS ScheduledTime,
          CASE WHEN TakenTime IS NOT NULL THEN CONVERT(varchar(33), TakenTime, 127) ELSE NULL END AS TakenTime,
          DoseStatus,
          DoseNotes,
          PlannedDose,
          MedicationName,
          DoseUnit
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
// FUNCIÓN 6: deletedose (NUEVA FUNCIÓN)
// ---------------------------------------------------------------------
app.http('deletedose', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {

    try {
      // 1. Obtener datos del cuerpo
      const { recordID, firebaseUid } = await request.json();

      // 2. Validación de Entrada
      // recordID debe ser un número (bigint en tu BD)
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
        // 404 si el ID no existe o no pertenece al usuario
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
