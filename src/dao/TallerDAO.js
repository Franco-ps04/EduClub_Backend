const { query } = require('../config/db');
const BaseDAO = require('./BaseDAO');

// inscritos se calcula en vivo desde Inscripcion (no se confia en la
// columna Taller.inscritos para lectura, igual que hacia EventoDAO en
// GreenUnity) para evitar que quede desincronizada.
const SELECT_TALLER_BASE = `
  SELECT
    t.id_taller, t.nombre, t.descripcion,
    TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
    TO_CHAR(t.hora, 'HH24:MI') AS hora,
    t.ubicacion, t.capacidad,
    COALESCE((
      SELECT COUNT(*)::int FROM Inscripcion i
      WHERE i.id_taller = t.id_taller AND i.estado <> 'Anulado'
    ), 0) AS inscritos,
    t.modalidad, t.estado, t.archivado,
    t.latitud, t.longitud, t.institucion, t.imagen_url,
    t.id_area, ta.nombre AS area,
    t.id_tipo, te.nombre AS tipo_evento,
    t.id_docente, u.nombres AS docente, u.id_usuario AS id_usuario_docente,
    d.institucion AS docente_institucion,
    (SELECT COUNT(*)::int FROM Sesion s WHERE s.id_taller = t.id_taller) AS total_sesiones,
    COALESCE((
      SELECT ARRAY_AGG(x.dia_semana ORDER BY x.primera_fecha)
      FROM (
        SELECT s.dia_semana, MIN(s.fecha) AS primera_fecha
        FROM Sesion s
        WHERE s.id_taller = t.id_taller
        GROUP BY s.dia_semana
      ) x
    ), ARRAY[]::varchar[]) AS dias_semana,
    COALESCE((
      SELECT TO_CHAR(MAX(s.hora_fin), 'HH24:MI')
      FROM Sesion s
      WHERE s.id_taller = t.id_taller
    ), TO_CHAR(t.hora, 'HH24:MI')) AS hora_fin,
    CASE
      WHEN t.estado IN ('Finalizado', 'Cancelado') THEN t.estado
      WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' < (
        SELECT MIN(s.fecha + s.hora_inicio)
        FROM Sesion s WHERE s.id_taller = t.id_taller
      ) THEN 'Proximo'
      WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' <= (
        SELECT MAX(s.fecha + s.hora_fin)
        FROM Sesion s WHERE s.id_taller = t.id_taller
      ) THEN 'En curso'
      ELSE 'Finalizado'
    END AS estado_actual
  FROM Taller t
  INNER JOIN TipoArea ta ON ta.id_area = t.id_area
  INNER JOIN TipoEvento te ON te.id_tipo = t.id_tipo
  INNER JOIN Docente d ON d.id_docente = t.id_docente
  INNER JOIN Usuario u ON u.id_usuario = d.id_usuario
`;

class TallerDAO extends BaseDAO {
  constructor() {
    super('Taller', 'id_taller');
  }

  async findByIdCompleto(idTaller) {
    const { rows } = await query(`${SELECT_TALLER_BASE} WHERE t.id_taller = $1`, [idTaller]);
    const row = rows[0] || null;
    if (row) row.estado = row.estado_actual || row.estado;
    return row;
  }

  async estadoActual(idTaller) {
    const { rows } = await query(
      `SELECT CASE
         WHEN t.estado IN ('Finalizado', 'Cancelado') THEN t.estado
         WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' < (
           SELECT MIN(s.fecha + s.hora_inicio) FROM Sesion s WHERE s.id_taller = t.id_taller
         ) THEN 'Proximo'
         WHEN CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' <= (
           SELECT MAX(s.fecha + s.hora_fin) FROM Sesion s WHERE s.id_taller = t.id_taller
         ) THEN 'En curso'
         ELSE 'Finalizado'
       END AS estado_actual
       FROM Taller t WHERE t.id_taller = $1`,
      [idTaller]
    );
    return rows[0]?.estado_actual || null;
  }

  /**
   * Listado de la seccion "Talleres".
   * El administrador ve todos; el docente puede recibir idDocente para ver
   * solo los talleres que creo.
   */
  async listar({ buscar, idArea, idTipo, idDocente } = {}) {
    const condiciones = ['t.archivado = false'];
    const params = [];

    if (buscar) {
      params.push(`%${buscar}%`);
      condiciones.push(`(t.nombre ILIKE $${params.length} OR te.nombre ILIKE $${params.length})`);
    }
    if (idArea) {
      params.push(idArea);
      condiciones.push(`t.id_area = $${params.length}`);
    }
    if (idTipo) {
      params.push(idTipo);
      condiciones.push(`t.id_tipo = $${params.length}`);
    }
    if (idDocente !== undefined && idDocente !== null) {
      params.push(idDocente);
      condiciones.push(`t.id_docente = $${params.length}`);
    }

    const { rows } = await query(
      `${SELECT_TALLER_BASE}
       WHERE ${condiciones.join(' AND ')}
       ORDER BY t.fecha DESC, t.hora DESC, t.id_taller DESC`,
      params
    );
    return rows.map(row => ({ ...row, estado: row.estado_actual || row.estado }));
  }

  /** Catalogo publico (para la seccion Eventos del alumno). */
  async listarPublico({ buscar, idArea, modalidad } = {}) {
    const condiciones = [
      't.archivado = false',
      `t.estado NOT IN ('Finalizado', 'Cancelado')`,
      `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') <= (SELECT MAX(s.fecha + s.hora_fin) FROM Sesion s WHERE s.id_taller = t.id_taller)`
    ];
    const params = [];

    if (buscar) {
      params.push(`%${buscar}%`);
      condiciones.push(`(t.nombre ILIKE $${params.length} OR t.ubicacion ILIKE $${params.length})`);
    }
    if (idArea) {
      params.push(idArea);
      condiciones.push(`t.id_area = $${params.length}`);
    }
    if (modalidad) {
      params.push(modalidad);
      condiciones.push(`t.modalidad = $${params.length}`);
    }

    const { rows } = await query(
      `${SELECT_TALLER_BASE}
       WHERE ${condiciones.join(' AND ')}
       ORDER BY t.fecha ASC, t.hora ASC`,
      params
    );
    return rows.map(row => ({ ...row, estado: row.estado_actual || row.estado }));
  }

  /** "Mis talleres": solo los del docente en sesion. */
  async listarPorDocente(idDocente) {
    const { rows } = await query(
      `${SELECT_TALLER_BASE}
       WHERE t.archivado = false AND t.id_docente = $1
       ORDER BY t.fecha DESC, t.hora DESC`,
      [idDocente]
    );
    return rows.map(row => ({ ...row, estado: row.estado_actual || row.estado }));
  }

  async findRequisitos(idTaller) {
    const { rows } = await query(
      `SELECT descripcion FROM TallerRequisito
       WHERE id_taller = $1 ORDER BY orden ASC, id_requisito ASC`,
      [idTaller]
    );
    return rows.map(r => r.descripcion);
  }

  async findRequisitosPorTalleres(idTalleres) {
    const mapa = new Map();
    if (!idTalleres || idTalleres.length === 0) return mapa;

    const { rows } = await query(
      `SELECT id_taller, descripcion FROM TallerRequisito
       WHERE id_taller = ANY($1::int[])
       ORDER BY id_taller ASC, orden ASC, id_requisito ASC`,
      [idTalleres]
    );
    for (const row of rows) {
      const lista = mapa.get(row.id_taller) ?? [];
      lista.push(row.descripcion);
      mapa.set(row.id_taller, lista);
    }
    return mapa;
  }

  async insertarRequisito(idTaller, descripcion, orden) {
    await query(
      'INSERT INTO TallerRequisito (id_taller, descripcion, orden) VALUES ($1, $2, $3)',
      [idTaller, descripcion, orden]
    );
  }

  async eliminarRequisitos(idTaller) {
    await query('DELETE FROM TallerRequisito WHERE id_taller = $1', [idTaller]);
  }

  async crear(datos) {
    const {
      nombre, descripcion, fecha, hora, ubicacion, capacidad, modalidad,
      idArea, idTipo, idDocente, institucion, latitud, longitud, imagenUrl
    } = datos;

    const { rows } = await query(
      `INSERT INTO Taller (
         nombre, descripcion, fecha, hora, ubicacion, capacidad, modalidad,
         estado, archivado, latitud, longitud, institucion, imagen_url,
         id_area, id_tipo, id_docente
       )
       VALUES ($1,$2,$3,$4::time,$5,$6,$7,'Proximo',false,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id_taller`,
      [nombre, descripcion, fecha, hora, ubicacion, capacidad, modalidad,
        latitud, longitud, institucion, imagenUrl, idArea, idTipo, idDocente]
    );
    return rows[0].id_taller;
  }

  async actualizar(idTaller, datos) {
    const {
      nombre, descripcion, fecha, hora, ubicacion, capacidad, modalidad,
      idArea, idTipo, idDocente, institucion, latitud, longitud, imagenUrl
    } = datos;

    // imagenUrl puede venir undefined si no se cambio la imagen: en ese caso
    // se conserva la que ya existia con COALESCE.
    await query(
      `UPDATE Taller
       SET nombre = $1, descripcion = $2, fecha = $3, hora = $4::time,
           ubicacion = $5, capacidad = $6, modalidad = $7,
           latitud = $8, longitud = $9, institucion = $10,
           imagen_url = COALESCE($11, imagen_url),
           id_area = $12, id_tipo = $13, id_docente = $14
       WHERE id_taller = $15`,
      [nombre, descripcion, fecha, hora, ubicacion, capacidad, modalidad,
        latitud, longitud, institucion, imagenUrl ?? null, idArea, idTipo, idDocente, idTaller]
    );
  }

  async actualizarEstado(idTaller, estado) {
    await query('UPDATE Taller SET estado = $1 WHERE id_taller = $2', [estado, idTaller]);
  }

  // "Eliminar" en la UI = archivar (borrado logico, nunca fisico).
  async archivar(idTaller) {
    await query('UPDATE Taller SET archivado = true WHERE id_taller = $1', [idTaller]);
  }

  /**
   * Estadisticas de un taller para la tarjeta de "Mis talleres":
   * asistencias (marcas de presente), sesiones con asistencia ya registrada
   * sobre el total, y % promedio de asistencia.
   */
  async estadisticasPorTaller(idTaller) {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM Sesion s WHERE s.id_taller = $1) AS total_sesiones,
         (SELECT COUNT(DISTINCT a.id_sesion)::int
            FROM Asistencia a INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            WHERE s.id_taller = $1) AS sesiones_con_registro,
         (SELECT COUNT(*)::int
            FROM Asistencia a INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            WHERE s.id_taller = $1 AND a.asistio = true) AS total_asistencias,
         (SELECT COUNT(*)::int
            FROM Asistencia a INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            WHERE s.id_taller = $1) AS total_marcas
      `,
      [idTaller]
    );
    const r = rows[0];
    const promedio = r.total_marcas > 0 ? Math.round((r.total_asistencias / r.total_marcas) * 100) : 0;
    return { ...r, promedio_asistencia: promedio };
  }

  /** Estadisticas agregadas para el encabezado de "Mis talleres". */
  async estadisticasDocente(idDocente) {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(DISTINCT i.id_alumno)::int
            FROM Inscripcion i INNER JOIN Taller t ON t.id_taller = i.id_taller
            WHERE t.id_docente = $1 AND i.estado <> 'Anulado') AS alumnos_inscritos,
         (SELECT COUNT(DISTINCT a.id_sesion)::int
            FROM Asistencia a
            INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            INNER JOIN Taller t ON t.id_taller = s.id_taller
            WHERE t.id_docente = $1) AS sesiones_realizadas,
         (SELECT COUNT(*)::int
            FROM Asistencia a
            INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            INNER JOIN Taller t ON t.id_taller = s.id_taller
            WHERE t.id_docente = $1 AND a.asistio = true) AS total_asistencias,
         (SELECT COUNT(*)::int
            FROM Asistencia a
            INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            INNER JOIN Taller t ON t.id_taller = s.id_taller
            WHERE t.id_docente = $1) AS total_marcas
      `,
      [idDocente]
    );
    const r = rows[0];
    const promedio = r.total_marcas > 0 ? Math.round((r.total_asistencias / r.total_marcas) * 100) : 0;
    return {
      alumnosInscritos: r.alumnos_inscritos,
      sesionesRealizadas: r.sesiones_realizadas,
      promedioAsistencia: promedio
    };
  }

  /** Estadisticas agregadas para el encabezado de "Mis talleres" (administrador: todos los talleres). */
  async estadisticasGlobalDocentes() {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(DISTINCT i.id_alumno)::int
            FROM Inscripcion i INNER JOIN Taller t ON t.id_taller = i.id_taller
            WHERE t.archivado = false AND i.estado <> 'Anulado') AS alumnos_inscritos,
         (SELECT COUNT(DISTINCT a.id_sesion)::int
            FROM Asistencia a
            INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            INNER JOIN Taller t ON t.id_taller = s.id_taller
            WHERE t.archivado = false) AS sesiones_realizadas,
         (SELECT COUNT(*)::int
            FROM Asistencia a
            INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            INNER JOIN Taller t ON t.id_taller = s.id_taller
            WHERE t.archivado = false AND a.asistio = true) AS total_asistencias,
         (SELECT COUNT(*)::int
            FROM Asistencia a
            INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
            INNER JOIN Taller t ON t.id_taller = s.id_taller
            WHERE t.archivado = false) AS total_marcas
      `
    );
    const r = rows[0];
    const promedio = r.total_marcas > 0 ? Math.round((r.total_asistencias / r.total_marcas) * 100) : 0;
    return {
      alumnosInscritos: r.alumnos_inscritos,
      sesionesRealizadas: r.sesiones_realizadas,
      promedioAsistencia: promedio
    };
  }

  /** Estadisticas para las tarjetas y graficos de la pestana "Estadísticas". */
  async estadisticas() {
    const totales = await query(
      `SELECT
         COUNT(*)::int AS total_talleres,
         COUNT(*) FILTER (WHERE estado IN ('Proximo','Próximo'))::int AS proximos,
         COUNT(*) FILTER (WHERE estado = 'En curso')::int AS activos
       FROM Taller WHERE archivado = false`
    );

    const inscritos = await query(
      `SELECT COUNT(*)::int AS total_inscritos
       FROM Inscripcion i
       INNER JOIN Taller t ON t.id_taller = i.id_taller
       WHERE t.archivado = false AND i.estado <> 'Anulado'`
    );

    // Alumnos por area: alumnos distintos inscritos en talleres de cada area.
    const alumnosPorTipo = await query(
      `SELECT ta.nombre AS area, COUNT(DISTINCT i.id_alumno)::int AS total
       FROM TipoArea ta
       LEFT JOIN Taller t ON t.id_area = ta.id_area AND t.archivado = false
       LEFT JOIN Inscripcion i ON i.id_taller = t.id_taller AND i.estado <> 'Anulado'
       GROUP BY ta.nombre
       ORDER BY total DESC, ta.nombre ASC`
    );

    // Talleres por area: cantidad de talleres registrados en cada area.
    const tallerPorTipo = await query(
      `SELECT ta.nombre AS area, COUNT(t.id_taller)::int AS total
       FROM TipoArea ta
       LEFT JOIN Taller t ON t.id_area = ta.id_area AND t.archivado = false
       GROUP BY ta.nombre
       ORDER BY total DESC, ta.nombre ASC`
    );

    return {
      totalTalleres: totales.rows[0].total_talleres,
      proximos: totales.rows[0].proximos,
      activos: totales.rows[0].activos,
      totalInscritos: inscritos.rows[0].total_inscritos,
      alumnosPorTipo: alumnosPorTipo.rows,
      tallerPorTipo: tallerPorTipo.rows
    };
  }
}

module.exports = new TallerDAO();
