const { query } = require('../config/db');

const IDENTIFICADORES_PERMITIDOS = new Set([
  'id_diploma', 'id_alumno', 'id_estudiante', 'id_usuario', 'id_regla_diploma',
  'id_regla', 'id_taller', 'nombre_nivel', 'nombre_nivel_snapshot', 'nivel_nombre',
  'nivel', 'descripcion', 'descripcion_snapshot', 'descripcion_nivel', 'color',
  'color_snapshot', 'icono', 'icono_snapshot', 'porcentaje_obtenido', 'fecha_emision',
  'archivo_url'
]);

function columnaExistente(columnas, opciones) {
  return opciones.find((nombre) => columnas.has(nombre)) || null;
}
function identificador(nombre) {
  if (!IDENTIFICADORES_PERMITIDOS.has(nombre)) throw new Error('Nombre de columna no permitido');
  return `d."${nombre}"`;
}
function expresionSnapshot(columnas, opciones, aliasRegla, columnaRegla, alias) {
  const candidatas = opciones.filter((nombre) => columnas.has(nombre)).map(identificador);
  if (aliasRegla && columnaRegla) candidatas.push(`${aliasRegla}."${columnaRegla}"`);
  if (!candidatas.length) return `NULL AS "${alias}"`;
  return `${candidatas.length > 1 ? `COALESCE(${candidatas.join(', ')})` : candidatas[0]} AS "${alias}"`;
}

/**
 * Acceso compatible con las variantes de nombres de columnas de snapshot que
 * se han usado en el modelo Diploma. Solo se generan identificadores a partir
 * de una lista blanca y de columnas verificadas en information_schema.
 */
class DiplomaDAO {
  async datosParaGenerar(idAlumno, idTaller) {
    const { rows } = await query(
      `SELECT
         i.id_inscripcion,
         i.id_alumno,
         t.id_taller,
         t.nombre AS taller,
         te.nombre AS tipo_evento,
         alumno.nombres AS nombre_alumno,
         docente.nombres AS nombre_docente,
         t.estado AS estado_taller,
         estadisticas.total_sesiones,
         estadisticas.asistencias_registradas,
         estadisticas.asistencias_correctas,
         TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS fecha_emision
       FROM Inscripcion i
       INNER JOIN Taller t ON t.id_taller = i.id_taller
       INNER JOIN TipoEvento te ON te.id_tipo = t.id_tipo
       INNER JOIN Usuario alumno ON alumno.id_usuario = i.id_alumno
       INNER JOIN Docente dc ON dc.id_docente = t.id_docente
       INNER JOIN Usuario docente ON docente.id_usuario = dc.id_usuario
       LEFT JOIN LATERAL (
         SELECT
           COUNT(s.id_sesion)::int AS total_sesiones,
           COUNT(a.id_asistencia)::int AS asistencias_registradas,
           COUNT(a.id_asistencia) FILTER (WHERE a.asistio = TRUE)::int AS asistencias_correctas
         FROM Sesion s
         LEFT JOIN Asistencia a
           ON a.id_sesion = s.id_sesion AND a.id_inscripcion = i.id_inscripcion
         WHERE s.id_taller = t.id_taller
       ) estadisticas ON TRUE
       WHERE i.id_alumno = $1
         AND i.id_taller = $2
         AND i.estado NOT IN ('Anulado', 'Cancelado')
       LIMIT 1`,
      [idAlumno, idTaller]
    );
    return rows[0] || null;
  }

  async misDiplomas(idAlumno) {
    const { rows: metadata } = await query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'diploma'`,
      []
    );
    const columnas = new Set(metadata.map((r) => r.column_name));
    if (!columnas.size) throw new Error('No existe la tabla Diploma en la base de datos.');

    const fkAlumno = columnaExistente(columnas, ['id_alumno', 'id_estudiante', 'id_usuario']);
    if (!columnas.has('id_diploma') || !fkAlumno) {
      throw new Error('La tabla Diploma no contiene los identificadores esperados para consultar los diplomas del alumno.');
    }

    const fkRegla = columnaExistente(columnas, ['id_regla_diploma', 'id_regla']);
    const tieneTaller = columnas.has('id_taller');
    const tieneArchivo = columnas.has('archivo_url');
    const tienePorcentaje = columnas.has('porcentaje_obtenido');
    const tieneFecha = columnas.has('fecha_emision');
    const joinRegla = fkRegla ? `LEFT JOIN ReglaDiploma r ON r.id_regla_diploma = d."${fkRegla}"` : '';
    const joinTaller = tieneTaller ? 'LEFT JOIN Taller t ON t.id_taller = d."id_taller"' : '';
    const selectTaller = tieneTaller ? 'd."id_taller" AS id_taller, t.nombre AS taller' : 'NULL AS id_taller, NULL AS taller';
    const selectRegla = fkRegla ? `d."${fkRegla}" AS id_regla_diploma` : 'NULL AS id_regla_diploma';
    const selectPorcentaje = tienePorcentaje ? 'd."porcentaje_obtenido" AS porcentaje_obtenido' : 'NULL AS porcentaje_obtenido';
    const selectFecha = tieneFecha ? `TO_CHAR(d."fecha_emision", 'YYYY-MM-DD') AS fecha_emision` : 'NULL AS fecha_emision';
    const selectArchivo = tieneArchivo ? 'd."archivo_url" AS archivo_url' : 'NULL AS archivo_url';

    const sql = `
      SELECT d."id_diploma" AS id_diploma,
             d."${fkAlumno}" AS id_alumno,
             ${selectRegla},
             ${selectTaller},
             ${expresionSnapshot(columnas, ['nombre_nivel', 'nombre_nivel_snapshot', 'nivel_nombre', 'nivel'], fkRegla ? 'r' : null, 'nombre_nivel', 'nombre_nivel')},
             ${expresionSnapshot(columnas, ['descripcion', 'descripcion_snapshot', 'descripcion_nivel'], fkRegla ? 'r' : null, 'descripcion', 'descripcion')},
             ${expresionSnapshot(columnas, ['color', 'color_snapshot'], fkRegla ? 'r' : null, 'color', 'color')},
             ${expresionSnapshot(columnas, ['icono', 'icono_snapshot'], fkRegla ? 'r' : null, 'icono', 'icono')},
             ${selectPorcentaje}, ${selectFecha}, ${selectArchivo}
      FROM Diploma d
      ${joinRegla}
      ${joinTaller}
      WHERE d."${fkAlumno}" = $1
      ORDER BY ${tieneFecha ? 'd."fecha_emision" DESC NULLS LAST,' : ''} d."id_diploma" DESC`;

    const result = await query(sql, [idAlumno]);
    return result.rows;
  }
}

module.exports = new DiplomaDAO();
