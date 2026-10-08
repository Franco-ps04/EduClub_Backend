const { query } = require('../config/db');

class AsistenciaDAO {
  /**
   * Resumen por sesion para un taller (pestaña "Resumen" cuando el taller
   * tiene mas de 1 sesion): por cada alumno inscrito, su asistencia en
   * cada sesion (true/false/null = sin registrar) + % total + el nivel de
   * constancia (ReglaDiploma) que le correspondería con ese %.
   */
  async resumenPorTaller(idTaller) {
    const sesiones = await query(
      `SELECT id_sesion, numero_sesion FROM Sesion WHERE id_taller = $1 ORDER BY numero_sesion ASC`,
      [idTaller]
    );
    const totalSesiones = sesiones.rows.length;

    const alumnos = await query(
      `SELECT i.id_inscripcion, u.id_usuario, u.nombres
       FROM Inscripcion i
       INNER JOIN Usuario u ON u.id_usuario = i.id_alumno
       WHERE i.id_taller = $1 AND i.estado <> 'Anulado'
       ORDER BY u.nombres ASC`,
      [idTaller]
    );

    const asistencias = await query(
      `SELECT a.id_inscripcion, s.numero_sesion, a.asistio
       FROM Asistencia a
       INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
       WHERE s.id_taller = $1`,
      [idTaller]
    );

    const reglas = await query(
      `SELECT nombre_nivel, porcentaje_minimo, porcentaje_maximo
       FROM ReglaDiploma WHERE activo = true ORDER BY porcentaje_minimo DESC`
    );

    const mapaAsistencias = new Map(); // id_inscripcion -> { numero_sesion: asistio }
    for (const row of asistencias.rows) {
      const actual = mapaAsistencias.get(row.id_inscripcion) ?? {};
      actual[row.numero_sesion] = row.asistio;
      mapaAsistencias.set(row.id_inscripcion, actual);
    }

    const nivelParaPorcentaje = (pct) => {
      const regla = reglas.rows.find(r => pct >= r.porcentaje_minimo && pct <= r.porcentaje_maximo);
      return regla?.nombre_nivel ?? null;
    };

    return {
      totalSesiones,
      numerosSesion: sesiones.rows.map(s => s.numero_sesion),
      alumnos: alumnos.rows.map(al => {
        const porSesion = mapaAsistencias.get(al.id_inscripcion) ?? {};
        const presentes = Object.values(porSesion).filter(v => v === true).length;
        const porcentaje = totalSesiones > 0 ? Math.round((presentes / totalSesiones) * 100) : 0;
        return {
          id_inscripcion: al.id_inscripcion,
          id_usuario: al.id_usuario,
          nombres: al.nombres,
          sesiones: sesiones.rows.map(s => ({
            numero_sesion: s.numero_sesion,
            asistio: porSesion[s.numero_sesion] ?? null
          })),
          porcentaje,
          constancia: nivelParaPorcentaje(porcentaje)
        };
      })
    };
  }

  /**
   * Lista de alumnos inscritos en el taller de una sesion, con su estado
   * de asistencia EN ESA sesion puntual (para el modal "Registro de
   * asistencia", igual al del proyecto anterior pero acotado a 1 sesion).
   */
  async porSesion(idSesion) {
    const { rows } = await query(
      `SELECT i.id_inscripcion, u.id_usuario, u.nombres, a.asistio
       FROM Sesion s
       INNER JOIN Inscripcion i ON i.id_taller = s.id_taller AND i.estado <> 'Anulado'
       INNER JOIN Usuario u ON u.id_usuario = i.id_alumno
       LEFT JOIN Asistencia a ON a.id_inscripcion = i.id_inscripcion AND a.id_sesion = s.id_sesion
       WHERE s.id_sesion = $1
       ORDER BY u.nombres ASC`,
      [idSesion]
    );
    return rows;
  }

  async findSesionConTaller(idSesion) {
    const { rows } = await query(
      `SELECT s.id_sesion, s.numero_sesion, s.id_taller, t.nombre AS taller_nombre
       FROM Sesion s INNER JOIN Taller t ON t.id_taller = s.id_taller
       WHERE s.id_sesion = $1`,
      [idSesion]
    );
    return rows[0] || null;
  }

  /** Upsert: crea o actualiza la asistencia de un alumno en una sesion. */
  async registrar(idInscripcion, idSesion, asistio) {
    await query(
      `INSERT INTO Asistencia (id_inscripcion, id_sesion, asistio)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_inscripcion, id_sesion)
       DO UPDATE SET asistio = EXCLUDED.asistio, fecha_registro = CURRENT_TIMESTAMP`,
      [idInscripcion, idSesion, asistio]
    );
  }
}

module.exports = new AsistenciaDAO();
