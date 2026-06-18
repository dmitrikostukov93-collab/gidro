// IndexNow — мгновенный пинг поисковиков (Bing + Яндекс) об обновлении страниц.
// Запуск ПОСЛЕ деплоя с изменённым контентом: node scripts/indexnow.mjs
// Читает sitemap.xml с прода, шлёт все URL одним запросом на api.indexnow.org

const HOST = "dgd61.ru";
const KEY  = "efd1d791143114841130a44b57852bd7";
const SITE_URL     = `https://${HOST}`;
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;

async function main() {
  const res = await fetch(`${SITE_URL}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap недоступен: HTTP ${res.status}`);
  const xml = await res.text();
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  if (urlList.length === 0) throw new Error("в sitemap не нашлось ни одного URL");
  console.log(`Нашёл ${urlList.length} URL в sitemap, отправляю в IndexNow…`);

  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });

  console.log(`Ответ IndexNow: HTTP ${r.status} ${r.statusText}`);
  if (r.status === 200 || r.status === 202) {
    console.log("✓ Отправлено. Поисковики получили список на переобход.");
  } else {
    const text = await r.text().catch(() => "");
    console.log("⚠ Возможна проблема:", text || "(пустой ответ)");
    console.log("Проверь, что файл-ключ доступен:", KEY_LOCATION);
  }
}

main().catch((e) => {
  console.error("Ошибка:", e.message);
  process.exit(1);
});
