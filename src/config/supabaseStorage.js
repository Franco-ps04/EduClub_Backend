const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const BUCKET_TALLERES = process.env.SUPABASE_BUCKET_TALLERES || 'talleres';
const BUCKET_RECURSOS = process.env.SUPABASE_BUCKET_RECURSOS || 'recursos';
const BUCKET_DIPLOMAS = process.env.SUPABASE_BUCKET_DIPLOMAS || 'diplomas';
const BUCKET_RECONOCIMIENTOS = process.env.SUPABASE_BUCKET_RECONOCIMIENTOS || 'reconocimientos';
const URL_FIRMADA_EXPIRACION = Number(process.env.SUPABASE_STORAGE_SIGNED_URL_SECONDS || 3600);

let clienteSupabase = null;

function getClienteSupabase() {
  if (clienteSupabase) return clienteSupabase;

  const url = process.env.SUPABASE_URL;
  // La service_role key es necesaria para subir archivos desde el backend
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno'
    );
  }

  clienteSupabase = createClient(url, key);
  return clienteSupabase;
}

async function subirArchivo(bucket, prefijo, buffer, originalName, mimetype) {
  const supabase = getClienteSupabase();
  const ext = path.extname(originalName || '').toLowerCase() || '';
  const nombreArchivo = `${prefijo}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(nombreArchivo, buffer, {
      contentType: mimetype || 'application/octet-stream',
      upsert: false
    });

  if (error) {
    throw new Error(`No se pudo subir el archivo a Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(nombreArchivo);
  return data.publicUrl;
}

/**
 * Sube la imagen de un taller (recibida en memoria via multer) y devuelve
 * su URL publica.
 */
function subirImagenTaller(buffer, originalName, mimetype) {
  return subirArchivo(BUCKET_TALLERES, 'taller', buffer, originalName, mimetype);
}

/**
 * Sube un recurso (documento/pdf/imagen) de una sesion y devuelve su URL
 * publica (se mantiene por compatibilidad con los registros existentes).
 */
function subirRecurso(buffer, originalName, mimetype) {
  return subirArchivo(BUCKET_RECURSOS, 'recurso', buffer, originalName, mimetype);
}

/**
 * Extrae la ruta del objeto a partir de una URL de Supabase Storage guardada
 * previamente en la BD. Esto permite regenerar URLs de acceso aunque el
 * bucket sea privado o una URL publica antigua haya quedado guardada.
 */
function extraerRutaObjeto(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!texto) return null;

  // Permite almacenar directamente una ruta (ej. recurso_123.pdf).
  if (!/^https?:\/\//i.test(texto)) return texto.replace(/^\/+/, '');

  try {
    const url = new URL(texto);
    const partes = url.pathname.split('/').filter(Boolean);
    const indiceObject = partes.indexOf('object');
    if (indiceObject === -1) return null;

    // /storage/v1/object/public/<bucket>/<path>
    // /storage/v1/object/sign/<bucket>/<path>
    // /storage/v1/object/authenticated/<bucket>/<path>
    const modo = partes[indiceObject + 1];
    if (!['public', 'sign', 'authenticated'].includes(modo)) return null;

    const inicioRuta = indiceObject + 3;
    if (partes.length <= inicioRuta) return null;
    return partes.slice(inicioRuta).map((parte) => decodeURIComponent(parte)).join('/');
  } catch (_) {
    return null;
  }
}

/**
 * Genera una URL firmada desde el bucket real configurado en el servidor.
 * Así la app no depende de que el navegador pueda acceder directamente a
 * una URL pública guardada en la BD.
 */
async function crearUrlFirmada(bucket, archivoUrl, { download = false } = {}) {
  const ruta = extraerRutaObjeto(archivoUrl);
  if (!ruta) return null;

  const supabase = getClienteSupabase();
  const options = download ? { download: true } : undefined;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(ruta, URL_FIRMADA_EXPIRACION, options);

  if (error) {
    throw new Error(`No se pudo generar la URL de acceso al archivo en Supabase Storage: ${error.message}`);
  }

  return data?.signedUrl || null;
}

async function crearUrlFirmadaRecurso(archivoUrl, opciones = {}) {
  return crearUrlFirmada(BUCKET_RECURSOS, archivoUrl, opciones);
}

async function crearUrlFirmadaTaller(archivoUrl, opciones = {}) {
  return crearUrlFirmada(BUCKET_TALLERES, archivoUrl, opciones);
}

function extraerBucketObjeto(valor) {
  if (!valor || !/^https?:\/\//i.test(String(valor).trim())) return null;
  try {
    const partes = new URL(String(valor).trim()).pathname.split('/').filter(Boolean);
    const indiceObject = partes.indexOf('object');
    if (indiceObject === -1) return null;
    const modo = partes[indiceObject + 1];
    if (!['public', 'sign', 'authenticated'].includes(modo)) return null;
    return partes[indiceObject + 2] || null;
  } catch (_) {
    return null;
  }
}

/** Firma archivos de diplomas, respetando el bucket de una URL antigua si lo contiene. */
async function crearUrlFirmadaDiploma(archivoUrl, opciones = {}) {
  const bucketOrigen = extraerBucketObjeto(archivoUrl) || BUCKET_DIPLOMAS;
  return crearUrlFirmada(bucketOrigen, archivoUrl, opciones);
}

/** Firma archivos adjuntos a reconocimientos. Si la BD guarda una URL de Supabase,
 * respeta el bucket de origen; si guarda una ruta, usa el bucket de reconocimientos. */
async function crearUrlFirmadaReconocimiento(archivoUrl, opciones = {}) {
  const bucketOrigen = extraerBucketObjeto(archivoUrl) || BUCKET_RECONOCIMIENTOS;
  return crearUrlFirmada(bucketOrigen, archivoUrl, opciones);
}

module.exports = {
  subirImagenTaller,
  subirRecurso,
  crearUrlFirmadaRecurso,
  crearUrlFirmadaTaller,
  crearUrlFirmadaDiploma,
  crearUrlFirmadaReconocimiento,
  extraerRutaObjeto,
  BUCKET_TALLERES,
  BUCKET_RECURSOS,
  BUCKET_DIPLOMAS,
  BUCKET_RECONOCIMIENTOS
};
