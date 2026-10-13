const mensajeDAO = require('../dao/MensajeDAO');
const { estadoKey } = require('../utils/validators');
const inscripcionDAO = require('../dao/InscripcionDAO');
const tallerDAO = require('../dao/TallerDAO');

// GET /api/mensajes/destinatarios  (alumno)
async function destinatarios(req, res) {
  try {
    res.json(await mensajeDAO.destinatariosParaAlumno());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/mensajes/mis  (alumno)
async function misMensajes(req, res) {
  try {
    const msgs = await mensajeDAO.misMensajes(req.usuario.id);
    const data = [];
    for (const msg of msgs) {
      data.push({ ...msg, historial: await mensajeDAO.getHistorial(msg.id_mensaje) });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/mensajes  (alumno)
async function crear(req, res) {
  const { idUsuarioDestino, idDestinatario, asunto, mensaje, idTaller } = req.body;

  const destino = Number(idUsuarioDestino || idDestinatario);
  const asuntoLimpio = String(asunto ?? '').trim();
  const mensajeLimpio = String(mensaje ?? '').trim();
  const tallerProporcionado = idTaller !== undefined && idTaller !== null && String(idTaller).trim() !== '';
  const idTallerNum = tallerProporcionado ? Number(idTaller) : null;

  if (!Number.isInteger(destino) || destino < 1 || !asuntoLimpio || !mensajeLimpio) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }
  if (asuntoLimpio.length > 150) {
    return res.status(400).json({ message: 'El asunto no debe superar 150 caracteres' });
  }
  if (mensajeLimpio.length > 5000) {
    return res.status(400).json({ message: 'El mensaje no debe superar 5000 caracteres' });
  }
  if (tallerProporcionado && (!Number.isInteger(idTallerNum) || idTallerNum < 1)) {
    return res.status(400).json({ message: 'El taller relacionado no es válido' });
  }

  try {
    const destinoOk = await mensajeDAO.findDestinoValido(destino);
    if (!destinoOk) {
      return res.status(400).json({ message: 'El destinatario debe ser un docente o administrador activo' });
    }

    if (idTallerNum) {
      const taller = await tallerDAO.findByIdCompleto(idTallerNum);
      if (!taller || taller.archivado) return res.status(404).json({ message: 'El taller no existe' });

      const estado = estadoKey(taller.estado);
      if (estado === 'finalizado' || estado === 'cancelado') {
        return res.status(400).json({ message: 'Solo puedes enviar mensajes mientras el taller esté activo' });
      }

      const inscrito = await inscripcionDAO.tieneActiva(req.usuario.id, idTallerNum);
      if (!inscrito) return res.status(403).json({ message: 'Solo puedes relacionar un mensaje con un taller en el que estés inscrito.' });

      // En una consulta relacionada con un taller, el destinatario es siempre
      // la cuenta que lo creó. Puede ser Docente o Administrador: cuando un
      // administrador crea un taller, Taller.id_docente apunta a su perfil
      // técnico, vinculado a la misma cuenta de Usuario.
      if (Number(taller.id_usuario_docente) !== destino) {
        return res.status(400).json({ message: 'Para consultas por taller, el destinatario debe ser la persona que creó ese taller.' });
      }
    }

    const idMensaje = await mensajeDAO.crear({
      asunto: asuntoLimpio, mensaje: mensajeLimpio,
      idAlumno: req.usuario.id, idDestino: destino, idTaller: idTallerNum
    });

    res.status(201).json({ ok: true, id: idMensaje });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/mensajes/:id/seguimiento  (alumno)
async function seguimiento(req, res) {
  const idMensaje = Number(req.params.id);
  if (!Number.isInteger(idMensaje) || idMensaje < 1) {
    return res.status(400).json({ message: 'El mensaje indicado no es válido.' });
  }
  const texto = String(req.body.texto ?? '').trim();
  if (!texto) {
    return res.status(400).json({ message: 'El texto no puede estar vacío' });
  }
  if (texto.length > 5000) return res.status(400).json({ message: 'La respuesta no debe superar 5000 caracteres' });
  try {
    const check = await mensajeDAO.findByIdYAlumno(idMensaje, req.usuario.id);
    if (!check) return res.status(404).json({ message: 'Mensaje no encontrado' });

    await mensajeDAO.crearRespuesta(idMensaje, texto, req.usuario.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PATCH /api/mensajes/:id/leido  (alumno)
async function marcarLeidoAlumno(req, res) {
  const idMensaje = Number(req.params.id);
  if (!Number.isInteger(idMensaje) || idMensaje < 1) {
    return res.status(400).json({ message: 'El mensaje indicado no es válido.' });
  }
  try {
    const check = await mensajeDAO.findByIdYAlumno(idMensaje, req.usuario.id);
    if (!check) return res.status(404).json({ message: 'Mensaje no encontrado' });
    await mensajeDAO.marcarLeidoPorAlumno(idMensaje, req.usuario.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/mensajes/panel  (docente/administrador — solo lo dirigido a él)
async function panel(req, res) {
  try {
    const msgs = await mensajeDAO.panelDestinatario(req.usuario.id);
    const data = [];
    for (const msg of msgs) {
      data.push({ ...msg, historial: await mensajeDAO.getHistorial(msg.id_mensaje) });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PATCH /api/mensajes/:id/marcar-leido  (docente/administrador)
async function marcarLeidoAdmin(req, res) {
  const idMensaje = Number(req.params.id);
  if (!Number.isInteger(idMensaje) || idMensaje < 1) {
    return res.status(400).json({ message: 'El mensaje indicado no es válido.' });
  }
  try {
    const check = await mensajeDAO.findByIdYDestino(idMensaje, req.usuario.id);
    if (!check) return res.status(404).json({ message: 'Mensaje no encontrado' });

    await mensajeDAO.marcarLeido(idMensaje);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/mensajes/:id/responder  (docente/administrador)
async function responder(req, res) {
  const idMensaje = Number(req.params.id);
  if (!Number.isInteger(idMensaje) || idMensaje < 1) {
    return res.status(400).json({ message: 'El mensaje indicado no es válido.' });
  }
  const texto = String(req.body.texto ?? '').trim();
  if (!texto) {
    return res.status(400).json({ message: 'La respuesta no puede estar vacía' });
  }
  if (texto.length > 5000) return res.status(400).json({ message: 'La respuesta no debe superar 5000 caracteres' });
  try {
    const check = await mensajeDAO.findByIdYDestino(idMensaje, req.usuario.id);
    if (!check) return res.status(404).json({ message: 'Mensaje no encontrado' });

    await mensajeDAO.crearRespuesta(idMensaje, texto, req.usuario.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  destinatarios, misMensajes, crear, seguimiento, marcarLeidoAlumno,
  panel, marcarLeidoAdmin, responder
};
