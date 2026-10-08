const { query } = require('../config/db');

/**
 * ReglaDiploma
 * Configuracion GLOBAL (no por taller) de los niveles de constancia que se
 * emiten automaticamente segun % de asistencia al finalizar un taller.
 * La emision real la hace el trigger fn_procesar_asistencia en PostgreSQL;
 * aqui solo se administra la tabla de reglas.
 */
class ReglaDiplomaDAO {
  async listar() {
    const { rows } = await query(
      `SELECT id_regla_diploma, nombre_nivel, porcentaje_minimo, porcentaje_maximo,
              descripcion, activo, color, icono
       FROM ReglaDiploma
       ORDER BY porcentaje_minimo DESC`
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await query('SELECT * FROM ReglaDiploma WHERE id_regla_diploma = $1', [id]);
    return rows[0] || null;
  }

  async actualizar(id, { nombreNivel, porcentajeMinimo, porcentajeMaximo, descripcion, color, icono }) {
    await query(
      `UPDATE ReglaDiploma
       SET nombre_nivel = $1, porcentaje_minimo = $2, porcentaje_maximo = $3,
           descripcion = $4, color = $5, icono = $6
       WHERE id_regla_diploma = $7`,
      [nombreNivel, porcentajeMinimo, porcentajeMaximo, descripcion, color, icono, id]
    );
  }

  async actualizarActivo(id, activo) {
    await query('UPDATE ReglaDiploma SET activo = $1 WHERE id_regla_diploma = $2', [Boolean(activo), id]);
  }

  async crear({ nombreNivel, porcentajeMinimo, porcentajeMaximo, descripcion, color, icono }) {
    const { rows } = await query(
      `INSERT INTO ReglaDiploma (nombre_nivel, porcentaje_minimo, porcentaje_maximo, descripcion, color, icono)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id_regla_diploma`,
      [nombreNivel, porcentajeMinimo, porcentajeMaximo, descripcion, color, icono]
    );
    return rows[0].id_regla_diploma;
  }
}

module.exports = new ReglaDiplomaDAO();
