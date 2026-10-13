const router = require('express').Router();
const contactoController = require('../controllers/contacto.controller');

// Formulario público de contacto: el correo se envía por SMTP configurado en el backend.
router.post('/', contactoController.enviar);

module.exports = router;
