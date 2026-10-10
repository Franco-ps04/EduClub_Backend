const { query } = require('../config/db');
const BaseDAO = require('./BaseDAO');

/**
 * UsuarioDAO
 * Acceso a datos de Usuario / Alumno / Docente / Administrador.
 * Ninguna de estas funciones valida entradas de negocio: eso vive en los
 * controladores. Aqui solo hay SQL parametrizado.
 */
class UsuarioDAO extends BaseDAO {
  constructor() {
    super('Usuario', 'id_usuario');
  }

  async findByEmail(email) {
    const { rows } = await query(
      `SELECT u.id_usuario, u.nombres, u.email, u.contrasena, u.rol, u.telefono, u.activo,
              d.institucion
       FROM Usuario u
       LEFT JOIN Docente d ON d.id_usuario = u.id_usuario
       WHERE u.email = $1`,
      [email]
    );
    return rows[0] || null;
  }

  async findByEmailAndTelefono(email, telefono) {
    const { rows } = await query(
      `SELECT id_usuario, activo
       FROM Usuario
       WHERE email = $1 AND telefono = $2`,
      [email, telefono]
    );
    return rows[0] || null;
  }

  async findAuthById(id) {
    const { rows } = await query(
      `SELECT id_usuario, activo FROM Usuario WHERE id_usuario = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async crearUsuario({ nombres, email, hash, telefono, rol = 'alumno' }) {
    const { rows } = await query(
      `INSERT INTO Usuario (nombres, email, contrasena, telefono, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_usuario`,
      [nombres, email, hash, telefono, rol]
    );
    return rows[0].id_usuario;
  }

  async crearAlumno(idUsuario) {
    await query('INSERT INTO Alumno (id_usuario) VALUES ($1)', [idUsuario]);
  }

  async crearDocente(idUsuario, institucion) {
    const { rows } = await query(
      `INSERT INTO Docente (id_usuario, institucion)
       VALUES ($1, $2)
       RETURNING id_docente`,
      [idUsuario, institucion]
    );
    return rows[0].id_docente;
  }

  async crearAdministrador(idUsuario) {
    await query('INSERT INTO Administrador (id_usuario) VALUES ($1)', [idUsuario]);
  }

  async findDocenteByUsuarioId(idUsuario) {
    const { rows } = await query(
      `SELECT id_docente, institucion, id_usuario
       FROM Docente
       WHERE id_usuario = $1`,
      [idUsuario]
    );
    return rows[0] || null;
  }

  async actualizarPassword(idUsuario, hash) {
    await query('UPDATE Usuario SET contrasena = $1 WHERE id_usuario = $2', [hash, idUsuario]);
  }

  async actualizarEstado(id, activo) {
    await query('UPDATE Usuario SET activo = $1 WHERE id_usuario = $2', [Boolean(activo), id]);
  }

  async actualizarPerfil(id, { nombres, telefono }) {
    await query(
      'UPDATE Usuario SET nombres = $1, telefono = $2 WHERE id_usuario = $3',
      [nombres, telefono, id]
    );
  }

  async findConDetalle(id) {
    const { rows } = await query(
      `SELECT u.id_usuario, u.nombres, u.email, u.telefono, u.rol, u.activo,
              TO_CHAR(u.creado_en, 'YYYY-MM-DD') AS creado_en,
              d.institucion,
              (SELECT COUNT(*)::int FROM Inscripcion i WHERE i.id_alumno = u.id_usuario) AS talleres_alumno,
              (SELECT COUNT(*)::int FROM Taller t
                 INNER JOIN Docente doc ON doc.id_docente = t.id_docente
                 WHERE doc.id_usuario = u.id_usuario) AS talleres_docente
       FROM Usuario u
       LEFT JOIN Docente d ON d.id_usuario = u.id_usuario
       WHERE u.id_usuario = $1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Actualiza datos basicos + maneja el cambio de rol:
   * - Si el nuevo rol es 'docente': crea su fila en Docente si no existia
   *   (o actualiza su institucion si ya la tenia).
   * - Si el rol cambia DESDE 'docente' hacia otro: la fila en Docente se
   *   conserva (no se borra), solo deja de usarse para talleres nuevos —
   *   evita perder el historial de los talleres que ya dictaba.
   */
  async actualizar(id, { nombres, email, telefono, rol, institucion }) {
    await query(
      'UPDATE Usuario SET nombres = $1, email = $2, telefono = $3, rol = $4 WHERE id_usuario = $5',
      [nombres, email, telefono, rol, id]
    );

    if (rol === 'docente') {
      const existente = await this.findDocenteByUsuarioId(id);
      if (existente) {
        await query('UPDATE Docente SET institucion = $1 WHERE id_docente = $2', [institucion, existente.id_docente]);
      } else {
        await this.crearDocente(id, institucion);
      }
    }
  }

  async findRolById(id) {
    const { rows } = await query('SELECT rol FROM Usuario WHERE id_usuario = $1', [id]);
    return rows[0]?.rol ?? null;
  }

  /**
   * Listado para la seccion Usuarios (solo administrador).
   * rol: 'alumno' | 'docente' | 'administrador' (opcional)
   * buscar: coincide con nombres o email
   */
  async listar({ rol, buscar } = {}) {
    const condiciones = ['1 = 1'];
    const params = [];

    if (rol) {
      params.push(rol);
      condiciones.push(`u.rol = $${params.length}`);
    }
    if (buscar) {
      params.push(`%${buscar}%`);
      condiciones.push(`(u.nombres ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const { rows } = await query(
      `SELECT
         u.id_usuario, u.nombres, u.email, u.telefono,
         u.rol, u.activo,
         TO_CHAR(u.creado_en, 'YYYY-MM-DD') AS creado_en,
         d.institucion,
         (SELECT COUNT(*)::int FROM Inscripcion i WHERE i.id_alumno = u.id_usuario) AS talleres_alumno,
         (SELECT COUNT(*)::int FROM Taller t
            INNER JOIN Docente doc ON doc.id_docente = t.id_docente
            WHERE doc.id_usuario = u.id_usuario) AS talleres_docente
       FROM Usuario u
       LEFT JOIN Docente d ON d.id_usuario = u.id_usuario
       WHERE ${condiciones.join(' AND ')}
       ORDER BY u.creado_en DESC`,
      params
    );
    return rows;
  }

  /** Docentes activos, para que el administrador elija a quien asignar un taller. */
  async listarDocentesActivos() {
    const { rows } = await query(
      `SELECT d.id_docente, d.institucion, u.id_usuario, u.nombres, u.email
       FROM Docente d
       INNER JOIN Usuario u ON u.id_usuario = d.id_usuario
       WHERE u.activo = true
       ORDER BY u.nombres ASC`
    );
    return rows;
  }

  /**
   * Docentes y administradores activos, para el selector de destinatario
   * de mensajes de un alumno.
   */
  async findDestinatariosActivos() {
    const { rows } = await query(
      `SELECT
         u.id_usuario, u.nombres, u.email, u.rol,
         d.institucion
       FROM Usuario u
       LEFT JOIN Docente d ON d.id_usuario = u.id_usuario
       WHERE u.activo = true
         AND u.rol IN ('docente', 'administrador')
       ORDER BY u.nombres ASC`
    );
    return rows;
  }
}

module.exports = new UsuarioDAO();
