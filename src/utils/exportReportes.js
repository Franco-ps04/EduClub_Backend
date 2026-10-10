const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const COLUMNAS_TALLERES = [
  { header: 'Taller', key: 'nombre', width: 30 },
  { header: 'Área', key: 'area', width: 16 },
  { header: 'Fecha', key: 'fecha', width: 12 },
  { header: 'Docente', key: 'docente', width: 22 },
  { header: 'Capacidad', key: 'capacidad', width: 12 },
  { header: 'Inscritos', key: 'inscritos', width: 12 },
  { header: 'Asistieron', key: 'asistieron', width: 12 },
  { header: 'No asistieron', key: 'noAsistieron', width: 14 },
  { header: 'Estado', key: 'estado', width: 12 }
];

const COLUMNAS_ALUMNOS = [
  { header: 'Alumno', key: 'nombres', width: 30 },
  { header: 'Sesiones asistidas', key: 'talleres', width: 20 }
];

function headerVerde(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D9E5F' } };
}

/** Excel con 3 hojas: Resumen, Talleres (asistencia real) y Top alumnos. */
async function generarExcelReportes({ resumen, talleres, alumnos }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EduTaller';
  workbook.created = new Date();

  const hojaResumen = workbook.addWorksheet('Resumen');
  hojaResumen.columns = [
    { header: 'Indicador', key: 'k', width: 28 },
    { header: 'Valor', key: 'v', width: 16 }
  ];
  headerVerde(hojaResumen.getRow(1));
  hojaResumen.addRow({ k: 'Total de talleres', v: resumen.totalTalleres });
  hojaResumen.addRow({ k: 'Total de inscritos', v: resumen.totalInscritos });
  hojaResumen.addRow({ k: '% de asistencia', v: `${resumen.pctAsistencia}%` });
  hojaResumen.addRow({ k: 'Generado el', v: new Date().toLocaleString('es-PE') });

  const hojaTalleres = workbook.addWorksheet('Talleres');
  hojaTalleres.columns = COLUMNAS_TALLERES;
  headerVerde(hojaTalleres.getRow(1));
  talleres.forEach((t) => hojaTalleres.addRow({
    nombre: t.nombre, area: t.area, fecha: t.fecha, docente: t.docente,
    capacidad: t.capacidad, inscritos: t.inscritos,
    asistieron: t.asistieron, noAsistieron: t.noAsistieron, estado: t.estado
  }));
  hojaTalleres.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + COLUMNAS_TALLERES.length)}1` };

  const hojaAlumnos = workbook.addWorksheet('Top alumnos');
  hojaAlumnos.columns = COLUMNAS_ALUMNOS;
  headerVerde(hojaAlumnos.getRow(1));
  alumnos.forEach((a) => hojaAlumnos.addRow({ nombres: a.nombres, talleres: a.talleres }));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function generarPdfReportes({ resumen, talleres, alumnos }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).fillColor('#2D9E5F').text('EduTaller — Reporte general', { align: 'left' });
    doc.fontSize(9).fillColor('#666666').text(`Generado el ${new Date().toLocaleString('es-PE')}`);
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#222222').text(
      `Total de talleres: ${resumen.totalTalleres}    |    Total de inscritos: ${resumen.totalInscritos}    |    % de asistencia: ${resumen.pctAsistencia}%`
    );
    doc.moveDown(1);

    const cols = [
      { label: 'Taller', width: 150 },
      { label: 'Área', width: 80 },
      { label: 'Fecha', width: 65 },
      { label: 'Docente', width: 110 },
      { label: 'Cap.', width: 40 },
      { label: 'Inscr.', width: 45 },
      { label: 'Asist.', width: 45 },
      { label: 'No asist.', width: 55 },
      { label: 'Estado', width: 70 }
    ];

    let y = doc.y;
    const startX = doc.x;
    const rowHeight = 20;
    const anchoTotal = cols.reduce((s, c) => s + c.width, 0);

    function drawHeader(texto) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text(texto, startX, y);
      y = doc.y + 4;
    }

    function drawTableHeader() {
      let x = startX;
      doc.rect(startX, y, anchoTotal, rowHeight).fill('#2D9E5F');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      cols.forEach((c) => {
        doc.text(c.label, x + 3, y + 6, { width: c.width - 6, ellipsis: true });
        x += c.width;
      });
      y += rowHeight;
    }

    function drawRow(row, index) {
      let x = startX;
      if (index % 2 === 0) doc.rect(startX, y, anchoTotal, rowHeight).fill('#F3F7F4');
      doc.font('Helvetica').fontSize(8).fillColor('#222222');
      const values = [
        row.nombre, row.area, row.fecha, row.docente,
        String(row.capacidad ?? ''), String(row.inscritos ?? ''),
        String(row.asistieron ?? ''), String(row.noAsistieron ?? ''), row.estado
      ];
      values.forEach((val, i) => {
        doc.text(String(val ?? ''), x + 3, y + 6, { width: cols[i].width - 6, ellipsis: true });
        x += cols[i].width;
      });
      y += rowHeight;
    }

    function checkPageBreak(reHeader) {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = doc.y;
        reHeader();
      }
    }

    drawTableHeader();
    talleres.forEach((t, i) => {
      checkPageBreak(drawTableHeader);
      drawRow(t, i);
    });

    doc.addPage();
    y = doc.y;
    drawHeader('Top alumnos (sesiones asistidas)');
    let x = startX;
    doc.rect(startX, y, 300, rowHeight).fill('#2D9E5F');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    doc.text('Alumno', x + 4, y + 6, { width: 220 });
    doc.text('Sesiones', x + 224, y + 6, { width: 76 });
    y += rowHeight;

    alumnos.forEach((a, i) => {
      if (i % 2 === 0) doc.rect(startX, y, 300, rowHeight).fill('#F3F7F4');
      doc.font('Helvetica').fontSize(9).fillColor('#222222');
      doc.text(a.nombres, startX + 4, y + 6, { width: 220, ellipsis: true });
      doc.text(String(a.talleres ?? 0), startX + 224, y + 6, { width: 76 });
      y += rowHeight;
    });

    doc.end();
  });
}

module.exports = { generarExcelReportes, generarPdfReportes };
