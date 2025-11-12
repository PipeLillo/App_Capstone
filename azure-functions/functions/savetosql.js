// functions/index.js
const { app } = require('@azure/functions');
const mssql = require('mssql');

/**
 * Config común de base de datos.
 * DB_USER, DB_PASSWORD, DB_SERVER, DB_DATABASE en Application Settings.
 */
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

// -------------------------------------------------------------
// --- FUNCIÓN 1: savetosql (Registro/Actualización Inicial) ---
// -------------------------------------------------------------
app.http('savetosql', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Función HTTP (savetosql) procesando una solicitud.');

    try {
      const { firebaseUid, userEmail, displayName, photoURL } = await request.json();

      if (!firebaseUid) {
        return { status: 400, body: "Por favor, pase un UID de Firebase válido." };
      }

      await mssql.connect(baseDbConfig);
      context.log('Conexión a la base de datos exitosa.');

      const dbRequest = new mssql.Request();
      dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

      // Se usa MERGE para insertar o actualizar si el usuario ya existe.
      const query = `
        MERGE dbo.Users AS target
        USING (SELECT @firebaseUid AS FirebaseUid) AS source
        ON (target.FirebaseUid = source.FirebaseUid)
        WHEN MATCHED THEN
            UPDATE SET 
                DisplayName = @displayName,
                PhotoURL = @photoURL,
                Email = @userEmail
        WHEN NOT MATCHED THEN
            INSERT (FirebaseUid, Email, DisplayName, PhotoURL)
            VALUES (@firebaseUid, @userEmail, @displayName, @photoURL);
      `;

      dbRequest.input('userEmail', mssql.NVarChar(255), userEmail || null);
      dbRequest.input('displayName', mssql.NVarChar(255), displayName || null);
      dbRequest.input('photoURL', mssql.NVarChar(512), photoURL || null);

      await dbRequest.query(query);
      context.log(`Usuario con UID ${firebaseUid} guardado/actualizado exitosamente.`);

      return {
        status: 200,
        body: `Usuario con UID ${firebaseUid} guardado/actualizado exitosamente.`
      };
    } catch (err) {
      // ✅ CORREGIDO: Uso de context.log('Error', ...) para Azure Functions V4
      context.log('Error', 'Error al conectar o insertar en la base de datos (savetosql):', err);
      return { status: 500, body: "Ocurrió un error al procesar la solicitud de registro." };
    } finally {
      mssql.close();
      context.log('Conexión a la base de datos cerrada (savetosql).');
    }
  }
});

// -------------------------------------------------------------
// --- FUNCIÓN 2: updateuserinfo (Actualización de Información) ---
// -------------------------------------------------------------
app.http('updateuserinfo', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Función HTTP (updateuserinfo) procesando una solicitud.');

    try {
      const {
        firebaseUid, peso, altura, edad, contactoEmergencia,
        direccion, contraindicaciones, alergias, enfermedadesCronicas,
        medicacionPermanente, discapacidades
      } = await request.json();

      if (!firebaseUid) {
        return { status: 400, body: "El 'firebaseUid' es obligatorio." };
      }

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
      dbRequest.input('peso', mssql.Decimal(5, 2), peso === undefined ? null : peso);
      dbRequest.input('altura', mssql.Decimal(5, 2), altura === undefined ? null : altura);
      dbRequest.input('edad', mssql.Int, edad === undefined ? null : edad);
      dbRequest.input('contactoEmergencia', mssql.NVarChar(255), contactoEmergencia || null);
      dbRequest.input('direccion', mssql.NVarChar(512), direccion || null);
      dbRequest.input('contraindicaciones', mssql.NVarChar(mssql.MAX), contraindicaciones || null);
      dbRequest.input('alergias', mssql.NVarChar(mssql.MAX), alergias || null);
      dbRequest.input('enfermedadesCronicas', mssql.NVarChar(mssql.MAX), enfermedadesCronicas || null);
      dbRequest.input('medicacionPermanente', mssql.NVarChar(mssql.MAX), medicacionPermanente || null);
      dbRequest.input('discapacidades', mssql.NVarChar(mssql.MAX), discapacidades || null);

      const result = await dbRequest.query(query);

      if (result.rowsAffected[0] === 0) {
        return { status: 404, body: `No se encontró usuario con UID ${firebaseUid}.` };
      }

      return { status: 200, body: `Información del usuario ${firebaseUid} actualizada.` };
    } catch (err) {
      // ✅ CORREGIDO: Uso de context.log('Error', ...) para Azure Functions V4
      context.log('Error', 'Error en updateuserinfo:', err);
      return { status: 500, body: "Error al procesar la solicitud de actualización." };
    } finally {
      mssql.close();
    }
  }
});

// -------------------------------------------------------------
// --- FUNCIÓN 3: getuserinfo (Lectura / Prefill del formulario) ---
// -------------------------------------------------------------
app.http('getuserinfo', {
  methods: ['GET'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Función HTTP (getuserinfo) procesando una solicitud.');
    const firebaseUid = request.query.get('firebaseUid');

    if (!firebaseUid) {
      return { status: 400, jsonBody: { error: "El parámetro 'firebaseUid' es obligatorio." } };
    }

    try {
      await mssql.connect(baseDbConfig);
      const dbRequest = new mssql.Request();
      dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid);
      const query = `SELECT * FROM Users WHERE FirebaseUid = @firebaseUid`;
      const result = await dbRequest.query(query);

      if (!result.recordset || result.recordset.length === 0) {
        return { status: 404, jsonBody: { error: `No se encontró usuario con UID ${firebaseUid}` } };
      }
      return { status: 200, jsonBody: result.recordset[0] };
    } catch (err) {
      // ✅ CORREGIDO: Uso de context.log('Error', ...) para Azure Functions V4
      context.log('Error', 'Error en getuserinfo:', err);
      return { status: 500, jsonBody: { error: 'Error al obtener la información del usuario.' } };
    } finally {
      mssql.close();
    }
  }
});

// -------------------------------------------------------------
// --- getdoses (Obtener eventos para el calendario) ---
// -------------------------------------------------------------
app.http('getdoses', {
  methods: ['GET'],
  authLevel: 'function', // O 'anonymous' si no requiere clave de API
  handler: async (request, context) => {
    context.log('Función HTTP (getdoses) procesando una solicitud.');
    const firebaseUid = request.query.get('firebaseUid');

    if (!firebaseUid) {
      return { status: 400, jsonBody: { error: "El parámetro 'firebaseUid' es obligatorio." } };
    }

    try {
      await mssql.connect(baseDbConfig);
      context.log('Conexión a la base de datos exitosa (getdoses).');

      const dbRequest = new mssql.Request();
      dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

      // ✅ CONSULTA ACTUALIZADA: Se une con Medications para obtener el nombre y el color.
      const query = `
        SELECT
            dr.RecordID AS recordID,
            m.Name AS medicationName,
            m.Color AS medicationColor, -- Se selecciona la nueva columna de color
            dr.ScheduledTime AS scheduledTime,
            dr.Status AS status
        FROM 
            dbo.DoseRecords dr
        JOIN 
            dbo.UserPlans up ON dr.PlanID = up.PlanID
        JOIN
            dbo.Medications m ON up.MedicationID = m.MedicationID
        WHERE 
            up.OwnerFirebaseUID = @firebaseUid
        ORDER BY
            dr.ScheduledTime ASC;
      `;

      const result = await dbRequest.query(query);

      context.log(`Se encontraron ${result.recordset.length} registros de dosis para el usuario ${firebaseUid}.`);

      // Devuelve el array de registros como JSON.
      return {
        status: 200,
        jsonBody: result.recordset
      };
    } catch (err) {
      // ✅ CORREGIDO: Uso de context.log('Error', ...) para Azure Functions V4
      context.log('Error', 'Error en getdoses:', err);
      return {
        status: 500,
        jsonBody: { error: 'Error al obtener los registros de dosis.' }
      };
    } finally {
      mssql.close();
      context.log('Conexión a la base de datos cerrada (getdoses).');
    }
  }
});

// -------------------------------------------------------------
// --- FUNCIÓN 4: savetreatment (Definitiva) ---
// -------------------------------------------------------------
app.http('savetreatment', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Función HTTP (savetreatment) procesando solicitud.');

    try {
      // 1. Recibir datos del Frontend (incluyendo endDate)
      const body = await request.json();
      const { 
        firebaseUid, 
        medicationName, 
        medicationColor, 
        userDose, 
        frequencyValue, 
        startDate, 
        endDate, // <--- Fecha de término
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
        requestPlan.input('start', mssql.Date, new Date(startDate));
        requestPlan.input('end', mssql.Date, new Date(endDate)); // Guardamos fecha fin en el plan

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
        
        let currentDate = new Date(startDate); // Fecha inicio seleccionada (con hora)
        const limitDate = new Date(endDate);   // Fecha fin seleccionada
        
        // Ajustamos la fecha límite al final del día (23:59:59) para que no corte tomas de ese día
        limitDate.setHours(23, 59, 59, 999);

        const hoursToAdd = parseInt(frequencyValue);
        
        // Validación anti-bucle infinito
        if (isNaN(hoursToAdd) || hoursToAdd <= 0) {
             throw new Error("La frecuencia debe ser un número positivo.");
        }

        context.log(`Generando eventos desde ${currentDate} hasta ${limitDate} cada ${hoursToAdd} horas.`);

        // --- BUCLE: Mientras la fecha actual sea menor o igual a la fecha límite ---
        while (currentDate <= limitDate) {
          
          const requestDose = new mssql.Request(transaction);
          requestDose.input('planId', mssql.Int, planID);
          requestDose.input('schedTime', mssql.DateTime, new Date(currentDate));
          requestDose.input('notes', mssql.NVarChar(500), notes || null);

          // Insertamos la dosis individual
          await requestDose.query(`
            INSERT INTO dbo.DoseRecords (PlanID, ScheduledTime, Status, Notes)
            VALUES (@planId, @schedTime, 2, @notes); -- Status 2 = Pendiente
          `);

          // CALCULAMOS LA SIGUIENTE TOMA
          // Sumamos las horas en milisegundos para exactitud
          currentDate = new Date(currentDate.getTime() + (hoursToAdd * 60 * 60 * 1000));
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
