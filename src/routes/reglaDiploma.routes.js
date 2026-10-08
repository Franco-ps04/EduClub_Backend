const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const controller = require('../controllers/reglaDiploma.controller');

router.get('/', auth, soloRoles('docente', 'administrador'), controller.listar);
router.put('/:id', auth, soloRoles('docente', 'administrador'), controller.actualizar);
router.patch('/:id/activo', auth, soloRoles('docente', 'administrador'), controller.actualizarActivo);

module.exports = router;
