const diplomaDAO = require('../dao/DiplomaDAO');
const { crearUrlFirmadaDiploma } = require('../config/supabaseStorage');
const { generarDiplomaPdf } = require('../services/diplomaPdf.service');

async function misDiplomas(req, res) {
  try {
    const data = await diplomaDAO.misDiplomas(req.usuario.id);
    const conArchivos = await Promise.all(data.map(async (diploma) => ({
      ...diploma,
      archivo_url: diploma.archivo_url ? await crearUrlFirmadaDiploma(diploma.archivo_url) : null,
      archivo_descarga_url: diploma.archivo_url ? await crearUrlFirmadaDiploma(diploma.archivo_url, { download: true }) : null
    })));
    res.json(conArchivos);
  } catch (err) {
    console.error('No se pudieron consultar los diplomas del alumno:', err.message);
    res.status(500).json({ message: 'No se pudieron cargar tus diplomas. Verifica la estructura de la tabla Diploma.' });
  }
}

async function descargarDiploma(req, res) {
  const idTaller = Number(req.params.idTaller);
  if (!Number.isInteger(idTaller) || idTaller < 1) {
    return res.status(400).json({ message: 'El taller indicado no es válido.' });
  }

  try {
    const datos = await diplomaDAO.datosParaGenerar(req.usuario.id, idTaller);
    if (!datos) {
      return res.status(404).json({ message: 'No se encontró una inscripción activa para este taller.' });
    }

    const esSeminario = String(datos.tipo_evento).trim().toLowerCase() === 'seminario';
    const sesionesEsperadas = esSeminario ? 1 : 6;
    if (String(datos.estado_taller).trim().toLowerCase() !== 'finalizado') {
      return res.status(409).json({ message: 'El diploma estará disponible cuando el taller haya finalizado.' });
    }
    if (Number(datos.total_sesiones) !== sesionesEsperadas ||
        Number(datos.asistencias_registradas) !== sesionesEsperadas ||
        Number(datos.asistencias_correctas) !== sesionesEsperadas) {
      return res.status(409).json({
        message: `Se requiere asistencia registrada en todas las sesiones (${sesionesEsperadas}/${sesionesEsperadas}).`
      });
    }
    const pdf = await generarDiplomaPdf({
      nombreAlumno: datos.nombre_alumno,
      nombreTaller: datos.taller,
      nombreDocente: datos.nombre_docente,
      tipoDiploma: 'Diploma de excelencia',
      tipoActividad: esSeminario ? 'seminario' : 'taller',
      fechaEmision: datos.fecha_emision
    });
    const nombreArchivo = `diploma-${idTaller}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdf.length,
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Cache-Control': 'private, no-store'
    });
    return res.send(pdf);
  } catch (err) {
    console.error('No se pudo generar el PDF del diploma:', err.message);
    return res.status(500).json({ message: 'No se pudo generar el diploma. Inténtalo nuevamente.' });
  }
}

module.exports = { misDiplomas, descargarDiploma };
