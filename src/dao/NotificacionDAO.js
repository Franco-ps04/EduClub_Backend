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

  /**
   * Notificaciones de los talleres en los que el alumno conserva una
   * inscripción activa. La lectura se individualiza por alumno para que
   * leer una notificación no la marque como leída para el resto.
   */
  async misNotificaciones(idAlumno) {
    const { rows } = await query(
      `SELECT
         n.id_notificacion, n.titulo, n.mensaje,
         TO_CHAR(n.fecha, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS fecha,
         t.id_taller, t.nombre AS taller, t.estado AS estado_taller,
         u.nombres AS enviado_por,
         (nl.id_notificacion IS NOT NULL) AS leida
       FROM Notificacion n
       INNER JOIN Taller t ON t.id_taller = n.id_taller
       INNER JOIN Usuario u ON u.id_usuario = n.id_usuario
       INNER JOIN Inscripcion i
         ON i.id_taller = t.id_taller AND i.id_alumno = $1
        AND i.estado NOT IN ('Anulado', 'Cancelado')
       LEFT JOIN NotificacionLeida nl
         ON nl.id_notificacion = n.id_notificacion AND nl.id_alumno = $1
       WHERE t.archivado = false
       ORDER BY n.fecha DESC, n.id_notificacion DESC`,
      [idAlumno]
    );
    return rows;
  }

  async marcarLeida(idNotificacion, idAlumno) {
    const visible = await query(
      `SELECT 1
       FROM Notificacion n
       INNER JOIN Inscripcion i
         ON i.id_taller = n.id_taller AND i.id_alumno = $2
        AND i.estado NOT IN ('Anulado', 'Cancelado')
       INNER JOIN Taller t ON t.id_taller = n.id_taller AND t.archivado = false
       WHERE n.id_notificacion = $1
       LIMIT 1`,
      [idNotificacion, idAlumno]
    );
    if (!visible.rows.length) return false;

    await query(
      `INSERT INTO NotificacionLeida (id_notificacion, id_alumno)
       VALUES ($1, $2)
       ON CONFLICT (id_notificacion, id_alumno) DO NOTHING`,
      [idNotificacion, idAlumno]
    );
    return true;
  }
}

module.exports = new NotificacionDAO();
