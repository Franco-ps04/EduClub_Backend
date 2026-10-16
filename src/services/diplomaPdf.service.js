const PDFDocument = require('pdfkit');

function textoAjustado(doc, texto, fuente, tamano, minimo, x, y, ancho, opciones = {}) {
  doc.font(fuente);
  let actual = tamano;
  doc.fontSize(actual);
  while (actual > minimo && doc.widthOfString(texto) > ancho) {
    actual -= 1;
    doc.fontSize(actual);
  }
  doc.text(texto, x, y, { ...opciones, width: ancho, lineBreak: false });
}

function dibujarLogotipo(doc, centroX, y) {
  const verde = '#198754';
  const dorado = '#c58b13';
  const x = centroX - 24;

  doc.circle(centroX, y + 21, 25).fill('#f0fdf4');
  doc.save();
  doc.fillColor(verde);
  doc.moveTo(x, y + 17)
    .lineTo(centroX, y + 7)
    .lineTo(centroX + 24, y + 17)
    .lineTo(centroX, y + 27)
    .closePath()
    .fill();
  doc.moveTo(centroX - 15, y + 21)
    .lineTo(centroX - 15, y + 29)
    .quadraticCurveTo(centroX, y + 39, centroX + 15, y + 29)
    .lineTo(centroX + 15, y + 21)
    .lineTo(centroX, y + 28)
    .closePath()
    .fill();
  doc.strokeColor(dorado).lineWidth(1.5);
  doc.moveTo(centroX + 23, y + 17).lineTo(centroX + 23, y + 30).stroke();
  doc.circle(centroX + 23, y + 32, 2).fill(dorado);
  doc.restore();
}

function generarDiplomaPdf({ nombreAlumno, nombreTaller, nombreDocente, tipoDiploma, tipoActividad, fechaEmision }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 48,
      info: {
        Title: `${tipoDiploma} - ${nombreTaller}`,
        Author: 'EduTaller',
        Subject: `Diploma otorgado a ${nombreAlumno}`
      }
    });
    const chunks = [];
    const ancho = doc.page.width;
    const alto = doc.page.height;
    const anchoTexto = ancho - 112;

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.lineWidth(2).strokeColor('#c99b3b').roundedRect(28, 28, ancho - 56, alto - 56, 8).stroke();
    doc.lineWidth(0.7).strokeColor('#dfc681').roundedRect(36, 36, ancho - 72, alto - 72, 5).stroke();

    dibujarLogotipo(doc, ancho / 2, 55);
    doc.font('Helvetica-Bold').fontSize(17).fillColor('#198754');
    doc.text('EduTaller', 56, 111, { width: anchoTexto, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(28).fillColor('#24352c');
    doc.text(tipoDiploma.toLocaleUpperCase('es-PE'), 56, 160, { width: anchoTexto, align: 'center' });
    doc.font('Helvetica').fontSize(13).fillColor('#64748b');
    doc.text('Otorgado a:', 56, 222, { width: anchoTexto, align: 'center' });

    doc.fillColor('#1f2937');
    textoAjustado(doc, nombreAlumno, 'Times-Bold', 30, 18, 56, 247, anchoTexto, { align: 'center' });
    doc.moveTo(ancho / 2 - 145, 291).lineTo(ancho / 2 + 145, 291)
      .lineWidth(1).strokeColor('#d8c27e').stroke();

    doc.font('Helvetica').fontSize(14).fillColor('#475569');
    doc.text('Por su destacada participación y cumplimiento de metas', 56, 313, {
      width: anchoTexto,
      align: 'center'
    });
    doc.text(`en el ${tipoActividad} de:`, 56, 334, { width: anchoTexto, align: 'center' });
    doc.fillColor('#198754');
    textoAjustado(doc, nombreTaller, 'Helvetica-Bold', 20, 14, 56, 360, anchoTexto, { align: 'center' });

    const fecha = new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(`${fechaEmision}T12:00:00Z`));

    const lineaY = 457;
    doc.moveTo(105, lineaY).lineTo(340, lineaY).lineWidth(0.8).strokeColor('#94a3b8').stroke();
    doc.moveTo(500, lineaY).lineTo(ancho - 105, lineaY).stroke();
    doc.fillColor('#334155');
    textoAjustado(doc, nombreDocente, 'Helvetica-Bold', 10, 8, 105, lineaY + 8, 235, { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text('Otorgado por · Docente responsable', 105, lineaY + 23, { width: 235, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155');
    doc.text(fecha, 500, lineaY + 8, { width: ancho - 605, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text('Fecha de emisión', 500, lineaY + 23, { width: ancho - 605, align: 'center' });

    doc.end();
  });
}

module.exports = { generarDiplomaPdf };
