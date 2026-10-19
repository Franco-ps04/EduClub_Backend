const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const usuarioDAO = require('../dao/UsuarioDAO');
const codigoDAO = require('../dao/codigoDAO');
const { enviarCorreo } = require('../services/email');
const { soloDigitos, validarEmail, validarPassword } = require('../utils/validators');

const MAX_INTENTOS = 5;
const MINUTOS_VIGENCIA = 10;
const SEGUNDOS_ENTRE_ENVIOS = 60;

function firmarToken(user) {
  return jwt.sign(
    { id: user.id_usuario, email: user.email, rol: user.rol, nombres: user.nombres },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES }
  );
}

// POST /api/auth/login
// Body: { email, password }
// Sirve para los 3 roles (alumno, docente, administrador); el frontend
// decide a donde redirigir segun el rol devuelto.
async function login(req, res) {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  if (!email || !validarEmail(email)) {
    return res.status(400).json({ message: 'Ingresa un correo electronico valido' });
  }
  if (!password) {
    return res.status(400).json({ message: 'Ingresa tu contrasena' });
  }

  try {
    const user = await usuarioDAO.findByEmail(email);
    if (!user)
      return res.status(401).json({ message: 'Credenciales invalidas' });

    if (!user.activo)
      return res.status(403).json({ message: 'Cuenta suspendida' });

    const ok = await bcrypt.compare(password, user.contrasena);
    if (!ok)
      return res.status(401).json({ message: 'Credenciales invalidas' });

    const token = firmarToken(user);

    res.json({
      id: user.id_usuario,
      nombres: user.nombres,
      email: user.email,
      telefono: user.telefono,
      rol: user.rol,
      institucion: user.institucion ?? null,
      token
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/register
// Body: { nombres, email, password, telefono }
// Registro publico: solo crea cuentas de Alumno. Cuentas de Docente las crea
// el administrador desde la seccion Usuarios; el primer Administrador se
// crea con scripts/seed-admin.js.
async function register(req, res) {
  const nombres = String(req.body.nombres ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  const telefono = soloDigitos(req.body.telefono);

  if (!nombres || nombres.length < 3) {
    return res.status(400).json({ message: 'El nombre debe tener al menos 3 caracteres' });
  }
  if (!email || !validarEmail(email)) {
    return res.status(400).json({ message: 'Ingresa un correo valido' });
  }
  if (!password || !validarPassword(password)) {
    return res.status(400).json({ message: 'La contrasena debe tener al menos 8 caracteres, una letra y un numero' });
  }
  if (!telefono || telefono.length !== 9) {
    return res.status(400).json({ message: 'El telefono debe tener 9 digitos' });
  }

  try {
    const existe = await usuarioDAO.findByEmail(email);
    if (existe)
      return res.status(409).json({ message: 'El correo ya esta registrado' });

    const hash = await bcrypt.hash(password, 10);
    const newId = await usuarioDAO.registrarAlumno({ nombres, email, hash, telefono });

    const token = jwt.sign(
      { id: newId, email, rol: 'alumno', nombres },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    res.status(201).json({ id: newId, nombres, email, telefono, rol: 'alumno', token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'El correo ya esta registrado' });
    }
    res.status(500).json({ message: err.message });
  }
}

// ============================================================
// RECUPERAR CONTRASENA (3 pasos con codigo por correo)
// ============================================================

// Valida el codigo contra el ultimo registro vigente del usuario.
// Suma un intento si no coincide. No consume el codigo.
async function validarCodigo(user, codigo) {
  const registro = await codigoDAO.findVigente(user.id_usuario);
  if (!registro || new Date(registro.expira) < new Date() || registro.intentos >= MAX_INTENTOS) {
    return { ok: false };
  }
  const coincide = await bcrypt.compare(String(codigo), registro.codigo_hash);
  if (!coincide) {
    await codigoDAO.incrementarIntentos(registro.id);
    return { ok: false };
  }
  return { ok: true, registro };
}

// POST /api/auth/recuperar-contrasena/solicitar
// Body: { email }
async function solicitarCodigo(req, res) {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  if (!email || !validarEmail(email)) {
    return res.status(400).json({ message: 'Ingresa un correo valido' });
  }

  try {
    const user = await usuarioDAO.findByEmail(email);

    if (user && user.activo) {
      const ultimo = await codigoDAO.findUltimo(user.id_usuario);
      const muyReciente = ultimo &&
        (Date.now() - new Date(ultimo.creado).getTime()) < SEGUNDOS_ENTRE_ENVIOS * 1000;

      if (!muyReciente) {
        const codigo = String(crypto.randomInt(100000, 1000000));
        const hash = await bcrypt.hash(codigo, 10);
        const expira = new Date(Date.now() + MINUTOS_VIGENCIA * 60 * 1000);

        await codigoDAO.crear(user.id_usuario, hash, expira);
        await enviarCorreo(
          user.email,
          'Código para recuperar tu contraseña',
          `<p>Hola ${user.nombres},</p>
           <p>Tu código de verificación es:</p>
           <h2 style="letter-spacing:4px">${codigo}</h2>
           <p>Vence en ${MINUTOS_VIGENCIA} minutos. Si no lo solicitaste, ignora este mensaje.</p>`
        );
      }
    }

    // Misma respuesta exista o no la cuenta (evita revelar que correos estan registrados)
    return res.json({
      ok: true,
      message: 'Si el correo está registrado, enviamos un código a tu bandeja de entrada'
    });
  } catch (err) {
    console.error('[solicitarCodigo]', err);
    return res.status(500).json({ message: 'No se pudo enviar el codigo' });
  }
}

// POST /api/auth/recuperar-contrasena/verificar
// Body: { email, codigo }
async function verificarCodigo(req, res) {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const codigo = soloDigitos(req.body.codigo);

  if (!email || codigo.length !== 6) {
    return res.status(400).json({ message: 'Datos invalidos' });
  }

  try {
    const user = await usuarioDAO.findByEmail(email);
    const { ok } = user ? await validarCodigo(user, codigo) : { ok: false };
    if (!ok) return res.status(400).json({ message: 'Codigo incorrecto o vencido' });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[verificarCodigo]', err);
    return res.status(500).json({ message: 'No se pudo verificar el codigo' });
  }
}

// POST /api/auth/recuperar-contrasena
// Body: { email, codigo, nuevaContrasena }
async function recuperarContrasena(req, res) {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const codigo = soloDigitos(req.body.codigo);
  const nuevaContrasena = String(req.body.nuevaContrasena ?? '');

  if (!email || !validarEmail(email)) {
    return res.status(400).json({ message: 'Ingresa un correo valido' });
  }
  if (codigo.length !== 6) {
    return res.status(400).json({ message: 'Codigo invalido' });
  }
  if (!nuevaContrasena || !validarPassword(nuevaContrasena)) {
    return res.status(400).json({ message: 'La nueva contrasena debe tener al menos 8 caracteres, una letra y un numero' });
  }

  try {
    const user = await usuarioDAO.findByEmail(email);
    if (!user || !user.activo) {
      return res.status(400).json({ message: 'Codigo incorrecto o vencido' });
    }

    // Se revalida el codigo aqui: no basta con que el front haya pasado el paso 2
    const { ok, registro } = await validarCodigo(user, codigo);
    if (!ok) return res.status(400).json({ message: 'Codigo incorrecto o vencido' });

    const hash = await bcrypt.hash(nuevaContrasena, 10);
    await usuarioDAO.actualizarPassword(user.id_usuario, hash);
    await codigoDAO.marcarUsado(registro.id); // un solo uso

    return res.json({ ok: true, message: 'Contrasena actualizada correctamente' });
  } catch (err) {
    console.error('[recuperarContrasena]', err);
    return res.status(500).json({ message: 'No se pudo actualizar la contrasena' });
  }
}

// GET /api/auth/me
function me(req, res) {
  res.json(req.usuario);
}

module.exports = {
  login,
  register,
  solicitarCodigo,
  verificarCodigo,
  recuperarContrasena,
  me
};