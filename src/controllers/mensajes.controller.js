const mensajeDAO = require('../dao/MensajeDAO');
const { estadoKey } = require('../utils/validators');

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
  const idTallerNum = idTaller === undefined || idTaller === null || String(idTaller).trim() === ''
    ? null
    : Number(idTaller);

  if (!destino || !asuntoLimpio || !mensajeLimpio) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }
  if (asuntoLimpio.length > 150) {
    return res.status(400).json({ message: 'El asunto no debe superar 150 caracteres' });
  }
  if (mensajeLimpio.length > 5000) {
    return res.status(400).json({ message: 'El mensaje es demasiado largo' });
  }

  try {
    const destinoOk = await mensajeDAO.findDestinoValido(destino);
    if (!destinoOk) {
      return res.status(400).json({ message: 'El destinatario debe ser un docente o administrador activo' });
    }

    if (idTallerNum) {
      const taller = await mensajeDAO.findTallerParaMensaje(idTallerNum);
      if (!taller) return res.status(404).json({ message: 'El taller no existe' });

      const estado = estadoKey(taller.estado);
      if (estado === 'finalizado' || estado === 'cancelado') {
        return res.status(400).json({ message: 'Solo puedes enviar mensajes mientras el taller esté activo' });
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
  const { texto } = req.body;
  if (!texto || !texto.trim()) {
    return res.status(400).json({ message: 'El texto no puede estar vacío' });
  }
  try {
    const check = await mensajeDAO.findByIdYAlumno(req.params.id, req.usuario.id);
    if (!check) return res.status(404).json({ message: 'Mensaje no encontrado' });

    await mensajeDAO.crearRespuesta(req.params.id, texto.trim(), req.usuario.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PATCH /api/mensajes/:id/leido  (alumno)
async function marcarLeidoAlumno(req, res) {
  try {
    await mensajeDAO.marcarLeidoPorAlumno(req.params.id, req.usuario.id);
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
  try {
    const check = await mensajeDAO.findByIdYDestino(req.params.id, req.usuario.id);
    if (!check) return res.status(404).json({ message: 'Mensaje no encontrado' });

    await mensajeDAO.marcarLeido(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/mensajes/:id/responder  (docente/administrador)
async function responder(req, res) {
  const { texto } = req.body;
  if (!texto || !texto.trim()) {
    return res.status(400).json({ message: 'La respuesta no puede estar vacía' });
  }
  try {
    const check = await mensajeDAO.findByIdYDestino(req.params.id, req.usuario.id);
    if (!check) return res.status(404).json({ message: 'Mensaje no encontrado' });

    await mensajeDAO.crearRespuesta(req.params.id, texto.trim(), req.usuario.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  destinatarios, misMensajes, crear, seguimiento, marcarLeidoAlumno,
  panel, marcarLeidoAdmin, responder
};
