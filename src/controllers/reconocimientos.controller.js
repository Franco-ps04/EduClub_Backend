const reconocimientoDAO = require('../dao/ReconocimientoDAO');
const { crearUrlFirmadaReconocimiento } = require('../config/supabaseStorage');

async function misReconocimientos(req, res) {
  try {
    const data = await reconocimientoDAO.misReconocimientos(req.usuario.id);
    const conArchivos = await Promise.all(data.map(async (reconocimiento) => {
      if (!reconocimiento.archivo_url) {
        return { ...reconocimiento, archivo_descarga_url: null };
      }

      // Los reconocimientos normalmente se muestran como insignias; si existe
      // un archivo adjunto, intentamos firmarlo sin hacer fallar toda la lista.
      let archivoDescarga = null;
      try {
        archivoDescarga = await crearUrlFirmadaReconocimiento(reconocimiento.archivo_url, { download: true });
      } catch (error) {
        console.warn('No se pudo firmar un archivo de reconocimiento:', error.message);
      }

      // Compatibilidad con URLs externas públicas ya guardadas.
      if (!archivoDescarga && /^https?:\/\//i.test(String(reconocimiento.archivo_url))) {
        archivoDescarga = reconocimiento.archivo_url;
      }

      return { ...reconocimiento, archivo_descarga_url: archivoDescarga };
    }));

    res.json(conArchivos);
  } catch (err) {
    console.error('No se pudieron consultar los reconocimientos del alumno:', err.message);
    res.status(500).json({ message: 'No se pudieron cargar tus reconocimientos.' });
  }
}

module.exports = { misReconocimientos };
