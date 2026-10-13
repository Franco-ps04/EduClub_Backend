const notificacionDAO = require('../dao/NotificacionDAO');

async function misNotificaciones(req, res) {
  try {
    const data = await notificacionDAO.misNotificaciones(req.usuario.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'No se pudieron cargar las notificaciones.' });
  }
}

async function marcarLeida(req, res) {
  const idNotificacion = Number(req.params.id);
  if (!Number.isInteger(idNotificacion) || idNotificacion < 1) {
    return res.status(400).json({ message: 'La notificación indicada no es válida.' });
  }
  try {
    const actualizada = await notificacionDAO.marcarLeida(idNotificacion, req.usuario.id);
    if (!actualizada) return res.status(404).json({ message: 'Notificación no encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'No se pudo marcar la notificación como leída.' });
  }
}

module.exports = { misNotificaciones, marcarLeida };
