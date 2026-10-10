const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const { uploadExcel } = require('../config/upload');
const controller = require('../controllers/cargaAlumnos.controller');

const permitido = soloRoles('docente', 'administrador');

router.get('/plantilla', auth, permitido, controller.plantilla);
router.post('/validar', auth, permitido, uploadExcel.single('archivo'), controller.validar);
router.post('/:idCarga/registrar', auth, permitido, controller.registrar);

module.exports = router;
