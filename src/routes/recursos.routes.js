const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const { uploadRecurso } = require('../config/upload');
const controller = require('../controllers/recursos.controller');

// "Mis talleres" (docente: sus propios talleres; administrador: todos)
router.get('/mis-talleres', auth, soloRoles('docente', 'administrador'), controller.misTalleres);

// Recursos de todas las sesiones de un taller
router.get('/talleres/:idTaller/recursos', auth, soloRoles('docente', 'administrador'), controller.listarRecursosPorTaller);

// Crear / eliminar un recurso
router.post('/recursos', auth, soloRoles('docente', 'administrador'), uploadRecurso.single('archivo'), controller.crear);
router.delete('/recursos/:id', auth, soloRoles('docente', 'administrador'), controller.eliminar);

module.exports = router;
