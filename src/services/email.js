const nodemailer = require('nodemailer');

const tieneCredenciales = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

console.log(`[Mailer] Modo: ${tieneCredenciales ? 'REAL (Gmail 465)' : 'SIMULADO (consola)'}`);

let transporter = null;
if (tieneCredenciales) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function enviarCorreo(to, asunto, html) {
  if (!transporter) {
    console.log(`\n[Correo simulado] Para ${to} | ${asunto}\n${html}\n`);
    return;
  }
  await transporter.sendMail({
    from: `"Soporte EduTaller" <${process.env.SMTP_USER}>`,
    to,
    subject: asunto,
    html
  });
}

module.exports = { enviarCorreo };