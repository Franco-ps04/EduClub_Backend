const { query } = require('../config/db');

/**
 * TipoDAO
 * Catalogos de solo lectura para los formularios de Taller:
 * - TipoEvento: 'Sesión' | 'Seminario' (define cuantas sesiones puede tener)
 * - TipoArea: 'Matemática', 'Ciencias', 'Comunicación', 'Ciencias Sociales',
 *   'Informática', 'Humanidades'
 */
class TipoDAO {
  async listarTiposEvento() {
    const { rows } = await query('SELECT id_tipo, nombre FROM TipoEvento ORDER BY id_tipo ASC');
    return rows;
  }

  async listarAreas() {
    const { rows } = await query('SELECT id_area, nombre FROM TipoArea ORDER BY id_area ASC');
    return rows;
  }

  async findTipoEventoById(id) {
    const { rows } = await query('SELECT id_tipo, nombre FROM TipoEvento WHERE id_tipo = $1', [id]);
    return rows[0] || null;
  }
}

module.exports = new TipoDAO();
