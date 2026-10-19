const { query } = require('../config/db');

class CodigoRecuperacionDAO {
  /** Invalida los códigos anteriores del usuario y crea uno nuevo. */
  async crear(idUsuario, hash, expira) {
    await query(
      `UPDATE codigos_recuperacion SET usado = TRUE
       WHERE id_usuario = $1 AND usado = FALSE`,
      [idUsuario]
    );
    const { rows } = await query(
      `INSERT INTO codigos_recuperacion (id_usuario, codigo_hash, expira)
       VALUES ($1, $2, $3) RETURNING id`,
      [idUsuario, hash, expira]
    );
    return rows[0].id;
  }

  /** Último código sin usar del usuario. */
  async findVigente(idUsuario) {
    const { rows } = await query(
      `SELECT id, codigo_hash, expira, intentos, usado
       FROM codigos_recuperacion
       WHERE id_usuario = $1 AND usado = FALSE
       ORDER BY creado DESC LIMIT 1`,
      [idUsuario]
    );
    return rows[0] || null;
  }

  /** Último código generado (usado o no), para limitar reenvíos. */
  async findUltimo(idUsuario) {
    const { rows } = await query(
      `SELECT id, creado FROM codigos_recuperacion
       WHERE id_usuario = $1 ORDER BY creado DESC LIMIT 1`,
      [idUsuario]
    );
    return rows[0] || null;
  }

  async incrementarIntentos(id) {
    await query('UPDATE codigos_recuperacion SET intentos = intentos + 1 WHERE id = $1', [id]);
  }

  async marcarUsado(id) {
    await query('UPDATE codigos_recuperacion SET usado = TRUE WHERE id = $1', [id]);
  }
}

module.exports = new CodigoRecuperacionDAO();