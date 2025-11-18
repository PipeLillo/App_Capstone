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


