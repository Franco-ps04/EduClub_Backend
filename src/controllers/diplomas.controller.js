const diplomaDAO = require('../dao/DiplomaDAO');
const { crearUrlFirmadaDiploma } = require('../config/supabaseStorage');

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

module.exports = { misDiplomas };
