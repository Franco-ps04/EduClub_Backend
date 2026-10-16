const router = require('express').Router();
const auth = require('../middlewares/auth');
const soloRoles = require('../middlewares/roles');
const controller = require('../controllers/diplomas.controller');

router.get('/mis', auth, soloRoles('alumno'), controller.misDiplomas);
router.get('/talleres/:idTaller/pdf', auth, soloRoles('alumno'), controller.descargarDiploma);

module.exports = router;
