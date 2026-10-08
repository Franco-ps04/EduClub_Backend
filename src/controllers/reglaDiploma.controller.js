const reglaDiplomaDAO = require('../dao/ReglaDiplomaDAO');

function validar(body) {
  const errores = [];
  const nombreNivel = String(body.nombreNivel ?? '').trim();
  const descripcion = String(body.descripcion ?? '').trim();
  const color = String(body.color ?? '').trim() || 'success';
  const icono = String(body.icono ?? '').trim() || 'bi-award-fill';
  const porcentajeMinimo = Number(body.porcentajeMinimo);
  const porcentajeMaximo = Number(body.porcentajeMaximo);

  if (nombreNivel.length < 3) errores.push('El nombre del nivel debe tener al menos 3 caracteres.');
  if (Number.isNaN(porcentajeMinimo) || porcentajeMinimo < 0 || porcentajeMinimo > 100) {
    errores.push('El porcentaje mínimo debe estar entre 0 y 100.');
  }
  if (Number.isNaN(porcentajeMaximo) || porcentajeMaximo < 0 || porcentajeMaximo > 100) {
    errores.push('El porcentaje máximo debe estar entre 0 y 100.');
  }
  if (porcentajeMinimo > porcentajeMaximo) {
    errores.push('El porcentaje mínimo no puede ser mayor que el máximo.');
  }

  return { errores, datos: { nombreNivel, porcentajeMinimo, porcentajeMaximo, descripcion, color, icono } };
}

// GET /api/reglas-diploma
async function listar(req, res) {
  try {
    res.json(await reglaDiplomaDAO.listar());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/reglas-diploma/:id
async function actualizar(req, res) {
  try {
    const id = Number(req.params.id);
    const existente = await reglaDiplomaDAO.findById(id);
    if (!existente) return res.status(404).json({ message: 'Nivel no encontrado' });

    const { errores, datos } = validar(req.body);
    if (errores.length) return res.status(400).json({ message: errores[0], errores });

    await reglaDiplomaDAO.actualizar(id, datos);
    res.json(await reglaDiplomaDAO.findById(id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PATCH /api/reglas-diploma/:id/activo
async function actualizarActivo(req, res) {
  try {
    await reglaDiplomaDAO.actualizarActivo(Number(req.params.id), req.body.activo);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { listar, actualizar, actualizarActivo };
