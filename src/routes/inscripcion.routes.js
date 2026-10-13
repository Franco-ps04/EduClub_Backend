const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const controller = require('../controllers/inscripcion.controller');

const permitido = soloRoles('docente', 'administrador');
const soloAlumno = soloRoles('alumno');

// Rutas personales de Alumno. Se declaran antes de las rutas de gestion docente/admin.
router.get('/mis', auth, soloAlumno, controller.misInscripcionesAlumno);
router.post('/', auth, soloAlumno, controller.inscribirseAlumno);
router.patch('/:id/cancelar', auth, soloAlumno, controller.cancelarInscripcionAlumno);

router.get('/talleres', auth, permitido, controller.listarTalleres);
router.get('/talleres/:idTaller/resumen', auth, permitido, controller.resumenTaller);
router.get('/sesiones/:idSesion', auth, permitido, controller.listarPorSesion);
router.put('/asistencia', auth, permitido, controller.registrarAsistencia);
router.post('/notificaciones', auth, permitido, controller.crearNotificacion);

module.exports = router;
