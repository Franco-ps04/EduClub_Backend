const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const controller = require('../controllers/reconocimientos.controller');

// Cada alumno solo consulta los reconocimientos emitidos para su propia cuenta.
router.get('/mis', auth, soloRoles('alumno'), controller.misReconocimientos);

module.exports = router;
