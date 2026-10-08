const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const cargaAlumnoDAO = require('../dao/CargaAlumnoDAO');
const usuarioDAO = require('../dao/UsuarioDAO');
const { soloDigitos, validarEmail, validarPassword } = require('../utils/validators');

const ENCABEZADOS = ['Nombre', 'Correo electrónico', 'Teléfono', 'Contraseña'];

const ESTADO_DB = {
  VALIDO: 'valido_para_registrar',
  CORREO_EXISTE: 'correo_existente',
  INVALIDO: 'datos_incompletos_o_invalidos',
  DUPLICADO_EXCEL: 'correo_duplicado_excel',
  CREADO: 'creado_exitosamente'
};

const ESTADO_LABEL = {
  [ESTADO_DB.VALIDO]: 'Válido: Listo para crear',
  [ESTADO_DB.CORREO_EXISTE]: 'Correo ya existe en el sistema',
  [ESTADO_DB.INVALIDO]: 'Datos incompletos o inválidos',
  [ESTADO_DB.DUPLICADO_EXCEL]: 'Correo duplicado en el Excel',
  [ESTADO_DB.CREADO]: 'Creado exitosamente'
};

function etiquetaEstado(estado) {
  return ESTADO_LABEL[estado] ?? estado;
}

function normalizarEncabezado(valor) {
  return String(valor ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function validarEncabezados(hoja) {
  const esperados = ENCABEZADOS.map(normalizarEncabezado);
  const actuales = esperados.map((_, i) => normalizarEncabezado(leerCelda(hoja.getRow(1), i + 1)));
  return esperados.every((h, i) => actuales[i] === h);
}

// GET /api/carga-alumnos/plantilla
async function plantilla(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet('Alumnos');
    hoja.addRow(ENCABEZADOS);
    hoja.getRow(1).font = { bold: true };
    hoja.columns = [
      { width: 28 }, { width: 32 }, { width: 16 }, { width: 18 }
    ];
    // Fila de ejemplo, comentada visualmente con texto gris para guiar el llenado.
    const ejemplo = hoja.addRow(['Ana García López', 'a.garcia@colegio.edu.pe', '987654321', 'Alumno2026']);
    ejemplo.font = { color: { argb: 'FF9CA3AF' }, italic: true };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_alumnos.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

function leerCelda(row, index) {
  const cell = row.getCell(index);
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value) return String(value.result).trim();
  return String(value).trim();
}

// POST /api/carga-alumnos/validar  (multipart, campo "archivo")
async function validar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Sube un archivo Excel (.xlsx).' });
    const extension = String(req.file.originalname ?? '').toLowerCase().split('.').pop();
    if (extension !== 'xlsx') return res.status(400).json({ message: 'El archivo debe estar en formato .xlsx. Descarga y usa la plantilla proporcionada.' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const hoja = workbook.worksheets[0];
    if (!hoja) return res.status(400).json({ message: 'El archivo no tiene hojas con datos.' });
    if (!validarEncabezados(hoja)) {
      return res.status(400).json({ message: 'Los encabezados deben ser: Nombre, Correo electrónico, Teléfono y Contraseña.' });
    }

    const idCarga = await cargaAlumnoDAO.crear(req.file.originalname);

    const filas = [];
    const correosEnArchivo = new Set();

    for (let i = 2; i <= hoja.rowCount; i++) { // fila 1 = encabezados
      const row = hoja.getRow(i);
      const nombre = leerCelda(row, 1);
      const correo = leerCelda(row, 2).toLowerCase();
      const telefono = soloDigitos(leerCelda(row, 3));
      const contrasena = leerCelda(row, 4);

      // Fila completamente vacía: se ignora (no cuenta como registro).
      if (!nombre && !correo && !telefono && !contrasena) continue;

      let estado;
      if (nombre.length < 3 || !validarEmail(correo) || telefono.length !== 9 || !validarPassword(contrasena)) {
        estado = ESTADO_DB.INVALIDO;
      } else if (correosEnArchivo.has(correo)) {
        estado = ESTADO_DB.DUPLICADO_EXCEL;
      } else {
        const existe = await usuarioDAO.findByEmail(correo);
        estado = existe ? ESTADO_DB.CORREO_EXISTE : ESTADO_DB.VALIDO;
      }
      if (validarEmail(correo)) correosEnArchivo.add(correo);

      const idDetalle = await cargaAlumnoDAO.insertarDetalle({
        idCarga, nombre, correo, telefono, contrasena, estado
      });

      filas.push({ id_detalle: idDetalle, nombre, correo, telefono, estado: etiquetaEstado(estado) });
    }

    await cargaAlumnoDAO.actualizarEstado(idCarga, 'pendiente');

    res.json({ idCarga, filas, validos: filas.filter(f => f.estado === etiquetaEstado(ESTADO_DB.VALIDO)).length });
  } catch (err) {
    console.error('Error validando carga de alumnos:', err);
    res.status(500).json({ message: 'No se pudo leer el archivo. Verifica que respete el formato de la plantilla.' });
  }
}

// POST /api/carga-alumnos/:idCarga/registrar
async function registrar(req, res) {
  try {
    const idCarga = Number(req.params.idCarga);
    const carga = await cargaAlumnoDAO.findCarga(idCarga);
    if (!carga) return res.status(404).json({ message: 'Carga no encontrada' });

    const pendientes = await cargaAlumnoDAO.listarDetallePendientes(idCarga);

    for (const fila of pendientes) {
      try {
        const yaExiste = await usuarioDAO.findByEmail(fila.correo);
        if (yaExiste) {
          await cargaAlumnoDAO.marcarError(fila.id_detalle, ESTADO_DB.CORREO_EXISTE);
          continue;
        }
        const hash = await bcrypt.hash(fila.contrasena, 10);
        const idUsuario = await usuarioDAO.crearUsuario({
          nombres: fila.nombre, email: fila.correo, hash, telefono: fila.telefono, rol: 'alumno'
        });
        await usuarioDAO.crearAlumno(idUsuario);
        await cargaAlumnoDAO.marcarCreado(fila.id_detalle, idUsuario);
      } catch {
        await cargaAlumnoDAO.marcarError(fila.id_detalle, ESTADO_DB.INVALIDO);
      }
    }

    await cargaAlumnoDAO.actualizarEstado(idCarga, 'procesado');

    const filas = (await cargaAlumnoDAO.listarDetalle(idCarga)).map(f => ({ ...f, estado: etiquetaEstado(f.estado) }));
    res.json({ filas });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { plantilla, validar, registrar };
