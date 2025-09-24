const { app } = require('@azure/functions');
const mssql = require('mssql');

app.http('savetosql', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Función HTTP procesando una solicitud.');

        try {
            // Analiza el cuerpo de la solicitud JSON para obtener los datos
            const { firebaseUid, userEmail } = await request.json();

            // Validación de los datos de entrada
            if (!firebaseUid) {
                return {
                    status: 400,
                    body: "Por favor, pase un UID de Firebase válido en el cuerpo de la solicitud."
                };
            }

            // Configuración de la conexión a la base de datos SQL Server
            // Las variables de entorno se cargan desde local.settings.json (local)
            // o desde la configuración de la aplicación de Azure (producción)
            const config = {
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                server: process.env.DB_SERVER,
                database: process.env.DB_DATABASE,
                options: {
                    encrypt: true, // Habilita el cifrado para la seguridad de la conexión
                    enableArithAbort: true
                }
            };

            // Conecta a la base de datos
            await mssql.connect(config);
            context.log('Conexión a la base de datos exitosa.');

            // Crea una nueva solicitud SQL
            const dbRequest = new mssql.Request();

            // Prepara la consulta SQL para la inserción
            const query = 'INSERT INTO Users (FirebaseUid, Email) VALUES (@firebaseUid, @userEmail)';
            
            // Asigna los parámetros de la consulta para evitar la inyección SQL
            dbRequest.input('firebaseUid', mssql.NVarChar(50), firebaseUid);
            dbRequest.input('userEmail', mssql.NVarChar(255), userEmail || null);

            // Ejecuta la consulta
            await dbRequest.query(query);
            context.log(`Usuario con UID ${firebaseUid} guardado exitosamente.`);

            // Responde con un mensaje de éxito
            return {
                status: 200,
                body: `Usuario con UID ${firebaseUid} guardado exitosamente.`
            };
        } catch (err) {
            // Captura y registra cualquier error para depuración
            context.log.error('Error al conectar o insertar en la base de datos:', err);

            // Responde con un error genérico para no exponer detalles sensibles
            return {
                status: 500,
                body: "Ocurrió un error al procesar la solicitud. Por favor, intente de nuevo más tarde."
            };
        } finally {
            // Cierra la conexión a la base de datos en todos los casos
            mssql.close();
            context.log('Conexión a la base de datos cerrada.');
        }
    }
});