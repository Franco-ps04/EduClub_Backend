const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const reportesController = require('../controllers/reportes.controller');

const soloAdmin = soloRoles('administrador');

router.get('/resumen', auth, soloAdmin, reportesController.resumen);
router.get('/exportar', auth, soloAdmin, reportesController.exportar);

module.exports = router;
