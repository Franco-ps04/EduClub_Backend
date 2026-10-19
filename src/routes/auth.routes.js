const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/auth');
const authController = require('../controllers/auth.controller');

const limiterSolicitar = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Demasiadas solicitudes, intenta más tarde' }
});

const limiterRecuperar = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Demasiados intentos, intenta más tarde' }
});

router.post('/login', authController.login);
router.post('/register', authController.register);

router.post('/recuperar-contrasena/solicitar', limiterSolicitar, authController.solicitarCodigo);
router.post('/recuperar-contrasena/verificar', limiterRecuperar, authController.verificarCodigo);
router.post('/recuperar-contrasena', limiterRecuperar, authController.recuperarContrasena);

router.get('/me', auth, authController.me);

module.exports = router;
