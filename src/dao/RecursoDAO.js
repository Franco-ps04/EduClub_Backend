const { query } = require('../config/db');

class RecursoDAO {
  async listarPorSesion(idSesion) {
    const { rows } = await query(
      `SELECT id_recurso, id_sesion, tipo, titulo, descripcion, archivo_url, enlace_url,
              TO_CHAR(fecha_subida, 'YYYY-MM-DD') AS fecha_subida
       FROM Recurso
       WHERE id_sesion = $1
       ORDER BY fecha_subida DESC`,
      [idSesion]
    );
    return rows;
  }

  /** Recursos de TODAS las sesiones de un taller, agrupables en el frontend. */
  async listarPorTaller(idTaller) {
    const { rows } = await query(
      `SELECT r.id_recurso, r.id_sesion, r.tipo, r.titulo, r.descripcion,
              r.archivo_url, r.enlace_url,
              TO_CHAR(r.fecha_subida, 'YYYY-MM-DD') AS fecha_subida,
              s.numero_sesion, s.titulo AS sesion_titulo,
              TO_CHAR(s.fecha, 'YYYY-MM-DD') AS sesion_fecha
       FROM Recurso r
       INNER JOIN Sesion s ON s.id_sesion = r.id_sesion
       WHERE s.id_taller = $1
       ORDER BY s.numero_sesion ASC, r.fecha_subida DESC`,
      [idTaller]
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await query('SELECT * FROM Recurso WHERE id_recurso = $1', [id]);
    return rows[0] || null;
  }

  async crear({ idSesion, tipo, titulo, descripcion, archivoUrl, enlaceUrl }) {
    const { rows } = await query(
      `INSERT INTO Recurso (id_sesion, tipo, titulo, descripcion, archivo_url, enlace_url)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id_recurso`,
      [idSesion, tipo, titulo, descripcion, archivoUrl, enlaceUrl]
    );
    return rows[0].id_recurso;
  }

  async eliminar(id) {
    await query('DELETE FROM Recurso WHERE id_recurso = $1', [id]);
  }

  /** Actualiza el titulo de una sesion SOLO si todavia no tiene uno (se fija una sola vez). */
  async actualizarTituloSesionSiVacio(idSesion, titulo) {
    await query(
      `UPDATE Sesion SET titulo = $1 WHERE id_sesion = $2 AND (titulo IS NULL OR titulo = '')`,
      [titulo, idSesion]
    );
  }
}

module.exports = new RecursoDAO();
