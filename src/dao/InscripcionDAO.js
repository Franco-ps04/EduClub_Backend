const { query } = require('../config/db');

class InscripcionDAO {
  /** Alumnos inscritos (no anulados) en un taller, con sus datos basicos. */
  async listarPorTaller(idTaller) {
    const { rows } = await query(
      `SELECT i.id_inscripcion, i.estado,
              TO_CHAR(i.fecha_inscripcion, 'YYYY-MM-DD') AS fecha_inscripcion,
              u.id_usuario, u.nombres, u.email
       FROM Inscripcion i
       INNER JOIN Usuario u ON u.id_usuario = i.id_alumno
       WHERE i.id_taller = $1 AND i.estado <> 'Anulado'
       ORDER BY u.nombres ASC`,
      [idTaller]
    );
    return rows;
  }

  /** Al suspender un alumno: anula (no borra) sus inscripciones activas. */
  async anularActivasPorAlumno(idAlumno) {
    await query(
      `UPDATE Inscripcion SET estado = 'Anulado'
       WHERE id_alumno = $1 AND estado NOT IN ('Anulado', 'Finalizado')`,
      [idAlumno]
    );
  }

  async contarPorTaller(idTaller) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM Inscripcion WHERE id_taller = $1 AND estado <> 'Anulado'`,
      [idTaller]
    );
    return rows[0].total;
  }
}

module.exports = new InscripcionDAO();
