const { query } = require('../config/db');

class ReconocimientoDAO {
  /** Reconocimientos emitidos para el alumno autenticado. */
  async misReconocimientos(idAlumno) {
    const { rows } = await query(
      `SELECT
         re.id_reconocimiento,
         re.id_alumno,
         re.id_regla,
         re.id_taller,
         TO_CHAR(re.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
         re.archivo_url,
         rr.titulo,
         rr.tipo,
         rr.umbral,
         rr.motivo,
         rr.color,
         rr.imagen_url,
         t.nombre AS taller
       FROM Reconocimiento re
       INNER JOIN ReglaReconocimiento rr ON rr.id_regla = re.id_regla
       LEFT JOIN Taller t ON t.id_taller = re.id_taller
       WHERE re.id_alumno = $1
       ORDER BY re.fecha_emision DESC, re.id_reconocimiento DESC`,
      [idAlumno]
    );
    return rows;
  }
}

module.exports = new ReconocimientoDAO();
