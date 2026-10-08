const { query } = require('../config/db');

class NotificacionDAO {
  async crear({ idUsuario, idTaller, titulo, mensaje }) {
    const { rows } = await query(
      `INSERT INTO Notificacion (titulo, mensaje, id_usuario, id_taller)
       VALUES ($1, $2, $3, $4)
       RETURNING id_notificacion`,
      [titulo, mensaje, idUsuario, idTaller]
    );
    return rows[0].id_notificacion;
  }
}

module.exports = new NotificacionDAO();
