require('dotenv').config();
const express     = require('express');
const nodemailer  = require('nodemailer');
const path        = require('path');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Безопасность: HTTP-заголовки ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // отключаем CSP — inline-скрипты в HTML
}));

// ── Ограничение размера тела запроса (10 KB) ──────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Rate limiting для /api/ : не более 5 заявок с одного IP за 10 минут ───────
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
// Раздаём только assets/, robots.txt и sitemap.xml — остальное закрыто
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get('/robots.txt',  (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(__dirname, 'sitemap.xml')));

// ── Форма заявки ──────────────────────────────────────────────────────────────
app.post('/api/submit', submitLimiter, async (req, res) => {
  console.log('[submit]', new Date().toISOString(), req.body);
  const { goal, area, when, phone, name, website } = req.body || {};

  // Honeypot: боты заполняют скрытое поле — отклоняем тихо
  if (website) {
    console.log('[honeypot] бот отклонён');
    return res.json({ ok: true }); // притворяемся что всё ок
  }

  // Валидация телефона: только цифры, 10–11 знаков
  const phoneClean = (phone || '').replace(/\D/g, '');
  if (!phoneClean || phoneClean.length < 10 || phoneClean.length > 11) {
    return res.json({ ok: false, error: 'Укажите корректный номер телефона' });
  }

  // Валидация остальных полей: только допустимые значения
  const GOAL_LABELS = { hydro: 'Гидроизоляция', plaster: 'Декоративная штукатурка', both: 'Под ключ (гидро + декор)' };
  const AREA_LABELS = { s: 'До 15 м²', m: '15–40 м²', l: '40–80 м²', xl: '80+ м²' };
  const WHEN_LABELS = { now: 'Прямо сейчас', month: 'В этом месяце', later: 'Через 1–3 мес.', idea: 'Просто узнаю' };

  // Имя: обрезаем до 100 символов, убираем HTML
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
    const transporter = await getTransporter();
    console.log('[mailer] transporter ready, sending to', process.env.MANAGER_EMAIL);
    const info = await transporter.sendMail({
      from: `"ДОН ГИДРО ДЕКОР (сайт)" <${process.env.SMTP_USER || 'noreply@dgd61.ru'}>`,
      to:   process.env.MANAGER_EMAIL,
      subject,
      text,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('📧 Email preview:', preview);
    else         console.log('📧 Email sent:', info.messageId);

    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

// ── SMTP транспорт ────────────────────────────────────────────────────────────
async function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  const testAccount = await nodemailer.createTestAccount();
  console.log('⚠️  No SMTP configured — using Ethereal test account.');
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

// ── 404 для всего остального ──────────────────────────────────────────────────
app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`\n✅ Dev server running at http://localhost:${PORT}`);
  console.log('   Press Ctrl+C to stop\n');
});
