const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const { uploadTaller } = require('../config/upload');
const talleresController = require('../controllers/talleres.controller');

// Rutas fijas ANTES de '/:id' para que no choquen con el parametro.
// El catálogo se consulta después de iniciar sesión, como está definido para EduTaller.
const todosLosRoles = soloRoles('alumno', 'docente', 'administrador');
router.get('/publico', auth, todosLosRoles, talleresController.listarPublico);
router.get('/catalogos', auth, todosLosRoles, talleresController.catalogos);
router.get('/estadisticas', auth, soloRoles('docente', 'administrador'), talleresController.estadisticas);
router.get('/mis-talleres', auth, soloRoles('docente'), talleresController.listarMisTalleres);
router.get('/docentes', auth, soloRoles('administrador'), talleresController.docentesDisponibles);

router.get('/', auth, soloRoles('docente', 'administrador'), talleresController.listar);
router.get('/:id/sesiones', auth, todosLosRoles, talleresController.listarSesiones);
router.get('/:id', auth, todosLosRoles, talleresController.obtener);

router.post(
  '/',
  auth,
  soloRoles('docente', 'administrador'),
  uploadTaller.single('imagen'),
  talleresController.crear
);

router.put(
  '/:id',
  auth,
  soloRoles('docente', 'administrador'),
  uploadTaller.single('imagen'),
  talleresController.actualizar
);

router.patch('/:id/estado', auth, soloRoles('docente', 'administrador'), talleresController.cambiarEstado);
router.delete('/:id', auth, soloRoles('docente', 'administrador'), talleresController.archivar);

module.exports = router;
