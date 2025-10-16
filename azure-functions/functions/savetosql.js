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
      context.log.error('Error al conectar o insertar en la base de datos (savetosql):', err);
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
      context.log.error('Error en updateuserinfo:', err);
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
      context.log.error('Error en getuserinfo:', err);
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
      context.log.error('Error en getdoses:', err);
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


