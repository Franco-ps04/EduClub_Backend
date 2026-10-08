const { query } = require('../config/db');

class ReporteDAO {
  async resumenTalleres() {
    const { rows } = await query(
      `SELECT
         t.id_taller, t.nombre, t.descripcion,
         TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
         TO_CHAR(t.hora, 'HH24:MI') AS hora,
         t.ubicacion, t.capacidad, t.estado,
         ta.nombre AS area,
         u.nombres AS docente,
         d.institucion,
         COALESCE((
           SELECT COUNT(*)::int FROM Inscripcion i
           WHERE i.id_taller = t.id_taller AND i.estado <> 'Anulado'
         ), 0) AS inscritos,
         COALESCE(asist.asistieron, 0) AS asistieron,
         COALESCE(asist.no_asistieron, 0) AS "noAsistieron"
       FROM Taller t
       INNER JOIN TipoArea ta ON ta.id_area = t.id_area
       INNER JOIN Docente d ON d.id_docente = t.id_docente
       INNER JOIN Usuario u ON u.id_usuario = d.id_usuario
       LEFT JOIN (
         SELECT
           s.id_taller,
           SUM(CASE WHEN a.asistio = true THEN 1 ELSE 0 END)::int AS asistieron,
           SUM(CASE WHEN a.asistio = false THEN 1 ELSE 0 END)::int AS no_asistieron
         FROM Sesion s
         LEFT JOIN Asistencia a ON a.id_sesion = s.id_sesion
         GROUP BY s.id_taller
       ) asist ON asist.id_taller = t.id_taller
       WHERE t.archivado = false
       ORDER BY t.fecha DESC, t.hora DESC, t.id_taller DESC`
    );
    return rows;
  }

  /** Alumnos con más sesiones asistidas (equivalente a "voluntarios más activos"). */
  async topAlumnos() {
    const { rows } = await query(
      `SELECT
         u.id_usuario, u.nombres,
         COUNT(a.id_asistencia)::int AS talleres
       FROM Usuario u
       INNER JOIN Inscripcion i ON i.id_alumno = u.id_usuario
       LEFT JOIN Asistencia a ON a.id_inscripcion = i.id_inscripcion AND a.asistio = true
       WHERE u.activo = true AND u.rol = 'alumno'
       GROUP BY u.id_usuario, u.nombres
       ORDER BY COUNT(a.id_asistencia) DESC, u.nombres ASC
       LIMIT 10`
    );
    return rows;
  }
}

module.exports = new ReporteDAO();
