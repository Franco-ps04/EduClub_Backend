const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const controller = require('../controllers/notificaciones.controller');

const soloAlumno = soloRoles('alumno');

router.get('/mis', auth, soloAlumno, controller.misNotificaciones);
router.patch('/:id/leida', auth, soloAlumno, controller.marcarLeida);

module.exports = router;
