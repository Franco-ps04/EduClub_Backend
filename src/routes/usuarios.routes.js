const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const usuariosController = require('../controllers/usuarios.controller');

const soloAdmin = soloRoles('administrador');
const usuariosAutenticados = soloRoles('alumno', 'docente', 'administrador');

// Perfil propio: debe declararse antes de /:id para no tratarlo como un ID.
router.get('/mi-perfil', auth, usuariosAutenticados, usuariosController.obtenerMiPerfil);
router.patch('/mi-perfil', auth, usuariosAutenticados, usuariosController.actualizarMiPerfil);

router.get('/', auth, soloAdmin, usuariosController.listar);
router.get('/exportar', auth, soloAdmin, usuariosController.exportar); // antes de "/:id"
router.get('/:id', auth, soloAdmin, usuariosController.obtener);
router.post('/', auth, soloAdmin, usuariosController.crearDocente);
router.put('/:id', auth, soloAdmin, usuariosController.actualizar);
router.patch('/:id/estado', auth, soloAdmin, usuariosController.cambiarEstado);

module.exports = router;
