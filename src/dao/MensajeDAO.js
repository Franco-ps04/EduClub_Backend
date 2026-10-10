const { query } = require('../config/db');
const BaseDAO = require('./BaseDAO');

const CAMPOS_MENSAJE = `
  m.id_mensaje,
  m.asunto,
  m.mensaje,
  TO_CHAR(m.fecha, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS fecha,
  m.leido,
  m.leido_por_alumno,
  m.respondido,
  m.id_alumno AS "idRemitente",
  m.id_usuario AS "idDestinatario",
  u.nombres AS remitente,
  u.email AS "emailRemitente",
  u2.nombres AS destinatario,
  u2.rol AS "rolDestinatario",
  t.nombre AS "tallerRelacionado"
`;

class MensajeDAO extends BaseDAO {
  constructor() {
    super('Mensaje', 'id_mensaje');
  }

  async getHistorial(idMensaje) {
    const { rows } = await query(
      `SELECT
         r.id_respuesta,
         r.texto,
         TO_CHAR(r.fecha, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS fecha,
         u.nombres AS respondido_por,
         u.rol AS rol_usuario,
         CASE WHEN u.rol = 'alumno' THEN 'alumno' ELSE 'admin' END AS tipo
       FROM RespuestaMensaje r
       INNER JOIN Usuario u ON r.id_usuario = u.id_usuario
       WHERE r.id_mensaje = $1
       ORDER BY r.fecha ASC, r.id_respuesta ASC`,
      [idMensaje]
    );
    return rows;
  }

  /** Docentes y administradores activos (para que un alumno elija a quién escribir). */
  async destinatariosParaAlumno() {
    const { rows } = await query(
      `SELECT u.id_usuario, u.nombres, u.email, u.rol
       FROM Usuario u
       WHERE u.activo = true AND u.rol IN ('docente', 'administrador')
       ORDER BY u.nombres ASC`
    );
    return rows;
  }

  async misMensajes(idAlumno) {
    const { rows } = await query(
      `SELECT ${CAMPOS_MENSAJE}
       FROM Mensaje m
       INNER JOIN Usuario u ON m.id_alumno = u.id_usuario
       INNER JOIN Usuario u2 ON m.id_usuario = u2.id_usuario
       LEFT JOIN Taller t ON m.id_taller = t.id_taller
       WHERE m.id_alumno = $1
       ORDER BY m.fecha DESC, m.id_mensaje DESC`,
      [idAlumno]
    );
    return rows;
  }

  /** Mensajes dirigidos directamente al docente/administrador en sesión (nunca "ver todos"). */
  async panelDestinatario(idUsuarioDestino) {
    const { rows } = await query(
      `SELECT ${CAMPOS_MENSAJE}
       FROM Mensaje m
       INNER JOIN Usuario u ON m.id_alumno = u.id_usuario
       INNER JOIN Usuario u2 ON m.id_usuario = u2.id_usuario
       LEFT JOIN Taller t ON m.id_taller = t.id_taller
       WHERE m.id_usuario = $1
       ORDER BY m.fecha DESC, m.id_mensaje DESC`,
      [idUsuarioDestino]
    );
    return rows;
  }

  async findDestinoValido(idUsuario) {
    const { rows } = await query(
      `SELECT id_usuario, rol
       FROM Usuario
       WHERE id_usuario = $1 AND rol IN ('docente', 'administrador') AND activo = true`,
      [idUsuario]
    );
    return rows[0] || null;
  }

  async findTallerParaMensaje(idTaller) {
    const { rows } = await query(
      `SELECT id_taller, estado FROM Taller WHERE id_taller = $1 AND archivado = false`,
      [idTaller]
    );
    return rows[0] || null;
  }

  async crear({ asunto, mensaje, idAlumno, idDestino, idTaller }) {
    const { rows } = await query(
      `INSERT INTO Mensaje (asunto, mensaje, id_alumno, id_usuario, id_taller)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_mensaje`,
      [asunto, mensaje, idAlumno, idDestino, idTaller]
    );
    return rows[0].id_mensaje;
  }

  async crearRespuesta(idMensaje, texto, idUsuario) {
    await query(
      `INSERT INTO RespuestaMensaje (id_mensaje, texto, id_usuario) VALUES ($1, $2, $3)`,
      [idMensaje, texto, idUsuario]
    );
  }

  async findByIdYAlumno(idMensaje, idAlumno) {
    const { rows } = await query(
      `SELECT id_mensaje FROM Mensaje WHERE id_mensaje = $1 AND id_alumno = $2`,
      [idMensaje, idAlumno]
    );
    return rows[0] || null;
  }

  async findByIdYDestino(idMensaje, idUsuarioDestino) {
    const { rows } = await query(
      `SELECT id_mensaje FROM Mensaje WHERE id_mensaje = $1 AND id_usuario = $2`,
      [idMensaje, idUsuarioDestino]
    );
    return rows[0] || null;
  }

  async marcarLeidoPorAlumno(idMensaje, idAlumno) {
    await query(
      `UPDATE Mensaje SET leido_por_alumno = true WHERE id_mensaje = $1 AND id_alumno = $2`,
      [idMensaje, idAlumno]
    );
  }

  async marcarLeido(idMensaje) {
    await query(`UPDATE Mensaje SET leido = true WHERE id_mensaje = $1`, [idMensaje]);
  }
}

module.exports = new MensajeDAO();
