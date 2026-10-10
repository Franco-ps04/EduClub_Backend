const { query } = require('../config/db');

class CargaAlumnoDAO {
  async crear(nombreArchivo) {
    const { rows } = await query(
      `INSERT INTO CargaAlumno (nombre_archivo, estado) VALUES ($1, 'procesando') RETURNING id_carga`,
      [nombreArchivo]
    );
    return rows[0].id_carga;
  }

  async actualizarEstado(idCarga, estado) {
    await query('UPDATE CargaAlumno SET estado = $1 WHERE id_carga = $2', [estado, idCarga]);
  }

  async insertarDetalle({ idCarga, nombre, correo, telefono, contrasena, estado }) {
    const { rows } = await query(
      `INSERT INTO DetalleCargaAlumno (id_carga, nombre, correo, telefono, contrasena, estado)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id_detalle`,
      [idCarga, nombre, correo, telefono, contrasena, estado]
    );
    return rows[0].id_detalle;
  }

  async listarDetalle(idCarga) {
    const { rows } = await query(
      `SELECT id_detalle, nombre, correo, telefono, estado, id_usuario
       FROM DetalleCargaAlumno WHERE id_carga = $1 ORDER BY id_detalle ASC`,
      [idCarga]
    );
    return rows;
  }

  /** Incluye la contrasena (solo para uso interno al registrar, nunca se devuelve por API). */
  async listarDetallePendientes(idCarga) {
    const { rows } = await query(
      `SELECT id_detalle, nombre, correo, telefono, contrasena
       FROM DetalleCargaAlumno
       WHERE id_carga = $1 AND estado = 'valido_para_registrar'
       ORDER BY id_detalle ASC`,
      [idCarga]
    );
    return rows;
  }

  async findCarga(idCarga) {
    const { rows } = await query('SELECT * FROM CargaAlumno WHERE id_carga = $1', [idCarga]);
    return rows[0] || null;
  }

  async marcarCreado(idDetalle, idUsuario) {
    await query(
      `UPDATE DetalleCargaAlumno SET estado = 'creado_exitosamente', id_usuario = $1 WHERE id_detalle = $2`,
      [idUsuario, idDetalle]
    );
  }

  async marcarError(idDetalle, estado) {
    await query('UPDATE DetalleCargaAlumno SET estado = $1 WHERE id_detalle = $2', [estado, idDetalle]);
  }
}

module.exports = new CargaAlumnoDAO();
