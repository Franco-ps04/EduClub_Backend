const reporteDAO = require('../dao/ReporteDAO');
const { generarExcelReportes, generarPdfReportes } = require('../utils/exportReportes');

async function obtenerDatosReporte() {
  const talleres = await reporteDAO.resumenTalleres();
  const alumnos = await reporteDAO.topAlumnos();

  const totalTalleres = talleres.length;
  const totalInscritos = talleres.reduce((s, t) => s + Number(t.inscritos ?? 0), 0);
  const totalAsistieron = talleres.reduce((s, t) => s + Number(t.asistieron ?? 0), 0);
  const pctAsistencia = totalInscritos > 0 ? Math.round((totalAsistieron / totalInscritos) * 100) : 0;

  return { resumen: { totalTalleres, totalInscritos, pctAsistencia }, talleres, alumnos };
}

// GET /api/reportes/resumen
async function resumen(req, res) {
  try {
    res.json(await obtenerDatosReporte());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/reportes/exportar?formato=xlsx|pdf
async function exportar(req, res) {
  const formato = String(req.query.formato ?? '').toLowerCase();
  if (!['xlsx', 'pdf'].includes(formato)) {
    return res.status(400).json({ message: 'El formato debe ser "xlsx" o "pdf"' });
  }

  try {
    const datos = await obtenerDatosReporte();
    const fecha = new Date().toISOString().slice(0, 10);

    if (formato === 'xlsx') {
      const buffer = await generarExcelReportes(datos);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_${fecha}.xlsx"`);
      return res.send(buffer);
    }

    const buffer = await generarPdfReportes(datos);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${fecha}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { resumen, exportar };
