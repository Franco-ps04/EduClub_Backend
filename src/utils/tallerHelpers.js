const MODALIDADES_VALIDAS = ['Presencial', 'Virtual'];
const DIAS_VALIDOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function parseDias(raw) {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr.filter(d => DIAS_VALIDOS.includes(d)) : [];
  } catch {
    return [];
  }
}

function validarDatosTaller(body) {
  const errores = [];

  const nombre = String(body.nombre ?? '').trim();
  const descripcion = String(body.descripcion ?? '').trim();
  const fecha = String(body.fecha ?? '').trim();
  const hora = String(body.hora ?? '').trim();
  let ubicacion = String(body.ubicacion ?? '').trim();
  const institucion = String(body.institucion ?? '').trim();
  const modalidad = String(body.modalidad ?? '').trim();
  const capacidad = Number(body.capacidad);
  const idArea = Number(body.idArea);
  const idTipo = Number(body.idTipo);
  const latitud = body.latitud !== undefined && body.latitud !== null && body.latitud !== ''
    ? Number(body.latitud) : null;
  const longitud = body.longitud !== undefined && body.longitud !== null && body.longitud !== ''
    ? Number(body.longitud) : null;

  if (nombre.length < 3) errores.push('El título del taller debe tener al menos 3 caracteres.');
  if (descripcion.length < 10) errores.push('La descripción debe tener al menos 10 caracteres.');

  if (!fecha || Number.isNaN(Date.parse(fecha))) {
    errores.push('Ingresa una fecha válida.');
  } else {
    const hoyLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // YYYY-MM-DD
    if (fecha <= hoyLima) {
      errores.push('La fecha debe ser posterior al día de hoy.');
    }
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
    errores.push('Ingresa una hora válida.');
  } else if (hora < '08:00' || hora > '20:00') {
    errores.push('La hora debe estar entre las 08:00 y las 20:00.');
  }

  if (modalidad !== 'Virtual' && ubicacion.length < 3) errores.push('Ingresa la ubicación del taller.');
  if (modalidad === 'Virtual') ubicacion = 'Virtual';
  if (institucion.length < 3) errores.push('Ingresa la institución.');
  if (!MODALIDADES_VALIDAS.includes(modalidad)) errores.push('Selecciona una modalidad válida.');
  if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 30) {
    errores.push('El máximo de alumnos debe ser un número entre 1 y 30.');
  }
  if (!Number.isInteger(idArea)) errores.push('Selecciona el tipo de actividad.');
  if (!Number.isInteger(idTipo)) errores.push('Selecciona el tipo de evento.');
  if (latitud !== null && (Number.isNaN(latitud) || latitud < -90 || latitud > 90)) {
    errores.push('La latitud no es válida.');
  }
  if (longitud !== null && (Number.isNaN(longitud) || longitud < -180 || longitud > 180)) {
    errores.push('La longitud no es válida.');
  }

  // 'dias' solo aplica a talleres tipo Sesión (1 a 3 dias de semana);
  // el controller decide si exigirlo segun el nombre del TipoEvento.
  const dias = parseDias(body.dias);

  return {
    errores,
    datos: {
      nombre, descripcion, fecha, hora, ubicacion, institucion, modalidad,
      capacidad, idArea, idTipo, latitud: modalidad === 'Virtual' ? null : latitud, longitud: modalidad === 'Virtual' ? null : longitud, dias
    }
  };
}

/** "uno por línea" -> array de strings no vacíos */
function parseRequisitos(texto) {
  if (!texto) return [];
  return String(texto)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

module.exports = { validarDatosTaller, parseRequisitos, parseDias, MODALIDADES_VALIDAS, DIAS_VALIDOS };
