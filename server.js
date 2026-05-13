require('dotenv').config();
const express   = require('express');
const { Resend } = require('resend');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Безопасность: HTTP-заголовки ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
}));

// ── Ограничение размера тела запроса (10 KB) ──────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Rate limiting: не более 5 заявок с одного IP за 10 минут ─────────────────
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Слишком много запросов. Попробуйте позже.' },
});

// ── Главная страница ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index_real.html'));
});

// ── Статика: только нужные директории и файлы ────────────────────────────────
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get('/robots.txt',  (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(__dirname, 'sitemap.xml')));

// ── Форма заявки ──────────────────────────────────────────────────────────────
app.post('/api/submit', submitLimiter, async (req, res) => {
  console.log('[submit]', new Date().toISOString(), req.body);
  const { goal, area, when, phone, name, website } = req.body || {};

  // Honeypot
  if (website) {
    console.log('[honeypot] бот отклонён');
    return res.json({ ok: true });
  }

  // Валидация телефона
  const phoneClean = (phone || '').replace(/\D/g, '');
  if (!phoneClean || phoneClean.length < 10 || phoneClean.length > 11) {
    return res.json({ ok: false, error: 'Укажите корректный номер телефона' });
  }

  const GOAL_LABELS = { hydro: 'Гидроизоляция', plaster: 'Декоративная штукатурка', both: 'Под ключ (гидро + декор)' };
  const AREA_LABELS = { s: 'До 15 м²', m: '15–40 м²', l: '40–80 м²', xl: '80+ м²' };
  const WHEN_LABELS = { now: 'Прямо сейчас', month: 'В этом месяце', later: 'Через 1–3 мес.', idea: 'Просто узнаю' };

  const safeName = (name || '').slice(0, 100).replace(/[<>]/g, '');

  const subject = `Новая заявка с сайта — ${phoneClean}`;
  const text = [
    `Новая заявка с лендинга ДОН ГИДРО ДЕКОР`,
    ``,
    `Имя:           ${safeName || '—'}`,
    `Телефон:       ${phoneClean}`,
    `Услуга:        ${GOAL_LABELS[goal] || '—'}`,
    `Площадь:       ${AREA_LABELS[area] || '—'}`,
    `Когда начать:  ${WHEN_LABELS[when] || '—'}`,
  ].join('\n');

  try {
    await sendEmail({ subject, text });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

// ── Отправка письма ───────────────────────────────────────────────────────────
async function sendEmail({ subject, text }) {
  const apiKey = process.env.SMTP_PASS || process.env.RESEND_API_KEY;

  // Resend API (HTTPS, порт 443 — никогда не блокируется)
  if (apiKey && apiKey.startsWith('re_')) {
    const resend = new Resend(apiKey);
    const from   = process.env.SMTP_FROM || 'onboarding@resend.dev';
    const to     = process.env.MANAGER_EMAIL;

    console.log('[mailer] Resend API → отправляем на', to);
    const { data, error } = await resend.emails.send({ from, to, subject, text });
    if (error) throw new Error(error.message);
    console.log('📧 Email sent via Resend API:', data.id);
    return;
  }

  // Fallback: Ethereal для локальной разработки без ключа
  const nodemailer = require('nodemailer');
  const testAccount = await nodemailer.createTestAccount();
  console.log('⚠️  RESEND_API_KEY не задан — используем Ethereal (тест)');
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  const info = await transporter.sendMail({
    from: `"ДОН ГИДРО ДЕКОР" <noreply@dgd61.ru>`,
    to: process.env.MANAGER_EMAIL,
    subject,
    text,
  });
  console.log('📧 Ethereal preview:', nodemailer.getTestMessageUrl(info));
}

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`\n✅ Dev server running at http://localhost:${PORT}`);
  console.log('   Press Ctrl+C to stop\n');
});
