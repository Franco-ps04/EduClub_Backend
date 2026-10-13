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
