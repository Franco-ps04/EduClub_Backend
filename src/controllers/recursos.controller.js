const recursoDAO = require('../dao/RecursoDAO');
const sesionDAO = require('../dao/SesionDAO');
const tallerDAO = require('../dao/TallerDAO');
const usuarioDAO = require('../dao/UsuarioDAO');
const { subirRecurso, crearUrlFirmadaRecurso } = require('../config/supabaseStorage');

const TIPOS_VALIDOS = ['word', 'pdf', 'imagen'];

function tipoPorMimetype(mimetype) {
  if (!mimetype) return null;
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('image/')) return 'imagen';
  if (
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'word';
  return null;
}

// GET /api/mis-talleres  (docente: sus talleres; administrador: todos)
async function misTalleres(req, res) {
  try {
    let talleres;
    let resumen;

    if (req.usuario.rol === 'administrador') {
      talleres = await tallerDAO.listar({});
      resumen = await tallerDAO.estadisticasGlobalDocentes();
    } else {
      const docente = await usuarioDAO.findDocenteByUsuarioId(req.usuario.id);
      if (!docente) return res.status(403).json({ message: 'No tienes un perfil de docente asociado' });

      talleres = await tallerDAO.listarPorDocente(docente.id_docente);
      resumen = await tallerDAO.estadisticasDocente(docente.id_docente);
    }

    const talleresConStats = await Promise.all(
      talleres.map(async (t) => ({
        ...t,
        stats: await tallerDAO.estadisticasPorTaller(t.id_taller)
      }))
    );

    res.json({ resumen, talleres: talleresConStats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/talleres/:idTaller/recursos  (todas las sesiones + sus recursos)
async function listarRecursosPorTaller(req, res) {
  try {
    const idTaller = Number(req.params.idTaller);
    const [sesiones, recursos] = await Promise.all([
      sesionDAO.listarPorTaller(idTaller),
      recursoDAO.listarPorTaller(idTaller)
    ]);

    const recursosConAcceso = await Promise.all(recursos.map(async (r) => ({
      ...r,
      archivo_url: r.archivo_url ? await crearUrlFirmadaRecurso(r.archivo_url) : null,
      archivo_descarga_url: r.archivo_url
        ? await crearUrlFirmadaRecurso(r.archivo_url, { download: true })
        : null
    })));

    const porSesion = sesiones.map(s => ({
      ...s,
      recursos: recursosConAcceso.filter(r => r.id_sesion === s.id_sesion)
    }));

    res.json(porSesion);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/recursos  (multipart: documento + campos)
async function crear(req, res) {
  try {
    const idSesion = Number(req.body.idSesion);
    const titulo = String(req.body.titulo ?? '').trim();
    const tituloSesion = String(req.body.tituloSesion ?? '').trim();
    const descripcion = String(req.body.descripcion ?? '').trim();
    const enlaceUrl = String(req.body.enlace ?? '').trim() || null;
    const tipo = String(req.body.tipo ?? '').trim();

    if (!Number.isInteger(idSesion)) {
      return res.status(400).json({ message: 'Selecciona la sesión.' });
    }
    if (titulo.length < 3) {
      return res.status(400).json({ message: 'Ingresa el título del recurso.' });
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ message: 'Selecciona el tipo de recurso (Word, PDF o imagen).' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Adjunta el documento.' });
    }

    // El archivo debe coincidir con el tipo elegido (si escogio Word, solo
    // se acepta Word; si escogio PDF, solo PDF; etc.).
    const tipoDetectado = tipoPorMimetype(req.file.mimetype);
    if (tipoDetectado !== tipo) {
      return res.status(400).json({
        message: `El archivo no coincide con el tipo "${tipo}" seleccionado.`
      });
    }

    const archivoUrl = await subirRecurso(req.file.buffer, req.file.originalname, req.file.mimetype);

    // El titulo de la sesion solo se puede poner la primera vez: si ya
    // tiene uno, no se vuelve a sobrescribir aunque llegue otro valor.
    if (tituloSesion) {
      await recursoDAO.actualizarTituloSesionSiVacio(idSesion, tituloSesion);
    }

    const idRecurso = await recursoDAO.crear({ idSesion, tipo, titulo, descripcion, archivoUrl, enlaceUrl });
    const recurso = await recursoDAO.findById(idRecurso);
    res.status(201).json(recurso);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/recursos/:id
async function eliminar(req, res) {
  try {
    await recursoDAO.eliminar(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { misTalleres, listarRecursosPorTaller, crear, eliminar };
