const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const mensajesController = require('../controllers/mensajes.controller');

// Alumno (se usara cuando se construya esa seccion del proyecto)
router.get('/destinatarios', auth, soloRoles('alumno'), mensajesController.destinatarios);
router.get('/mis', auth, soloRoles('alumno'), mensajesController.misMensajes);
router.post('/', auth, soloRoles('alumno'), mensajesController.crear);
router.post('/:id/seguimiento', auth, soloRoles('alumno'), mensajesController.seguimiento);
router.patch('/:id/leido', auth, soloRoles('alumno'), mensajesController.marcarLeidoAlumno);

// Docente / Administrador (cada uno ve solo lo dirigido a el)
router.get('/panel', auth, soloRoles('docente', 'administrador'), mensajesController.panel);
router.patch('/:id/marcar-leido', auth, soloRoles('docente', 'administrador'), mensajesController.marcarLeidoAdmin);
router.post('/:id/responder', auth, soloRoles('docente', 'administrador'), mensajesController.responder);

module.exports = router;
