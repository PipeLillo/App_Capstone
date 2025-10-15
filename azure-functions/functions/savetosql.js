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
// --- FUNCIÓN 1: savetosql (Registro Inicial) ---
// -------------------------------------------------------------
app.http('savetosql', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Función HTTP (savetosql) procesando una solicitud.');
    let connection;
    try {
      const { firebaseUid, userEmail, displayName, photoURL } = await request.json();

      if (!firebaseUid) {
        return { status: 400, body: "Por favor, pase un UID de Firebase válido." };
      }

      connection = await mssql.connect(baseDbConfig);
      context.log('Conexión a la base de datos exitosa.');

      const dbRequest = new mssql.Request(connection);

      const query = `
        INSERT INTO Users (FirebaseUid, Email, DisplayName, PhotoURL)
        VALUES (@firebaseUid, @userEmail, @displayName, @photoURL)
      `;

      dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid);
      dbRequest.input('userEmail', mssql.NVarChar(255), userEmail || null);
      dbRequest.input('displayName', mssql.NVarChar(255), displayName || null);
      dbRequest.input('photoURL', mssql.NVarChar(512), photoURL || null);

      await dbRequest.query(query);
      context.log(`Usuario con UID ${firebaseUid} guardado exitosamente.`);

      return {
        status: 200,
        body: `Usuario con UID ${firebaseUid} guardado exitosamente.`
      };
    } catch (err) {
      // ✅ MEJORA: Maneja el error de usuario duplicado sin crashear.
      // El código de error 2627 (o 2601) corresponde a una violación de UNIQUE constraint.
      if (err.number === 2627 || err.number === 2601) {
        const { firebaseUid } = await request.json();
        context.log(`Intento de insertar un usuario duplicado con UID: ${firebaseUid}. Se omite la inserción.`);
        return { status: 200, body: `El usuario con UID ${firebaseUid} ya existe.` };
      }

      context.log.error('Error al conectar o insertar en la base de datos (savetosql):', err);
      return {
        status: 500,
        body: "Ocurrió un error al procesar la solicitud de registro. Por favor, intente de nuevo más tarde."
      };
    } finally {
      if (connection) {
        connection.close();
        context.log('Conexión a la base de datos cerrada (savetosql).');
      }
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
    let connection;
    try {
      const {
        firebaseUid,
        peso,
        altura,
        edad,
        contactoEmergencia,
        direccion,
        contraindicaciones,
        alergias,
        enfermedadesCronicas,
        medicacionPermanente,
        discapacidades
      } = await request.json();

      if (!firebaseUid) {
        return {
          status: 400,
          body: "El 'firebaseUid' es obligatorio para actualizar la información del usuario."
        };
      }

      connection = await mssql.connect(baseDbConfig);
      context.log('Conexión a la base de datos exitosa para la actualización.');

      const dbRequest = new mssql.Request(connection);

      const query = `
        UPDATE Users
        SET
          Peso                 = @peso,
          Altura               = @altura,
          Edad                 = @edad,
          ContactoEmergencia   = @contactoEmergencia,
          Direccion            = @direccion,
          Contraindicaciones   = @contraindicaciones,
          Alergias             = @alergias,
          EnfermedadesCronicas = @enfermedadesCronicas,
          MedicacionPermanente = @medicacionPermanente,
          Discapacidades       = @discapacidades
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
        return {
          status: 404,
          body: `No se encontró un usuario con UID ${firebaseUid} para actualizar.`
        };
      }

      context.log(`Información extra del usuario con UID ${firebaseUid} actualizada exitosamente.`);
      return {
        status: 200,
        body: `Información extra del usuario con UID ${firebaseUid} actualizada exitosamente.`
      };
    } catch (err) {
      context.log.error('Error al conectar o actualizar en la base de datos (updateuserinfo):', err);
      return {
        status: 500,
        body: "Ocurrió un error al procesar la solicitud de actualización. Por favor, intente de nuevo más tarde."
      };
    } finally {
      if (connection) {
        connection.close();
        context.log('Conexión a la base de datos cerrada (updateuserinfo).');
      }
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
    let connection;
    try {
      const firebaseUid = request.query.get('firebaseUid');

      if (!firebaseUid) {
        return {
          status: 400,
          jsonBody: { error: "El parámetro 'firebaseUid' es obligatorio." }
        };
      }

      connection = await mssql.connect(baseDbConfig);
      context.log('Conexión a la base de datos exitosa (getuserinfo).');

      const dbRequest = new mssql.Request(connection);
      dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

      const query = `
        SELECT
          FirebaseUid, Email, DisplayName, PhotoURL, Peso, Altura, Edad,
          ContactoEmergencia, Direccion, Contraindicaciones, Alergias,
          EnfermedadesCronicas, MedicacionPermanente, Discapacidades
        FROM Users
        WHERE FirebaseUid = @firebaseUid
      `;

      const result = await dbRequest.query(query);

      if (!result.recordset || result.recordset.length === 0) {
        return { status: 404, jsonBody: { error: `No se encontró usuario con UID ${firebaseUid}` } };
      }

      return {
        status: 200,
        jsonBody: result.recordset[0]
      };
    } catch (err) {
      context.log.error('Error en getuserinfo:', err);
      return {
        status: 500,
        jsonBody: {
          error: 'Error al obtener la información del usuario.',
          detail: err?.message || String(err)
        }
      };
    } finally {
      if (connection) {
        connection.close();
        context.log('Conexión a la base de datos cerrada (getuserinfo).');
      }
    }
  }
});

// -------------------------------------------------------------
// --- ✅ NUEVA FUNCIÓN 4: getdoses (Obtener registros de dosis para el calendario) ---
// -------------------------------------------------------------
app.http('getdoses', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Función HTTP (getdoses) procesando una solicitud.');
        let connection;
        try {
            const firebaseUid = request.query.get('firebaseUid');

            if (!firebaseUid) {
                return {
                    status: 400,
                    jsonBody: { error: "El parámetro 'firebaseUid' es obligatorio." }
                };
            }

            connection = await mssql.connect(baseDbConfig);
            context.log('Conexión a la base de datos exitosa (getdoses).');

            const dbRequest = new mssql.Request(connection);
            dbRequest.input('firebaseUid', mssql.NVarChar(128), firebaseUid);

            const query = `
                SELECT
                    dr.RecordID         AS recordID,
                    m.Name              AS medicationName,
                    dr.ScheduledTime    AS scheduledTime,
                    dr.Status           AS status
                FROM DoseRecords AS dr
                INNER JOIN UserPlans AS up ON dr.PlanID = up.PlanID
                INNER JOIN Medications AS m ON up.MedicationID = m.MedicationID
                WHERE up.OwnerFirebaseUID = @firebaseUid
                ORDER BY dr.ScheduledTime ASC;
            `;

            const result = await dbRequest.query(query);

            // Devuelve un array con los resultados (o un array vacío si no hay ninguno).
            return {
                status: 200,
                jsonBody: result.recordset || []
            };

        } catch (err) {
            context.log.error('Error en getdoses:', err);
            return {
                status: 500,
                jsonBody: {
                    error: 'Error al obtener los registros de dosis.',
                    detail: err?.message || String(err)
                }
            };
        } finally {
            if (connection) {
                connection.close();
                context.log('Conexión a la base de datos cerrada (getdoses).');
            }
        }
    }
});
