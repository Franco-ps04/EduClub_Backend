const tallerDAO = require('../dao/TallerDAO');
const sesionDAO = require('../dao/SesionDAO');
const asistenciaDAO = require('../dao/AsistenciaDAO');
const notificacionDAO = require('../dao/NotificacionDAO');
const inscripcionDAO = require('../dao/InscripcionDAO');
const { crearUrlFirmadaTaller } = require('../config/supabaseStorage');

const ESTADOS_TERMINALES = ['Finalizado', 'Cancelado'];


// GET /api/inscripcion/mis (alumno)
async function misInscripcionesAlumno(req, res) {
  try {
    const data = await inscripcionDAO.misInscripciones(req.usuario.id);
    const conImagenes = await Promise.all(data.map(async (item) => ({
      ...item,
      imagen_url: item.imagen_url ? await crearUrlFirmadaTaller(item.imagen_url) : null
    })));
    res.json(conImagenes);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'No se pudieron cargar tus inscripciones.' });
  }
}

// POST /api/inscripcion (alumno) Body: { idTaller }
async function inscribirseAlumno(req, res) {
  const idTaller = Number(req.body.idTaller ?? req.body.id_taller);
  if (!Number.isInteger(idTaller) || idTaller < 1) {
    return res.status(400).json({ message: 'Selecciona un taller válido.' });
  }
  try {
    const resultado = await inscripcionDAO.inscribir(req.usuario.id, idTaller);
    res.status(201).json({
      ok: true,
      id_inscripcion: resultado.id_inscripcion,
      reactivada: resultado.reactivada,
      message: resultado.reactivada ? 'Inscripción reactivada correctamente.' : 'Inscripción realizada correctamente.'
    });
  } catch (err) {
    res.status(err.status || (err.code === '23505' ? 409 : 500)).json({
      message: err.code === '23505' ? 'Ya estás inscrito en este taller.' : (err.message || 'No se pudo completar la inscripción.')
    });
  }
}

// PATCH /api/inscripcion/:id/cancelar (alumno)
async function cancelarInscripcionAlumno(req, res) {
  const idInscripcion = Number(req.params.id);
  if (!Number.isInteger(idInscripcion) || idInscripcion < 1) {
    return res.status(400).json({ message: 'La inscripción indicada no es válida.' });
  }
  try {
    await inscripcionDAO.cancelar(idInscripcion, req.usuario.id);
    res.json({ ok: true, message: 'Inscripción cancelada correctamente.' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'No se pudo cancelar la inscripción.' });
  }
}

// GET /api/inscripcion/talleres
// Lista compartida (administrador y docente ven todos los talleres, igual
// que en la seccion Talleres) con el conteo de inscritos de cada uno.
async function listarTalleres(req, res) {
  try {
    const { buscar } = req.query;
    const talleres = await tallerDAO.listar({ buscar });

    const conSesiones = await Promise.all(talleres.map(async (t) => ({
      id_taller: t.id_taller,
      nombre: t.nombre,
      fecha: t.fecha,
      hora: t.hora,
      estado: t.estado,
      inscritos: t.inscritos,
      total_sesiones: t.total_sesiones,
      tipo_evento: t.tipo_evento,
      sesiones: (await sesionDAO.listarPorTaller(t.id_taller))
        .map(s => ({ id_sesion: s.id_sesion, numero_sesion: s.numero_sesion }))
    })));

    res.json(conSesiones);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/inscripcion/talleres/:idTaller/resumen
// Solo para talleres con mas de 1 sesion (tipo Sesión).
async function resumenTaller(req, res) {
  try {
    const data = await asistenciaDAO.resumenPorTaller(Number(req.params.idTaller));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/inscripcion/sesiones/:idSesion
// Alumnos inscritos + su asistencia en esa sesion puntual (sirve tanto
// para Seminario -su unica sesion- como para una sesion elegida dentro
// del Resumen de un taller tipo Sesión).
async function listarPorSesion(req, res) {
  try {
    const idSesion = Number(req.params.idSesion);
    const sesion = await asistenciaDAO.findSesionConTaller(idSesion);
    if (!sesion) return res.status(404).json({ message: 'Sesión no encontrada' });

    const alumnos = await asistenciaDAO.porSesion(idSesion);
    res.json({ sesion, alumnos });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/inscripcion/asistencia
// Body: { idInscripcion, idSesion, asistio }
async function registrarAsistencia(req, res) {
  try {
    const idInscripcion = Number(req.body.idInscripcion);
    const idSesion = Number(req.body.idSesion);
    const asistio = req.body.asistio;

    if (!Number.isInteger(idInscripcion) || !Number.isInteger(idSesion)) {
      return res.status(400).json({ message: 'Datos de asistencia inválidos' });
    }
    if (typeof asistio !== 'boolean') {
      return res.status(400).json({ message: 'asistio debe ser true o false' });
    }

    // El trigger fn_procesar_asistencia de la BD se encarga de emitir
    // diplomas/reconocimientos automaticamente cuando corresponde.
    await asistenciaDAO.registrar(idInscripcion, idSesion, asistio);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/inscripcion/notificaciones
// Body: { idTaller, titulo, mensaje }  -> notifica a todos los inscritos del taller
async function crearNotificacion(req, res) {
  try {
    const idTaller = Number(req.body.idTaller);
    const titulo = String(req.body.titulo ?? '').trim();
    const mensaje = String(req.body.mensaje ?? '').trim();

    if (!Number.isInteger(idTaller)) {
      return res.status(400).json({ message: 'Selecciona el taller.' });
    }
    if (!titulo) return res.status(400).json({ message: 'El título es obligatorio.' });
    if (titulo.length > 150) return res.status(400).json({ message: 'El título no debe superar 150 caracteres.' });
    if (!mensaje) return res.status(400).json({ message: 'El mensaje es obligatorio.' });
    if (mensaje.length > 5000) return res.status(400).json({ message: 'El mensaje es demasiado largo.' });

    const taller = await tallerDAO.findById(idTaller);
    if (!taller) return res.status(404).json({ message: 'Taller no encontrado' });
    if (ESTADOS_TERMINALES.includes(taller.estado)) {
      return res.status(400).json({ message: 'No puedes enviar notificaciones a talleres finalizados o cancelados.' });
    }

    const idNotificacion = await notificacionDAO.crear({
      idUsuario: req.usuario.id, idTaller, titulo, mensaje
    });
    res.status(201).json({ id: idNotificacion });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  misInscripcionesAlumno, inscribirseAlumno, cancelarInscripcionAlumno,
  listarTalleres, resumenTaller, listarPorSesion, registrarAsistencia, crearNotificacion
};
