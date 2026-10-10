require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { verificarConexion } = require('./config/db');

const app = express();

// CORS: por defecto permite Angular en localhost:4200 (desarrollo).
// En produccion (Render) define CORS_ORIGIN con el dominio del frontend,
// separado por comas si hay mas de uno.
// Ej: CORS_ORIGIN=https://tu-app.vercel.app,http://localhost:4200
const origenesPermitidos = (process.env.CORS_ORIGIN || 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: origenesPermitidos,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parsear JSON en el body
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Registro de rutas
// NOTA: las rutas de inscripciones, asistencia, mensajes, notificaciones,
// usuarios, carga-alumnos y reportes se van agregando aqui a medida que se
// construye cada seccion del panel admin/docente.
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/talleres', require('./routes/talleres.routes'));
app.use('/api/reglas-diploma', require('./routes/reglaDiploma.routes'));
app.use('/api', require('./routes/recursos.routes'));
app.use('/api/inscripcion', require('./routes/inscripcion.routes'));
app.use('/api/mensajes', require('./routes/mensajes.routes'));
app.use('/api/carga-alumnos', require('./routes/cargaAlumnos.routes'));
app.use('/api/usuarios', require('./routes/usuarios.routes'));
app.use('/api/reportes', require('./routes/reportes.routes'));

// Ruta de prueba
app.get('/api/ping', (req, res) => res.json({ ok: true, mensaje: 'EduTaller API activa' }));

// Manejo global de errores
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Error interno del servidor' });
});

// Arrancar servidor
const PORT = process.env.PORT || 3000;
verificarConexion()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ No se pudo conectar a PostgreSQL:', err.message);
        process.exit(1);
    });