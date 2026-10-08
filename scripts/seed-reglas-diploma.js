// ============================================================
// Inserta los 4 niveles de constancia por defecto (si la tabla esta vacia).
// La BD no trae estos datos precargados a proposito (ver nota en el .sql),
// asi que se siembran aqui con los valores acordados en el diseño:
//   Excelencia 95-100% / Aprobacion 50-94% / Participacion 10-49% /
//   Sin constancia 0-9%
// ============================================================
require('dotenv').config();
const { Client } = require('pg');

const NIVELES = [
  {
    nombre_nivel: 'Diploma de excelencia',
    porcentaje_minimo: 95,
    porcentaje_maximo: 100,
    descripcion: 'Asistencia perfecta o casi perfecta. Máximo 1 falta.',
    color: 'warning',
    icono: 'bi-award-fill'
  },
  {
    nombre_nivel: 'Diploma de aprobación',
    porcentaje_minimo: 50,
    porcentaje_maximo: 94,
    descripcion: 'Participación regular. Máximo 3 faltas.',
    color: 'success',
    icono: 'bi-patch-check-fill'
  },
  {
    nombre_nivel: 'Diploma de participación',
    porcentaje_minimo: 10,
    porcentaje_maximo: 49,
    descripcion: 'Participación parcial. Solo reconocimiento de asistencia.',
    color: 'primary',
    icono: 'bi-shield-fill-check'
  },
  {
    nombre_nivel: 'Sin constancia',
    porcentaje_minimo: 0,
    porcentaje_maximo: 9,
    descripcion: 'Asistencia insuficiente. No se emite ningún documento.',
    color: 'secondary',
    icono: 'bi-file-earmark-excel'
  }
];

async function main() {
  const useSSL = process.env.DB_SSL !== 'false';
  const client = process.env.DATABASE_URL
    ? new Client({ connectionString: process.env.DATABASE_URL, ssl: useSSL ? { rejectUnauthorized: false } : false })
    : new Client({
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || 'edutallerdb',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: useSSL ? { rejectUnauthorized: false } : false
      });

  await client.connect();

  const { rows } = await client.query('SELECT COUNT(*)::int AS total FROM ReglaDiploma');
  if (rows[0].total > 0) {
    console.log('ReglaDiploma ya tiene datos, no se vuelve a sembrar.');
    await client.end();
    return;
  }

  for (const nivel of NIVELES) {
    await client.query(
      `INSERT INTO ReglaDiploma
         (nombre_nivel, porcentaje_minimo, porcentaje_maximo, descripcion, activo, color, icono)
       VALUES ($1,$2,$3,$4,true,$5,$6)`,
      [nivel.nombre_nivel, nivel.porcentaje_minimo, nivel.porcentaje_maximo, nivel.descripcion, nivel.color, nivel.icono]
    );
  }

  console.log(`✅ ${NIVELES.length} niveles de constancia creados.`);
  await client.end();
}

main().catch((err) => {
  console.error('Error sembrando ReglaDiploma:', err.message);
  process.exit(1);
});
