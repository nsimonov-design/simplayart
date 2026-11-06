# Сайт sim.play.art — Ольга Симонова

Статический сайт без зависимостей. Тексты и факты — `src/content.py`, вёрстка — `src/build.py`, стили — `src/style.css`.
Готовый сайт — папка `docs/` (её и раздаёт GitHub Pages).

## Пересобрать после правок
```bash
cd site/src && python3 build.py
```

## Посмотреть локально
```bash
python3 -m http.server 8817 --directory site/docs
```
→ http://localhost:8817

## Публикация на GitHub Pages (бесплатно)
1. Создать репозиторий. Варианты адреса:
   - аккаунт GitHub **simplayart** + репозиторий `simplayart.github.io` → сайт `https://simplayart.github.io/` (рекомендуется: имя бренда в адресе);
   - или репозиторий `simplayart` в существующем аккаунте → `https://<аккаунт>.github.io/simplayart/`.
2. Указать итоговый адрес в `src/content.py` → `SITE_URL`, пересобрать.
3. Загрузить содержимое папки `site/` в репозиторий (ветка `main`).
4. Settings → Pages → Source: *Deploy from a branch* → `main` / `/docs`.
5. Свой домен (по желанию, ~300–900 ₽/год за .ru): Settings → Pages → Custom domain, у регистратора — CNAME на `<аккаунт>.github.io`. Затем обновить `SITE_URL`.

## После публикации
- Google Search Console и Яндекс Вебмастер: подтвердить сайт, отправить `sitemap.xml`.
- Bing Webmaster Tools: импорт из Search Console.
- Ссылку на сайт — в био Instagram, Telegram, VK и в профиль на SAMPLE.
