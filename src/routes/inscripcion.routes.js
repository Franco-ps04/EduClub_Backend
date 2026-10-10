const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const controller = require('../controllers/inscripcion.controller');

const permitido = soloRoles('docente', 'administrador');

router.get('/talleres', auth, permitido, controller.listarTalleres);
router.get('/talleres/:idTaller/resumen', auth, permitido, controller.resumenTaller);
router.get('/sesiones/:idSesion', auth, permitido, controller.listarPorSesion);
router.put('/asistencia', auth, permitido, controller.registrarAsistencia);
router.post('/notificaciones', auth, permitido, controller.crearNotificacion);

module.exports = router;
