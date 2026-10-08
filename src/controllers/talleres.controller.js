const tallerDAO = require('../dao/TallerDAO');
const tipoDAO = require('../dao/TipoDAO');
const usuarioDAO = require('../dao/UsuarioDAO');
const sesionDAO = require('../dao/SesionDAO');
const { subirImagenTaller, crearUrlFirmadaTaller } = require('../config/supabaseStorage');
const { validarDatosTaller, parseRequisitos } = require('../utils/tallerHelpers');

/**
 * Valida la cantidad de dias segun el tipo de evento y devuelve el mensaje
 * de error (o null si esta bien). 'Seminario' no usa dias (se ignoran);
 * 'Sesión' exige entre 1 y 3.
 */
async function validarDiasSegunTipo(idTipo, dias) {
  const tipo = await tipoDAO.findTipoEventoById(idTipo);
  const esSeminario = (tipo?.nombre ?? '').toLowerCase().startsWith('semin');
  if (esSeminario) return { esSeminario, error: null };

  if (!dias || dias.length < 1 || dias.length > 3) {
    return { esSeminario, error: 'Selecciona entre 1 y 3 días de la semana para un taller de tipo Sesión.' };
  }
  return { esSeminario, error: null };
}

async function conRequisitos(talleres) {
  const ids = talleres.map(t => t.id_taller);
  const mapa = await tallerDAO.findRequisitosPorTalleres(ids);
  return Promise.all(talleres.map(async (t) => ({
    ...t,
    requisitos: mapa.get(t.id_taller) ?? [],
    imagen_url: t.imagen_url ? await crearUrlFirmadaTaller(t.imagen_url) : null
  })));
}

// GET /api/talleres  (seccion "Talleres")
// - Administrador: ve todos los talleres no archivados.
// - Docente: solo ve los talleres que el mismo creo.
async function listar(req, res) {
  try {
    const { buscar, idArea, idTipo } = req.query;
    let idDocente;

    if (req.usuario.rol === 'docente') {
      const docente = await usuarioDAO.findDocenteByUsuarioId(req.usuario.id);
      if (!docente) return res.status(403).json({ message: 'No tienes un perfil de docente asociado' });
      idDocente = docente.id_docente;
    }

    const talleres = await tallerDAO.listar({
      buscar,
      idArea: idArea ? Number(idArea) : undefined,
      idTipo: idTipo ? Number(idTipo) : undefined,
      idDocente
    });
    res.json(await conRequisitos(talleres));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/talleres/publico  (seccion alumno: catalogo publico)
async function listarPublico(req, res) {
  try {
    const { buscar, idArea, modalidad } = req.query;
    const talleres = await tallerDAO.listarPublico({ buscar, idArea: idArea ? Number(idArea) : undefined, modalidad });
    res.json(await conRequisitos(talleres));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/talleres/mis-talleres  (solo docente: sus propios talleres)
async function listarMisTalleres(req, res) {
  try {
    const docente = await usuarioDAO.findDocenteByUsuarioId(req.usuario.id);
    if (!docente) return res.status(403).json({ message: 'No tienes un perfil de docente asociado' });

    const talleres = await tallerDAO.listarPorDocente(docente.id_docente);
    res.json(await conRequisitos(talleres));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/talleres/:id
async function obtener(req, res) {
  try {
    const taller = await tallerDAO.findByIdCompleto(Number(req.params.id));
    if (!taller) return res.status(404).json({ message: 'Taller no encontrado' });

    taller.requisitos = await tallerDAO.findRequisitos(taller.id_taller);
    if (taller.imagen_url) taller.imagen_url = await crearUrlFirmadaTaller(taller.imagen_url);
    res.json(taller);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/talleres/catalogos  (tipos de evento + areas, para los <select>)
async function catalogos(req, res) {
  try {
    const [tiposEvento, areas] = await Promise.all([
      tipoDAO.listarTiposEvento(),
      tipoDAO.listarAreas()
    ]);
    res.json({ tiposEvento, areas });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Resuelve el id_docente a asignar segun quien crea/edita el taller:
// SIEMPRE automatico, igual que "Organizador" en el proyecto anterior —
// nunca se elige de una lista. Como Taller.id_docente es una FK obligatoria
// hacia Docente (y un administrador no tiene fila propia en esa tabla), si
// el administrador todavia no tiene una se le crea una vez, de forma
// transparente, para que pueda "ser dueño" de talleres igual que un
// docente. El frontend de todas formas solo muestra el texto "Administrador"
// (no su nombre ni esta fila tecnica).
async function resolverIdDocente(req) {
  const docente = await usuarioDAO.findDocenteByUsuarioId(req.usuario.id);
  if (docente) return docente.id_docente;

  if (req.usuario.rol === 'administrador') {
    return usuarioDAO.crearDocente(req.usuario.id, 'Administración');
  }

  // No deberia pasar (todo docente se crea junto con su fila en Docente),
  // pero se deja como salvaguarda.
  throw new Error('No tienes un perfil de docente asociado');
}

// POST /api/talleres
async function crear(req, res) {
  try {
    const { errores, datos } = validarDatosTaller(req.body);
    if (errores.length) return res.status(400).json({ message: errores[0], errores });

    const { esSeminario, error: errorDias } = await validarDiasSegunTipo(datos.idTipo, datos.dias);
    if (errorDias) return res.status(400).json({ message: errorDias });

    const idDocente = await resolverIdDocente(req);

    let imagenUrl = null;
    if (req.file) {
      imagenUrl = await subirImagenTaller(req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    const idTaller = await tallerDAO.crear({ ...datos, idDocente, imagenUrl });

    const requisitos = parseRequisitos(req.body.requisitos);
    for (let i = 0; i < requisitos.length; i++) {
      await tallerDAO.insertarRequisito(idTaller, requisitos[i], i + 1);
    }

    // Genera automaticamente las sesiones: 1 para Seminario, 1 por cada
    // dia elegido (1 a 3) para Sesión. Ver SesionDAO.generarParaTaller.
    await sesionDAO.generarParaTaller({
      idTaller, esSeminario, fechaTaller: datos.fecha, horaTaller: datos.hora, dias: datos.dias
    });

    const taller = await tallerDAO.findByIdCompleto(idTaller);
    taller.requisitos = requisitos;
    if (taller.imagen_url) taller.imagen_url = await crearUrlFirmadaTaller(taller.imagen_url);
    res.status(201).json(taller);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/talleres/:id
async function actualizar(req, res) {
  try {
    const idTaller = Number(req.params.id);
    const existente = await tallerDAO.findById(idTaller);
    if (!existente) return res.status(404).json({ message: 'Taller no encontrado' });

    const docenteActual = await usuarioDAO.findDocenteByUsuarioId(req.usuario.id);
    const esPropietario = docenteActual && docenteActual.id_docente === existente.id_docente;

    // Tanto docente como administrador pueden editar un taller propio mientras
    // siga Próximo. Un administrador que no es el creador solo puede observarlo.
    if (!esPropietario) {
      return res.status(403).json({ message: 'Solo el creador del taller puede editarlo.' });
    }

    const estadoActual = await tallerDAO.estadoActual(idTaller);
    if (estadoActual !== 'Proximo' && estadoActual !== 'Próximo') {
      return res.status(400).json({ message: 'Solo se puede editar un taller antes de que inicie.' });
    }

    const { errores, datos } = validarDatosTaller(req.body);
    if (errores.length) return res.status(400).json({ message: errores[0], errores });

    const { esSeminario, error: errorDias } = await validarDiasSegunTipo(datos.idTipo, datos.dias);
    if (errorDias) return res.status(400).json({ message: errorDias });

    const idDocente = await resolverIdDocente(req);

    let imagenUrl;
    if (req.file) {
      imagenUrl = await subirImagenTaller(req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    await tallerDAO.actualizar(idTaller, { ...datos, idDocente, imagenUrl });

    const requisitos = parseRequisitos(req.body.requisitos);
    await tallerDAO.eliminarRequisitos(idTaller);
    for (let i = 0; i < requisitos.length; i++) {
      await tallerDAO.insertarRequisito(idTaller, requisitos[i], i + 1);
    }

    // Las sesiones solo se regeneran si todavia no se registro ninguna
    // asistencia: una vez que el docente empieza a pasar asistencia, el
    // numero/fecha de sesiones ya no se debe reordenar desde aqui (eso
    // evita perder historial). En ese caso se deja advertencia en la
    // respuesta y las sesiones existentes no se tocan.
    let sesionesRegeneradas = true;
    const yaTieneAsistencias = await sesionDAO.tieneAsistenciasRegistradas(idTaller);
    if (!yaTieneAsistencias) {
      await sesionDAO.eliminarPorTaller(idTaller);
      await sesionDAO.generarParaTaller({
        idTaller, esSeminario, fechaTaller: datos.fecha, horaTaller: datos.hora, dias: datos.dias
      });
    } else {
      sesionesRegeneradas = false;
    }

    const taller = await tallerDAO.findByIdCompleto(idTaller);
    taller.requisitos = requisitos;
    taller.sesionesRegeneradas = sesionesRegeneradas;
    if (taller.imagen_url) taller.imagen_url = await crearUrlFirmadaTaller(taller.imagen_url);
    res.json(taller);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PATCH /api/talleres/:id/estado
async function cambiarEstado(req, res) {
  try {
    const idTaller = Number(req.params.id);
    const estado = String(req.body.estado ?? '').trim();
    if (!['Finalizado', 'Cancelado'].includes(estado)) {
      return res.status(400).json({ message: 'Solo puedes finalizar o cancelar un taller.' });
    }

    const taller = await tallerDAO.findByIdCompleto(idTaller);
    if (!taller) return res.status(404).json({ message: 'Taller no encontrado' });

    const estadoActual = await tallerDAO.estadoActual(idTaller);
    if (!['Proximo', 'Próximo', 'En curso'].includes(estadoActual)) {
      return res.status(400).json({ message: `No puedes cambiar un taller que ya está en estado "${estadoActual}".` });
    }

    const esPropietario = Number(taller.id_usuario_docente) === Number(req.usuario.id);
    // El creador puede finalizar/cancelar desde Próximo o En curso. Un
    // administrador que no es dueño puede intervenir una vez que el taller
    // ya está En curso, siguiendo la lógica administrativa del proyecto
    // anterior.
    const puedeGestionar = esPropietario || (req.usuario.rol === 'administrador' && estadoActual === 'En curso');
    if (!puedeGestionar) {
      return res.status(403).json({ message: 'No tienes permiso para cambiar el estado de este taller.' });
    }

    await tallerDAO.actualizarEstado(idTaller, estado);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/talleres/:id  ("eliminar" en la UI = archivar, nunca se borra)
async function archivar(req, res) {
  try {
    const idTaller = Number(req.params.id);
    const existente = await tallerDAO.findById(idTaller);
    if (!existente) return res.status(404).json({ message: 'Taller no encontrado' });

    const estadoActual = await tallerDAO.estadoActual(idTaller);
    if (!['Finalizado', 'Cancelado'].includes(estadoActual)) {
      return res.status(400).json({ message: 'Solo se puede archivar un taller finalizado o cancelado.' });
    }

    const esPropietario = Number(existente.id_usuario_docente) === Number(req.usuario.id);
    if (!esPropietario && req.usuario.rol !== 'administrador') {
      return res.status(403).json({ message: 'No puedes archivar un taller que no es tuyo.' });
    }

    await tallerDAO.archivar(idTaller);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'No se pudo archivar el taller' });
  }
}

// GET /api/talleres/estadisticas
async function estadisticas(req, res) {
  try {
    res.json(await tallerDAO.estadisticas());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/talleres/:id/sesiones
async function listarSesiones(req, res) {
  try {
    res.json(await sesionDAO.listarPorTaller(Number(req.params.id)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/talleres/docentes  (para que administrador elija a quien asignar el taller)
async function docentesDisponibles(req, res) {
  try {
    res.json(await usuarioDAO.listarDocentesActivos());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  listar, listarPublico, listarMisTalleres, obtener, catalogos,
  crear, actualizar, cambiarEstado, archivar, estadisticas, docentesDisponibles,
  listarSesiones
};
