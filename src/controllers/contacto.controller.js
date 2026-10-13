const nodemailer = require('nodemailer');

const normalizar = (valor) => String(valor ?? '').trim();
const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

exports.enviar = async (req, res) => {
  const nombre = normalizar(req.body?.nombre);
  const telefono = normalizar(req.body?.telefono);
  const email = normalizar(req.body?.email);
  const asunto = normalizar(req.body?.asunto);
  const mensaje = normalizar(req.body?.mensaje);

  if (nombre.length < 3 || nombre.length > 120) return res.status(400).json({ message: 'El nombre debe tener entre 3 y 120 caracteres.' });
  if (!/^\d{9}$/.test(telefono)) return res.status(400).json({ message: 'El teléfono debe tener 9 dígitos.' });
  if (!emailValido(email) || email.length > 254) return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
  if (!asunto || asunto.length > 120) return res.status(400).json({ message: 'Selecciona un asunto válido.' });
  if (mensaje.length < 10 || mensaje.length > 700) return res.status(400).json({ message: 'El mensaje debe tener entre 10 y 700 caracteres.' });

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, CONTACT_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !CONTACT_EMAIL) {
    return res.status(503).json({ message: 'El envío de correo no está configurado en el servidor. Contacta al administrador.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: String(SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    await transporter.sendMail({
      from: { name: 'EduTaller - Contacto', address: SMTP_USER },
      to: CONTACT_EMAIL,
      replyTo: { name: nombre, address: email },
      subject: `[EduTaller] ${asunto}`,
      text: `Mensaje enviado desde el formulario de contacto de EduTaller.\n\nNombre: ${nombre}\nTeléfono: ${telefono}\nCorreo: ${email}\nAsunto: ${asunto}\n\nMensaje:\n${mensaje}`
    });
    return res.status(200).json({ ok: true, message: 'Correo enviado correctamente.' });
  } catch (error) {
    console.error('Error enviando contacto por correo:', error.message);
    return res.status(502).json({ message: 'No se pudo enviar el correo. Inténtalo más tarde.' });
  }
};
