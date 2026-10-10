const { query } = require('../config/db');

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function nombreDia(fecha) {
  // fecha: Date o 'YYYY-MM-DD'
  const d = fecha instanceof Date ? fecha : new Date(`${fecha}T00:00:00`);
  return DIAS_SEMANA[d.getDay()];
}

/** Siguiente fecha (incluyendo la propia fechaBase) cuyo dia de semana sea diaObjetivo. */
function siguienteFechaConDia(fechaBase, diaObjetivo) {
  const idxObjetivo = DIAS_SEMANA.indexOf(diaObjetivo);
  const base = new Date(`${fechaBase}T00:00:00`);
  const diff = (idxObjetivo - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + diff);
  return base.toISOString().slice(0, 10);
}

function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor((total % (24 * 60)) / 60).toString().padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function sumarDias(fechaIso, dias) {
  const d = new Date(`${fechaIso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const TOTAL_SESIONES_TIPO_SESION = 6;

class SesionDAO {
  async listarPorTaller(idTaller) {
    const { rows } = await query(
      `SELECT id_sesion, id_taller, numero_sesion,
              TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
              TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio,
              TO_CHAR(hora_fin, 'HH24:MI') AS hora_fin,
              dia_semana, titulo
       FROM Sesion
       WHERE id_taller = $1
       ORDER BY numero_sesion ASC`,
      [idTaller]
    );
    return rows;
  }

  async contarPorTaller(idTaller) {
    const { rows } = await query('SELECT COUNT(*)::int AS total FROM Sesion WHERE id_taller = $1', [idTaller]);
    return rows[0].total;
  }

  async tieneAsistenciasRegistradas(idTaller) {
    const { rows } = await query(
      `SELECT EXISTS (
         SELECT 1 FROM Asistencia a
         INNER JOIN Sesion s ON s.id_sesion = a.id_sesion
         WHERE s.id_taller = $1
       ) AS existe`,
      [idTaller]
    );
    return rows[0].existe;
  }

  async eliminarPorTaller(idTaller) {
    await query('DELETE FROM Sesion WHERE id_taller = $1', [idTaller]);
  }

  /**
   * Genera las sesiones de un taller:
   * - 'Seminario' -> 1 sola sesion, en la fecha/hora del taller.
   * - 'Sesión'    -> SIEMPRE 6 sesiones en total. El docente elige 1 a 3
   *                  dias de la semana en los que dicta el taller; esos
   *                  dias se repiten semana a semana (en orden
   *                  cronologico) hasta completar las 6 sesiones. Ej.: si
   *                  elige Lunes y Miercoles, seran 3 semanas (2x3=6); si
   *                  elige solo Lunes, seran 6 semanas seguidas.
   *                  Cada sesion dura 1h30 (segun el diseño).
   */
  async generarParaTaller({ idTaller, esSeminario, fechaTaller, horaTaller, dias }) {
    const horaFin = sumarMinutos(horaTaller, 90);

    if (esSeminario) {
      await query(
        `INSERT INTO Sesion (id_taller, numero_sesion, fecha, hora_inicio, hora_fin, dia_semana)
         VALUES ($1,1,$2,$3::time,$4::time,$5)`,
        [idTaller, fechaTaller, horaTaller, horaFin, nombreDia(fechaTaller)]
      );
      return;
    }

    // Primera ocurrencia (>= fecha del taller) de cada dia elegido.
    const basesPorDia = dias.map(dia => siguienteFechaConDia(fechaTaller, dia));

    // Se generan ciclos semanales (sumando 7*n dias a cada base) hasta
    // tener candidatos suficientes para cubrir las 6 sesiones.
    const ciclosNecesarios = Math.ceil(TOTAL_SESIONES_TIPO_SESION / dias.length);
    const candidatos = [];
    for (let ciclo = 0; ciclo < ciclosNecesarios; ciclo++) {
      for (let i = 0; i < dias.length; i++) {
        const fecha = sumarDias(basesPorDia[i], ciclo * 7);
        candidatos.push({ fecha, dia: dias[i] });
      }
    }

    // Orden cronologico y recorte a las primeras 6.
    candidatos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const sesiones = candidatos.slice(0, TOTAL_SESIONES_TIPO_SESION);

    for (let i = 0; i < sesiones.length; i++) {
      await query(
        `INSERT INTO Sesion (id_taller, numero_sesion, fecha, hora_inicio, hora_fin, dia_semana)
         VALUES ($1,$2,$3,$4::time,$5::time,$6)`,
        [idTaller, i + 1, sesiones[i].fecha, horaTaller, horaFin, sesiones[i].dia]
      );
    }
  }
}

module.exports = new SesionDAO();
module.exports.DIAS_SEMANA = DIAS_SEMANA;
