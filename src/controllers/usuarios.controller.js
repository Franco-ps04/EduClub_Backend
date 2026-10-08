const bcrypt = require('bcryptjs');
const usuarioDAO = require('../dao/UsuarioDAO');
const inscripcionDAO = require('../dao/InscripcionDAO');
const { soloDigitos, validarEmail, validarPassword } = require('../utils/validators');
const { generarExcelUsuarios, generarPdfUsuarios } = require('../utils/exportUsuarios');

const ROLES_VALIDOS = ['alumno', 'docente', 'administrador'];

// GET /api/usuarios?rol=&buscar=
async function listar(req, res) {
  try {
    const data = await usuarioDAO.listar({ rol: req.query.rol, buscar: req.query.buscar });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/usuarios/:id
async function obtener(req, res) {
  try {
    const usuario = await usuarioDAO.findConDetalle(req.params.id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/usuarios  ("+ Nuevo usuario" — SOLO crea Docente)
// Body: { nombres, email, password, telefono, institucion }
async function crearDocente(req, res) {
  const nombres = String(req.body.nombres ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  const telefono = soloDigitos(req.body.telefono);
  const institucion = String(req.body.institucion ?? '').trim();

  if (nombres.length < 3) return res.status(400).json({ message: 'El nombre debe tener al menos 3 caracteres' });
  if (!validarEmail(email)) return res.status(400).json({ message: 'Ingresa un correo válido' });
  if (!validarPassword(password)) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres, una letra y un número' });
  }
  if (telefono.length !== 9) return res.status(400).json({ message: 'El teléfono debe tener 9 dígitos' });
  if (institucion.length < 3) return res.status(400).json({ message: 'La institución es obligatoria' });

  try {
    const existe = await usuarioDAO.findByEmail(email);
    if (existe) return res.status(409).json({ message: 'El correo ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const idUsuario = await usuarioDAO.crearUsuario({ nombres, email, hash, telefono, rol: 'docente' });
    await usuarioDAO.crearDocente(idUsuario, institucion);

    const usuario = await usuarioDAO.findConDetalle(idUsuario);
    res.status(201).json(usuario);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/usuarios/:id
// Body: { nombres, email, telefono, rol, institucion }
async function actualizar(req, res) {
  const nombres = String(req.body.nombres ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const telefono = soloDigitos(req.body.telefono);
  const rol = String(req.body.rol ?? '').trim();
  const institucion = String(req.body.institucion ?? '').trim();

  if (nombres.length < 3) return res.status(400).json({ message: 'El nombre debe tener al menos 3 caracteres' });
  if (!validarEmail(email)) return res.status(400).json({ message: 'Ingresa un correo válido' });
  if (telefono.length !== 9) return res.status(400).json({ message: 'El teléfono debe tener 9 dígitos' });
  if (!ROLES_VALIDOS.includes(rol)) return res.status(400).json({ message: 'Rol inválido' });
  if (rol === 'docente' && institucion.length < 3) {
    return res.status(400).json({ message: 'La institución es obligatoria para un docente' });
  }

  try {
    const idObjetivo = Number(req.params.id);
    const rolActual = await usuarioDAO.findRolById(idObjetivo);
    if (!rolActual) return res.status(404).json({ message: 'Usuario no encontrado' });
    // Los administradores quedan protegidos de eliminación/degradación accidental.
    if (rolActual === 'administrador' && rol !== 'administrador') {
      return res.status(400).json({ message: 'No se puede cambiar el rol de un administrador.' });
    }
    await usuarioDAO.actualizar(idObjetivo, { nombres, email, telefono, rol, institucion });
    const usuario = await usuarioDAO.findConDetalle(idObjetivo);
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PATCH /api/usuarios/:id/estado   Body: { activo: boolean }
// Al suspender un alumno se anulan (no se borran) sus inscripciones
// activas; un docente/administrador suspendido simplemente no puede
// iniciar sesión, pero sus talleres NO se tocan (se conserva el
// historial, igual que el resto del proyecto nunca borra nada).
async function cambiarEstado(req, res) {
  if (typeof req.body.activo !== 'boolean') {
    return res.status(400).json({ message: 'activo debe ser true o false' });
  }
  try {
    const rolActual = await usuarioDAO.findRolById(req.params.id);
    if (!rolActual) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (rolActual === 'administrador' && req.body.activo === false) {
      return res.status(400).json({ message: 'La cuenta de administrador no se puede suspender ni eliminar.' });
    }
    if (req.body.activo === false && rolActual === 'alumno') {
      await inscripcionDAO.anularActivasPorAlumno(req.params.id);
    }
    await usuarioDAO.actualizarEstado(req.params.id, req.body.activo);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/usuarios/exportar?formato=xlsx|pdf&id=&rol=&buscar=
async function exportar(req, res) {
  const formato = String(req.query.formato ?? '').toLowerCase();
  if (!['xlsx', 'pdf'].includes(formato)) {
    return res.status(400).json({ message: 'El formato debe ser "xlsx" o "pdf"' });
  }

  try {
    let usuarios;
    let titulo;

    if (req.query.id) {
      const usuario = await usuarioDAO.findConDetalle(req.query.id);
      if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
      usuarios = [usuario];
      titulo = `Usuario - ${usuario.nombres}`;
    } else {
      usuarios = await usuarioDAO.listar({ rol: req.query.rol, buscar: req.query.buscar });
      titulo = 'Listado de usuarios';
    }

    const nombreArchivoBase = req.query.id
      ? `usuario_${req.query.id}`
      : `usuarios_${new Date().toISOString().slice(0, 10)}`;

    if (formato === 'xlsx') {
      const buffer = await generarExcelUsuarios(usuarios, titulo);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivoBase}.xlsx"`);
      return res.send(buffer);
    }

    const buffer = await generarPdfUsuarios(usuarios, titulo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivoBase}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { listar, obtener, crearDocente, actualizar, cambiarEstado, exportar };
