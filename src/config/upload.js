const multer = require('multer');

const storage = multer.memoryStorage();

const uploadTaller = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Recursos de sesion (pdf/word/imagen), hasta 50MB segun el mockup de Enrollar/Mis talleres
const uploadRecurso = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Excel de carga masiva de alumnos
const uploadExcel = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = { uploadTaller, uploadRecurso, uploadExcel };
