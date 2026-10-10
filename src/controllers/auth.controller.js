const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioDAO = require('../dao/UsuarioDAO');
const { soloDigitos, validarEmail, validarPassword } = require('../utils/validators');

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
  const email = String(req.body.email ?? '').trim();
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
  const email = String(req.body.email ?? '').trim();
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
    const newId = await usuarioDAO.crearUsuario({ nombres, email, hash, telefono, rol: 'alumno' });
    await usuarioDAO.crearAlumno(newId);

    const token = jwt.sign(
      { id: newId, email, rol: 'alumno', nombres },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    res.status(201).json({ id: newId, nombres, email, telefono, rol: 'alumno', token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/recuperar-contrasena
// Body: { email, telefono, nuevaContrasena }
async function recuperarContrasena(req, res) {
  const email = String(req.body.email ?? '').trim();
  const telefono = soloDigitos(req.body.telefono);
  const nuevaContrasena = String(req.body.nuevaContrasena ?? '');

  if (!email || !validarEmail(email)) {
    return res.status(400).json({ message: 'Ingresa un correo valido' });
  }
  if (!telefono || telefono.length !== 9) {
    return res.status(400).json({ message: 'Ingresa un telefono valido de 9 digitos' });
  }
  if (!nuevaContrasena || !validarPassword(nuevaContrasena)) {
    return res.status(400).json({ message: 'La nueva contrasena debe tener al menos 8 caracteres, una letra y un numero' });
  }

  try {
    const user = await usuarioDAO.findByEmailAndTelefono(email, telefono);
    if (!user) {
      return res.status(404).json({ message: 'No encontramos una cuenta con esos datos' });
    }
    if (!user.activo) {
      return res.status(403).json({ message: 'La cuenta esta suspendida' });
    }

    const hash = await bcrypt.hash(nuevaContrasena, 10);
    await usuarioDAO.actualizarPassword(user.id_usuario, hash);

    return res.json({ ok: true, message: 'Contrasena actualizada correctamente' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'No se pudo actualizar la contrasena' });
  }
}

// GET /api/auth/me
function me(req, res) {
  res.json(req.usuario);
}

module.exports = { login, register, recuperarContrasena, me };
