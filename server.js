require('dotenv').config();
const express  = require('express');
const nodemailer = require('nodemailer');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve index_real.html for the root URL — must be before static middleware
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index_real.html'));
});

app.use(express.static(path.join(__dirname)));

// Form submission handler
app.post('/api/submit', async (req, res) => {
  console.log('[submit]', new Date().toISOString(), req.body);
  const { goal, area, when, phone, name } = req.body || {};

  if (!phone) return res.json({ ok: false, error: 'phone required' });

  const GOAL_LABELS = { hydro: 'Гидроизоляция', plaster: 'Декоративная штукатурка', both: 'Под ключ (гидро + декор)' };
  const AREA_LABELS = { s: 'До 15 м²', m: '15–40 м²', l: '40–80 м²', xl: '80+ м²' };
  const WHEN_LABELS = { now: 'Прямо сейчас', month: 'В этом месяце', later: 'Через 1–3 мес.', idea: 'Просто узнаю' };

  const subject = `Новая заявка с сайта — ${phone}`;
  const text = [
    `Новая заявка с лендинга Мастерская Стен`,
    ``,
    `Имя:           ${name  || '—'}`,
    `Телефон:       ${phone}`,
    `Услуга:        ${GOAL_LABELS[goal] || goal || '—'}`,
    `Площадь:       ${AREA_LABELS[area] || area || '—'}`,
    `Когда начать:  ${WHEN_LABELS[when] || when || '—'}`,
  ].join('\n');

  try {
    const transporter = await getTransporter();
    console.log('[mailer] transporter ready, sending to', process.env.MANAGER_EMAIL || 'manager@masterskaya-sten.ru');
    const info = await transporter.sendMail({
      from: `"Мастерская Стен (сайт)" <${process.env.SMTP_USER || 'noreply@masterskaya-sten.ru'}>`,
      to:   process.env.MANAGER_EMAIL || 'manager@masterskaya-sten.ru',
      subject,
      text,
    });

    // Ethereal gives a preview URL for local testing
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('📧 Email preview:', preview);
    else         console.log('📧 Email sent:', info.messageId);

    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

async function getTransporter() {
  // If real SMTP is configured — use it
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Otherwise fall back to Ethereal (free test SMTP, logs preview URL)
  const testAccount = await nodemailer.createTestAccount();
  console.log('⚠️  No SMTP configured — using Ethereal test account. Check .env.example to set up real email.');
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

app.listen(PORT, () => {
  console.log(`\n✅ Dev server running at http://localhost:${PORT}`);
  console.log('   Press Ctrl+C to stop\n');
});
