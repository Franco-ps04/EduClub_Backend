const { query, pool } = require('../config/db');

const ESTADOS_NO_ACTIVOS = ['Anulado', 'Cancelado'];

function crearError(mensaje, status = 400) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function estadoKey(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function estadoTallerParaInscripcion(estado) {
  const key = estadoKey(estado);
  if (key === 'proximo') return 'Próximo';
  if (key === 'en curso') return 'En curso';
  return estado;
}

class InscripcionDAO {
  /** Alumnos inscritos (no cancelados/anulados) en un taller, para el panel docente/admin. */
  async listarPorTaller(idTaller) {
    const { rows } = await query(
      `SELECT i.id_inscripcion, i.estado,
              TO_CHAR(i.fecha_inscripcion, 'YYYY-MM-DD') AS fecha_inscripcion,
              u.id_usuario, u.nombres, u.email
       FROM Inscripcion i
       INNER JOIN Usuario u ON u.id_usuario = i.id_alumno
       WHERE i.id_taller = $1 AND i.estado NOT IN ('Anulado', 'Cancelado')
       ORDER BY u.nombres ASC`,
      [idTaller]
    );
    return rows;
  }

  /** Al suspender un alumno: anula sus inscripciones activas sin borrar el historial. */
  async anularActivasPorAlumno(idAlumno) {
    await query(
      `UPDATE Inscripcion SET estado = 'Anulado'
       WHERE id_alumno = $1 AND estado NOT IN ('Anulado', 'Cancelado', 'Finalizado')`,
      [idAlumno]
    );
  }

  async contarPorTaller(idTaller) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total
       FROM Inscripcion
       WHERE id_taller = $1 AND estado NOT IN ('Anulado', 'Cancelado')`,
      [idTaller]
    );
    return rows[0].total;
  }

  /** Comprueba si un alumno conserva una inscripción activa al taller. */
  async tieneActiva(idAlumno, idTaller) {
    const { rows } = await query(
      `SELECT 1
       FROM Inscripcion
       WHERE id_alumno = $1 AND id_taller = $2
         AND estado NOT IN ('Anulado', 'Cancelado')
       LIMIT 1`,
      [idAlumno, idTaller]
    );
    return rows.length > 0;
  }

  /**
   * Historial de inscripciones del alumno, con sesiones y asistencia real.
   * El historial se conserva aunque el alumno cancele o el taller se archive.
   */
  async misInscripciones(idAlumno) {
    const { rows } = await query(
      `SELECT
         i.id_inscripcion,
         i.estado AS estado_inscripcion,
         TO_CHAR(i.fecha_inscripcion, 'YYYY-MM-DD') AS fecha_inscripcion,
         t.id_taller, t.nombre AS titulo, t.descripcion,
         TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
         TO_CHAR(t.hora, 'HH24:MI') AS hora,
         COALESCE((SELECT TO_CHAR(MAX(s_end.hora_fin), 'HH24:MI') FROM Sesion s_end WHERE s_end.id_taller = t.id_taller), TO_CHAR(t.hora, 'HH24:MI')) AS hora_fin,
         COALESCE((SELECT ARRAY_AGG(x.dia_semana ORDER BY x.primera_fecha) FROM (SELECT s2.dia_semana, MIN(s2.fecha) AS primera_fecha FROM Sesion s2 WHERE s2.id_taller = t.id_taller GROUP BY s2.dia_semana) x), ARRAY[]::varchar[]) AS dias_semana,
         t.ubicacion, t.modalidad, t.capacidad, t.latitud, t.longitud,
         t.imagen_url, t.institucion,
         ta.nombre AS area, te.nombre AS tipo_evento,
         u.nombres AS docente,
         u.rol AS rol_docente,
         u.id_usuario AS id_usuario_docente,
         COALESCE((
           SELECT COUNT(*)::int FROM Inscripcion i2
           WHERE i2.id_taller = t.id_taller
             AND i2.estado NOT IN ('Anulado', 'Cancelado')
         ), 0) AS inscritos,
         CASE
           WHEN t.estado IN ('Finalizado', 'Cancelado') THEN t.estado
           WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' < (
             SELECT MIN(s2.fecha + s2.hora_inicio)
             FROM Sesion s2 WHERE s2.id_taller = t.id_taller
           ) THEN 'Proximo'
           WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' <= (
             SELECT MAX(s3.fecha + s3.hora_fin)
             FROM Sesion s3 WHERE s3.id_taller = t.id_taller
           ) THEN 'En curso'
           ELSE 'Finalizado'
         END AS estado_taller,
         s.id_sesion, s.numero_sesion,
         TO_CHAR(s.fecha, 'YYYY-MM-DD') AS fecha_sesion,
         s.dia_semana,
         TO_CHAR(s.hora_inicio, 'HH24:MI') AS hora_inicio,
         TO_CHAR(s.hora_fin, 'HH24:MI') AS hora_fin,
         s.titulo AS titulo_sesion,
         a.asistio
       FROM Inscripcion i
       INNER JOIN Taller t ON t.id_taller = i.id_taller
       INNER JOIN TipoArea ta ON ta.id_area = t.id_area
       INNER JOIN TipoEvento te ON te.id_tipo = t.id_tipo
       INNER JOIN Docente d ON d.id_docente = t.id_docente
       INNER JOIN Usuario u ON u.id_usuario = d.id_usuario
       LEFT JOIN Sesion s ON s.id_taller = t.id_taller
       LEFT JOIN Asistencia a
         ON a.id_inscripcion = i.id_inscripcion AND a.id_sesion = s.id_sesion
       WHERE i.id_alumno = $1
       ORDER BY i.fecha_inscripcion DESC, t.fecha DESC, s.numero_sesion ASC`,
      [idAlumno]
    );

    const porInscripcion = new Map();
    for (const row of rows) {
      let item = porInscripcion.get(row.id_inscripcion);
      if (!item) {
        item = {
          id_inscripcion: row.id_inscripcion,
          estado_inscripcion: row.estado_inscripcion,
          fecha_inscripcion: row.fecha_inscripcion,
          id_taller: row.id_taller,
          titulo: row.titulo,
          descripcion: row.descripcion,
          fecha: row.fecha,
          hora: row.hora,
          hora_fin: row.hora_fin,
          dias_semana: row.dias_semana ?? [],
          ubicacion: row.ubicacion,
          modalidad: row.modalidad,
          capacidad: row.capacidad,
          inscritos: Number(row.inscritos || 0),
          latitud: row.latitud,
          longitud: row.longitud,
          imagen_url: row.imagen_url,
          institucion: row.institucion,
          area: row.area,
          tipo_evento: row.tipo_evento,
          docente: row.docente,
          rol_docente: row.rol_docente,
          id_usuario_docente: row.id_usuario_docente,
          estado_taller: estadoTallerParaInscripcion(row.estado_taller),
          sesiones: []
        };
        porInscripcion.set(row.id_inscripcion, item);
      }

      if (row.id_sesion !== null && row.id_sesion !== undefined) {
        item.sesiones.push({
          id_sesion: row.id_sesion,
          numero_sesion: row.numero_sesion,
          fecha: row.fecha_sesion,
          dia_semana: row.dia_semana,
          hora_inicio: row.hora_inicio,
          hora_fin: row.hora_fin,
          titulo: row.titulo_sesion,
          asistio: row.asistio
        });
      }
    }

    return Array.from(porInscripcion.values()).map((item) => {
      const totalSesiones = item.sesiones.length;
      const asistencias = item.sesiones.filter((sesion) => sesion.asistio === true).length;
      const sesionesMarcadas = item.sesiones.filter((sesion) => sesion.asistio !== null).length;
      return {
        ...item,
        total_sesiones: totalSesiones,
        sesiones_marcadas: sesionesMarcadas,
        asistencias,
        porcentaje_asistencia: totalSesiones > 0 ? Math.round((asistencias / totalSesiones) * 100) : 0
      };
    });
  }

  /**
   * Crea/reactiva una inscripción de forma transaccional. Bloquea la fila
   * del taller para evitar que dos solicitudes simultáneas excedan la capacidad.
   */
  async inscribir(idAlumno, idTaller) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tallerResult = await client.query(
        `SELECT t.id_taller, t.capacidad, t.archivado, t.estado,
           CASE
             WHEN t.estado IN ('Finalizado', 'Cancelado') THEN t.estado
             WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' < (
               SELECT MIN(s.fecha + s.hora_inicio) FROM Sesion s WHERE s.id_taller = t.id_taller
             ) THEN 'Proximo'
             WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' <= (
               SELECT MAX(s.fecha + s.hora_fin) FROM Sesion s WHERE s.id_taller = t.id_taller
             ) THEN 'En curso'
             ELSE 'Finalizado'
           END AS estado_actual,
           (SELECT COUNT(*)::int FROM Inscripcion i
             WHERE i.id_taller = t.id_taller
               AND i.estado NOT IN ('Anulado', 'Cancelado')) AS inscritos
         FROM Taller t
         WHERE t.id_taller = $1
         FOR UPDATE OF t`,
        [idTaller]
      );
      const taller = tallerResult.rows[0];
      if (!taller || taller.archivado) throw crearError('El taller no existe o ya no está disponible.', 404);

      const estadoKeyTaller = estadoKey(taller.estado_actual);
      if (!['proximo', 'en curso'].includes(estadoKeyTaller)) {
        throw crearError('El taller no está disponible para nuevas inscripciones.', 400);
      }

      const existenteResult = await client.query(
        `SELECT id_inscripcion, estado
         FROM Inscripcion
         WHERE id_alumno = $1 AND id_taller = $2
         FOR UPDATE`,
        [idAlumno, idTaller]
      );
      const existente = existenteResult.rows[0];
      if (existente && !ESTADOS_NO_ACTIVOS.includes(existente.estado)) {
        throw crearError('Ya estás inscrito en este taller.', 409);
      }

      if (Number(taller.inscritos) >= Number(taller.capacidad)) {
        throw crearError('El taller ya alcanzó su capacidad máxima.', 409);
      }

      // La inscripción conserva el estado activo 'Próximo' tal como lo hacía
      // GreenUnity; el estado dinámico del taller se devuelve por separado.
      // Evita escribir 'En curso' en una columna cuyo catálogo histórico de
      // estados de inscripción solo contempla Próximo/Finalizado/Cancelado.
      const estadoInscripcion = 'Próximo';
      let idInscripcion;
      let reactivada = false;

      if (existente) {
        const actualizado = await client.query(
          `UPDATE Inscripcion
           SET estado = $1, fecha_inscripcion = CURRENT_TIMESTAMP
           WHERE id_inscripcion = $2
           RETURNING id_inscripcion`,
          [estadoInscripcion, existente.id_inscripcion]
        );
        idInscripcion = actualizado.rows[0].id_inscripcion;
        reactivada = true;
        await client.query('DELETE FROM Asistencia WHERE id_inscripcion = $1', [idInscripcion]);
      } else {
        const creado = await client.query(
          `INSERT INTO Inscripcion (id_alumno, id_taller, estado)
           VALUES ($1, $2, $3)
           RETURNING id_inscripcion`,
          [idAlumno, idTaller, estadoInscripcion]
        );
        idInscripcion = creado.rows[0].id_inscripcion;
      }

      await client.query('COMMIT');
      return { id_inscripcion: idInscripcion, reactivada };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) { /* transacción ya cerrada */ }
      throw error;
    } finally {
      client.release();
    }
  }

  /** Cancela la inscripción propia sin eliminar su historial. */
  async cancelar(idInscripcion, idAlumno) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT i.id_inscripcion, i.estado AS estado_inscripcion,
           CASE
             WHEN t.estado IN ('Finalizado', 'Cancelado') THEN t.estado
             WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' < (
               SELECT MIN(s.fecha + s.hora_inicio) FROM Sesion s WHERE s.id_taller = t.id_taller
             ) THEN 'Proximo'
             WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' <= (
               SELECT MAX(s.fecha + s.hora_fin) FROM Sesion s WHERE s.id_taller = t.id_taller
             ) THEN 'En curso'
             ELSE 'Finalizado'
           END AS estado_taller
         FROM Inscripcion i
         INNER JOIN Taller t ON t.id_taller = i.id_taller
         WHERE i.id_inscripcion = $1 AND i.id_alumno = $2
         FOR UPDATE OF i, t`,
        [idInscripcion, idAlumno]
      );
      const inscripcion = result.rows[0];
      if (!inscripcion) throw crearError('Inscripción no encontrada.', 404);
      if (['Anulado', 'Cancelado'].includes(inscripcion.estado_inscripcion)) {
        throw crearError('Esta inscripción ya está cancelada.', 409);
      }
      if (estadoKey(inscripcion.estado_inscripcion) === 'finalizado' || estadoKey(inscripcion.estado_taller) === 'finalizado') {
        throw crearError('No se puede cancelar una inscripción de un taller finalizado.', 400);
      }

      await client.query(
        `UPDATE Inscripcion SET estado = 'Cancelado' WHERE id_inscripcion = $1`,
        [idInscripcion]
      );
      await client.query('COMMIT');
      return { ok: true };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) { /* transacción ya cerrada */ }
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new InscripcionDAO();
