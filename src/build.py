# -*- coding: utf-8 -*-
"""Сборка сайта: python3 site/src/build.py  →  site/docs/ (GitHub Pages: ветка main, папка /docs)"""
import json, os, shutil, html, hashlib
from content import *

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SRC, "..", "docs")
SIZES = json.load(open(os.path.join(SRC, "image_sizes.json")))
e = lambda s: html.escape(str(s), quote=True)
PERSON_ID = SITE_URL + "/#person"
SITEMAP = []  # (path, [images])

def ver(fn):
    return hashlib.md5(open(os.path.join(SRC, fn), "rb").read()).hexdigest()[:8]

# ---------------- helpers ----------------
def size_of(name):
    return SIZES.get(name, [720, 1280])

def img(R, name, alt, cls="", sizes="(min-width:1000px) 33vw, (min-width:620px) 50vw, 100vw", eager=False, collect=None):
    w, h = size_of(name)
    if collect is not None: collect.append((name, alt))
    if name in SIZES:
        sw = 720 if w >= h else round(w * min(1, 1080 / h))
        srcset = f' srcset="{R}img/{name}-720.webp {sw}w, {R}img/{name}.webp {w}w" sizes="{sizes}"'
    else:
        srcset = ""
    load = 'fetchpriority="high"' if eager else 'loading="lazy" decoding="async"'
    c = f' class="{cls}"' if cls else ""
    return f'<img src="{R}img/{name}.webp"{srcset} width="{w}" height="{h}" alt="{e(alt)}" {load}{c}>'

def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"

def person(full=False):
    p = {"@type": "Person", "@id": PERSON_ID, "name": NAME, "alternateName": [NICK, NAME_EN, "SimPlayArt"],
         "givenName": "Ольга", "familyName": "Симонова", "jobTitle": "Художница-керамист",
         "description": BIO_SHORT, "url": SITE_URL + "/", "image": SITE_URL + "/img/olga-simonova-hudozhnitsa-keramist.webp",
         "birthPlace": {"@type": "Place", "name": "Псков, Россия"},
         "homeLocation": {"@type": "Place", "name": "Санкт-Петербург, Россия"},
         "knowsAbout": ["керамика", "художественная керамика", "коллекционный дизайн", "глазури", "ручная лепка", "литьё в гипсовые формы", "ceramic art"],
         "sameAs": [LINKS["instagram"], LINKS["telegram"], LINKS["vk"], LINKS["sample"]],
         "subjectOf": press_schema()}
    if full:
        p["alumniOf"] = [{"@type": "CollegeOrUniversity", "name": "Санкт-Петербургская государственная художественно-промышленная академия имени А. Л. Штиглица"},
                         {"@type": "CollegeOrUniversity", "name": "Санкт-Петербургский государственный университет промышленных технологий и дизайна"}]
        p["award"] = [f"{t} ({y})" for y, t in AWARDS]
        p["memberOf"] = {"@type": "ArtGallery", "name": "SAMPLE", "url": "https://sample-art.com/"}
    return p

def website():
    return {"@type": "WebSite", "@id": SITE_URL + "/#website", "url": SITE_URL + "/", "name": f"{NAME} — художница (sim.play.art)",
            "inLanguage": ["ru", "en"], "publisher": {"@id": PERSON_ID}, "about": {"@id": PERSON_ID}}

def breadcrumbs(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE_URL + "/" + p} for i, (n, p) in enumerate(items)]}

FAV = "data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='7' cy='16' r='5' fill='%233B55C9'/%3E%3Ccircle cx='16' cy='16' r='5' fill='%23E27896'/%3E%3Ccircle cx='25' cy='16' r='5' fill='%23BFD86A'/%3E%3C/svg%3E"

NAV_RU = [("#projects", "Проекты", "projects"), ("#play-video", "Собери · Разбери", "video"), ("about/", "Обо мне", "about"),
          ("about/#cv", "Выставки", "cv"), ("#buy", "Где купить", "buy"), ("play/", "Поиграть", "play")]

def header(R, lang, active):
    if lang == "en":
        nav = f'<a href="{R}en/#about">About</a><a href="{R}en/#play">PLAY</a><a href="{R}en/#cv">Exhibitions</a><a href="{R}en/#contact">Contact</a><a href="{R}play/">Play</a><a class="lang" href="{R}" hreflang="ru" lang="ru">RU</a>'
        home = f"{R}en/"
    else:
        items = []
        for href, label, key in NAV_RU:
            h = (R + href) if not href.startswith("#") else (R + href if R else href)
            cur = ' aria-current="page"' if key == active else ""
            items.append(f'<a href="{h}"{cur}>{label}</a>')
        nav = "".join(items) + f'<a class="lang" href="{R}en/" hreflang="en" lang="en">EN</a>'
        home = R or "./"
    return f'''<a class="skip" href="#main">К содержанию</a>
<header class="site-head"><div class="wrap head-in">
<a class="logo" href="{home}" aria-label="sim.play.art — на главную"><span class="logo-dots"><i></i><i></i><i></i></span>sim.play.art</a>
<button class="burger" aria-label="Меню" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
<nav class="nav" id="nav" aria-label="Основная навигация">{nav}</nav>
</div></header>'''

def footer(R, lang="ru"):
    if lang == "en":
        t1, t2, t3 = "Let’s talk about ceramics", "Studio in Saint Petersburg. Collaborations, exhibitions and purchases — via Telegram or Instagram.", "Projects"
    else:
        t1, t2, t3 = "Давайте поиграем", "Мастерская в Санкт-Петербурге. Покупка работ, выставки и коллаборации — пишите в Telegram или Instagram.", "Проекты"
    proj = "".join(f'<li><a href="{R}works/{s["slug"]}/">{e(s["title"])}</a></li>' for s in SERIES)
    return f'''<footer class="site-foot" id="contact"><div class="wrap">
<div class="foot-grid">
<div><p class="foot-title">{t1}</p><p class="muted" style="max-width:30em">{t2}</p>
<div class="socials"><a class="ig" href="{LINKS["instagram"]}" rel="me noopener" target="_blank">Instagram @sim.play.art</a>
<a href="{LINKS["telegram"]}" rel="me noopener" target="_blank">Telegram @simplayart</a>
<a href="{LINKS["vk"]}" rel="me noopener" target="_blank">ВКонтакте</a>
<a href="{LINKS["sample"]}" rel="noopener" target="_blank">Галерея SAMPLE</a></div></div>
<div class="foot-col"><h4>{t3}</h4><ul>{proj}</ul></div>
<div class="foot-col"><h4>{"Site" if lang=="en" else "Сайт"}</h4><ul>
<li><a href="{R}about/">{"About (RU)" if lang=="en" else "Обо мне и CV"}</a></li>
<li><a href="{R}#play-video">{"Assembly videos" if lang=="en" else "Видео: сборка и разборка"}</a></li>
<li><a href="{R}#faq">{"FAQ (RU)" if lang=="en" else "Вопросы и ответы"}</a></li>
<li><a href="{R}play/">{"3D builder (RU)" if lang=="en" else "Поиграть: 3D-конструктор"}</a></li>
<li><a href="{R}en/">English</a></li></ul></div>
</div>
<div class="copy"><span>© {UPDATED[:4]} {NAME if lang!="en" else NAME_EN} · sim.play.art</span><span>{"Updated" if lang=="en" else "Обновлено"}: {UPDATED}</span></div>
</div></footer>'''

def page(path, title, desc, body, lang="ru", schema=(), active=None, og="og-olga-simonova.jpg", images=(), head_extra="", scripts=""):
    depth = path.count("/")
    R = "../" * depth
    url = SITE_URL + "/" + path
    graph = {"@context": "https://schema.org", "@graph": [website(), *schema]}
    alt_ru, alt_en = SITE_URL + "/", SITE_URL + "/en/"
    hreflang = ""
    if path in ("", "en/"):
        hreflang = f'<link rel="alternate" hreflang="ru" href="{alt_ru}"><link rel="alternate" hreflang="en" href="{alt_en}"><link rel="alternate" hreflang="x-default" href="{alt_ru}">'
    doc = f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
{hreflang}
<meta name="author" content="{NAME}">{verify_tags()}
<meta property="og:type" content="{"profile" if path in ("", "about/", "en/") else "website"}">
<meta property="og:site_name" content="sim.play.art — {NAME}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE_URL}/img/{og}">
<meta property="og:locale" content="{"en_US" if lang=="en" else "ru_RU"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FBF8F5">
<link rel="icon" href="{FAV}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Unbounded:wght@300;400;500&display=swap&subset=cyrillic" rel="stylesheet">
<link rel="stylesheet" href="{R}assets/style.css?v={ver("style.css")}">
{head_extra}{ld(graph)}
</head>
<body>
{header(R, lang, active)}
<main id="main">
{body(R)}
</main>
{footer(R, lang)}
<script src="{R}assets/main.js?v={ver("main.js")}" defer></script>{scripts}
</body>
</html>'''
    d = os.path.join(OUT, path)
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(doc)
    SITEMAP.append((path, list(images)))

def verify_tags():
    t = ""
    if GOOGLE_VERIFY: t += f'\n<meta name="google-site-verification" content="{GOOGLE_VERIFY}">'
    if YANDEX_VERIFY: t += f'\n<meta name="yandex-verification" content="{YANDEX_VERIFY}">'
    return t

# ---------------- blocks ----------------
def video_block(R, heading=True):
    cards = []
    for v in VIDEOS:
        buy = f'<a href="{v["url"]}" target="_blank" rel="noopener">Смотреть в галерее SAMPLE →</a>' if v["url"] else ""
        cards.append(f'''<article class="vcard" style="--c:{v["c"]}">
<div class="vframe"><video muted loop playsinline preload="none" poster="{R}img/{v["id"]}-poster.webp" data-src="{R}video/{v["id"]}-sborka.mp4" aria-label="{e(v["title"])}: сборка и разборка керамического объекта на магнитах"></video>
<span class="vbadge">{e(v["title"])}</span>
<button class="vplay" aria-label="Пауза / воспроизведение"><svg class="i-pause" viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg><svg class="i-play" viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z"/></svg></button></div>
<div class="seg" role="group" aria-label="Режим видео">
<button aria-pressed="true" data-src="{R}video/{v["id"]}-sborka.mp4" data-poster="{R}img/{v["id"]}-poster.webp">Собрать</button>
<button aria-pressed="false" data-src="{R}video/{v["id"]}-razborka.mp4" data-poster="{R}img/{v["id"]}-poster-razborka.webp">Разобрать</button></div>
<div class="vcap"><h3>{e(v["title"])}, {v["year"]}</h3><p>{e(v["mat"])} · {e(v["size"])}</p>{buy}</div>
</article>''')
    trans = "".join(f"<p><b>{e(v['title'])}.</b> {e(v['text'])}</p>" for v in VIDEOS)
    head = '''<div class="section-head reveal"><span class="eyebrow">Видео из мастерской</span>
<h2>Собери · Разбери</h2>
<p class="lead">Пирамиды PLAY ничем не склеены: элементы держатся на магнитах. Ольга собирает и разбирает четыре объекта. На каждой карточке можно переключить режим.</p></div>''' if heading else ""
    return f'''{head}<div class="play-grid">{"".join(cards)}</div>
<details class="transcript"><summary>Что происходит в видео (текстовое описание)</summary>{trans}</details>'''

def iso_dt(d):
    """'2026-11-07' -> '2026-11-07T12:00:00+03:00' (Google просит дату-время с часовым поясом)"""
    return f"{d}T12:00:00+03:00"

def video_schema(R=""):
    out = []
    for v in VIDEOS:
        for mode, word in (("sborka", "сборка"), ("razborka", "разборка")):
            out.append({"@type": "VideoObject", "name": f"{v['title']} — {word} объекта на магнитах · Ольга Симонова",
                        "description": v["text"], "thumbnailUrl": f"{SITE_URL}/img/{v['id']}-poster.webp",
                        "contentUrl": f"{SITE_URL}/video/{v['id']}-{mode}.mp4", "uploadDate": iso_dt(VIDEOS_UPLOADED),
                        "creator": {"@id": PERSON_ID}, "inLanguage": "ru"})
    return out

# ---------------- О ней пишут ----------------
MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def press_date(d, lang="ru"):
    if len(d) < 10: return d
    y, m, dd = d.split("-")
    return f"{int(dd)} {MONTHS[int(m)-1]} {y}" if lang == "ru" else f"{MONTHS_EN[int(m)-1]} {int(dd)}, {y}"

KIND_EN = {"Обзор выставки": "Exhibition review", "Колонка галеристки": "Gallerist's column", "Итоги конкурса": "Competition results",
           "Репортаж": "Report", "О выставке": "Exhibition", "Анонс": "Preview", "Интервью": "Interview"}
OUTLET_EN = {"Сноб": "Snob", "Деловая газета.Юг": "Delovaya Gazeta.Yug", "АртМосковия": "ArtMoskovia", "Собака.ru": "Sobaka.ru",
             "ЦПКиО им. Кирова": "Kirov Central Park"}
outlet_name = lambda p, lang: p["outlet"] if lang == "ru" else OUTLET_EN.get(p["outlet"], p["outlet"])

def press_card(p, lang="ru", wide=True):
    w = " wide" if wide and p.get("wide") else ""
    go = f"Читать на {p['domain']}" if lang == "ru" else f"Read on {p['domain']}"
    prev = p["preview"] if lang == "ru" else ""
    kind = p["kind"] if lang == "ru" else KIND_EN.get(p["kind"], p["kind"])
    return (f'<a class="press-card reveal{w}" href="{p["url"]}" target="_blank" rel="noopener" style="--c:{p["c"]}"' + (' hreflang="ru"' if lang != "ru" else "") + '>'
            f'<span class="press-top"><span class="press-outlet">{e(outlet_name(p, lang))}</span><span class="press-kind">{e(kind)}</span></span>'
            f'<span class="press-title">{e(p["title"])}</span>'
            + (f'<span class="press-prev">{e(prev)}</span>' if prev else "")
            + f'<span class="press-foot"><time datetime="{p["date"]}">{press_date(p["date"], lang)}</time>'
            f'<span class="press-go">{go} <span aria-hidden="true">↗</span></span></span></a>')

def press_section(items, title="О ней пишут", eyebrow="Пресса", lead="", sid="o-ney-pishut", tint="", lang="ru", wide=True):
    outlets = "".join(f'<li style="--c:{p["c"]}">{e(outlet_name(p, lang))}</li>' for p in items)
    lead_html = f'<p class="lead">{lead}</p>' if lead else ""
    grid = "press-grid" + ("" if wide else " even")
    return f'''<section class="section press {tint}" id="{sid}"><div class="wrap">
<div class="press-head"><div><span class="eyebrow">{eyebrow}</span><h2>{title}</h2>{lead_html}</div>
<ul class="press-outlets" aria-label="{"Издания" if lang == "ru" else "Media"}">{outlets}</ul></div>
<div class="{grid}">{"".join(press_card(p, lang, wide) for p in items)}</div></div></section>'''

def press_chips(text):
    """Ссылки на публикации для строки CV: совпадение по ключу из PRESS[...]["ex"]."""
    return "".join(f'<a class="src" href="{p["url"]}" target="_blank" rel="noopener" title="{e(p["title"])}">{e(p["outlet"])} <span aria-hidden="true">↗</span></a>'
                   for p in PRESS if any(k in text for k in p["ex"]))

def press_schema():
    out = []
    for p in PRESS:
        a = {"@type": "Article" if p["id"] in ("designmate", "elagin") else "NewsArticle",
             "headline": p["title"], "url": p["url"], "inLanguage": "ru",
             "publisher": {"@type": "Organization", "name": p["outlet"], "url": f"https://{p['domain']}/"}}
        if len(p["date"]) == 10: a["datePublished"] = iso_dt(p["date"])
        out.append(a)
    return out

def ex_list(items, chips=False):
    li = []
    for y, w, p, award, _ in items:
        a = f'<span class="award">{e(award)}</span>' if award else ""
        c = press_chips(w) if chips else ""
        s = f'<span class="srcs">{c}</span>' if c else ""
        li.append(f'<li><span class="y">{y}</span><span><span class="w">{e(w)}</span>{a}<br><span class="p">{e(p)}</span>{s}</span></li>')
    return '<ul class="ex-list">' + "".join(li) + "</ul>"

def faq_html():
    return "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in FAQ)

def faq_schema():
    return {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}

# ---------------- pages ----------------
def build_index():
    imgs = []
    n_ex = len(EXHIBITIONS)
    def body(R):
        cards = "".join(f'''<a class="card reveal" href="{R}works/{s["slug"]}/" style="--c:{s["c"]}">
<div class="card-img">{img(R, s["cover"], f'{s["title"]} — {s["short"]}', collect=imgs)}</div>
<div class="card-body"><span class="tag">{e(s["tag"])} · {e(s["years"])}</span><h3>{e(s["title"])}</h3><p>{e(s["short"])}</p></div></a>''' for s in SERIES)
        highlights = [x for x in EXHIBITIONS if x[4]]
        igs = "".join(img(R, n, a, sizes="(min-width:900px) 12vw, 30vw", collect=imgs) for n, a in [
            ("play-11-detal", "PLAY 11, деталь"), ("oblako-kapli-ruka", "Облако «Капли»"), ("keramicheskie-shariki-tsvetnye", "Керамические шарики"),
            ("olga-simonova-v-masterskoy", "Ольга Симонова в мастерской"), ("plody-keramika-yabloko", "Керамический плод"), ("oblaka-na-stene-nabor", "Облака на стене")])
        return f'''
<section class="hero"><div class="hero-bg"></div><div class="wrap hero-grid">
<div class="reveal in"><span class="eyebrow">Художница-керамист · Санкт-Петербург</span>
<h1>{NAME}<span class="nick">sim.play.art</span></h1>
<p class="lead">{e(BIO_SHORT)}</p>
<div class="btns"><a class="btn btn-fill" href="#play-video">Смотреть, как собирается PLAY</a><a class="btn btn-ghost" href="{LINKS["instagram"]}" target="_blank" rel="me noopener">Instagram @sim.play.art</a></div></div>
<div class="hero-media">{img(R, "olga-simonova-portret-s-plodom", "Ольга Симонова, художница-керамист sim.play.art, с керамическим плодом на голове", sizes="(min-width:900px) 45vw, 100vw", eager=True, collect=imgs)}
<span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span></div>
</div></section>

<section class="wrap" aria-label="Коротко о художнице"><div class="facts reveal">
<div class="fact"><b>2019</b><span>собственная мастерская и печь в Санкт-Петербурге</span></div>
<div class="fact"><b>2023</b><span>начало проекта PLAY: пирамиды на магнитах</span></div>
<div class="fact"><b>{n_ex}</b><span>выставок и ярмарок с 2022 года, включая Русский музей</span></div>
<div class="fact"><b>1 место</b><span>«Colour Block», галерея Art Brut, Москва, 2023</span></div>
</div></section>

<section class="section" id="method"><div class="wrap">
<span class="eyebrow">Метод</span>
<p class="quote reveal">«Я исследую игру не как тему, <em>а как метод</em>. Игра в моих проектах — это способ по-другому увидеть настоящее»</p>
<ol class="steps">{"".join(f'<li class="reveal"><h3>{e(t)}</h3><p>{e(d)}</p></li>' for t, d in STEPS)}</ol>
</div></section>

<section class="section tint-lilac round-top" id="play-video"><div class="wrap">{video_block(R)}</div></section>

<section class="section" id="projects"><div class="wrap">
<div class="section-head reveal"><span class="eyebrow">Проекты и серии</span><h2>Керамика, в которую можно играть</h2>
<p class="lead">Модульные объекты, коллекционный дизайн и серии, где привычные вещи (воздушный шарик, облако, ёлочная игрушка) получают в глине новую жизнь.</p></div>
<div class="cards">{cards}<a class="card reveal" href="{R}works/shariki/#gallery" style="--c:var(--blush)">
<div class="card-img">{img(R, "rano-ili-pozdno-krasnyy-sharik", "«Рано или поздно» — керамический сдутый шарик, проект в работе", collect=imgs)}</div>
<div class="card-body"><span class="tag">В мастерской · 2026</span><h3>«Рано или поздно»</h3><p>Фотопроект о случайных сдутых находках на улицах и настенные объекты около 80 см. Сейчас в работе.</p></div></a></div></div></section>

<section class="section tint-blush round-top" id="exhibitions"><div class="wrap two wide-l">
<div class="reveal">{ex_list(highlights)}</div>
<div class="reveal"><span class="eyebrow">Выставки</span><h2>Где можно было увидеть работы</h2>
<p class="lead">С 2022 года — {n_ex} выставок и ярмарок в Санкт-Петербурге, Москве, Ростове-на-Дону, Старом Осколе и Китае.</p>
<div class="btns"><a class="btn btn-ghost" href="{R}about/#cv">Полное CV</a></div>
{img(R, "olga-simonova-na-vystavke", "Ольга Симонова на выставке рядом со своими работами", sizes="(min-width:900px) 40vw, 100vw", cls="reveal", collect=imgs).replace('<img', '<img style="border-radius:var(--radius);margin-top:32px;aspect-ratio:4/3;object-fit:cover;width:100%"')}
</div></div></section>

<section class="section" id="instagram"><div class="wrap"><div class="ig-band reveal">
<div><span class="eyebrow">Instagram</span><h2>Мастерская каждый день</h2>
<p class="lead">Новые объекты, процесс, обжиги и глазури, анонсы выставок. Главный дневник sim.play.art.</p>
<div class="btns"><a class="btn btn-fill" href="{LINKS["instagram"]}" target="_blank" rel="me noopener">Подписаться @sim.play.art</a><a class="btn btn-ghost" href="{LINKS["telegram"]}" target="_blank" rel="me noopener">Telegram</a></div></div>
<div class="ig-thumbs">{igs}</div></div></div></section>

<section class="section tint-sky round-top" id="buy"><div class="wrap">
<div class="section-head reveal"><span class="eyebrow">Где купить</span><h2>Забрать домой</h2>
<p class="lead">Объекты PLAY и «Облака» представлены в галерее SAMPLE. Другие работы, заказ и коллаборации — напрямую у художницы.</p></div>
<div class="buy reveal">
<a href="{LINKS["sample"]}" target="_blank" rel="noopener"><b>Галерея SAMPLE</b><span>PLAY 1, PLAY 10, PLAY 12, «Мерцающее облако», «Облака на стене» и другие работы</span><span class="arrow">sample-art.com →</span></a>
<a href="{LINKS["telegram"]}" target="_blank" rel="me noopener"><b>Telegram</b><span>Купить работу напрямую, обсудить заказ или коллаборацию</span><span class="arrow">@simplayart →</span></a>
<a href="{LINKS["vk"]}" target="_blank" rel="me noopener"><b>ВКонтакте</b><span>Сообщество sim.play.art: новости, работы в наличии</span><span class="arrow">vk.ru/simplayart →</span></a>
</div></div></section>

<section class="section" id="faq"><div class="wrap two">
<div class="reveal"><span class="eyebrow">Вопросы и ответы</span><h2>Коротко о главном</h2>
{img(R, "keramicheskie-lestnitsy-serdtse", "Сердце, выложенное из керамических лестниц Ольги Симоновой", sizes="(min-width:900px) 40vw, 100vw", collect=imgs).replace('<img', '<img style="border-radius:var(--radius);margin-top:24px;max-width:420px;width:100%"')}</div>
<div class="faq reveal">{faq_html()}</div></div></section>'''
    schema = [person(), {"@type": "ProfilePage", "@id": SITE_URL + "/#page", "url": SITE_URL + "/", "name": f"{NAME} — художница-керамист",
              "mainEntity": {"@id": PERSON_ID}, "dateModified": iso_dt(UPDATED), "inLanguage": "ru"},
              faq_schema(), *video_schema(),
              {"@type": "ItemList", "name": "Проекты Ольги Симоновой", "itemListElement": [
                  {"@type": "ListItem", "position": i + 1, "url": f"{SITE_URL}/works/{s['slug']}/", "name": s["title"]} for i, s in enumerate(SERIES)]}]
    page("", f"{NAME} (sim.play.art) — художница-керамист, Санкт-Петербург",
         "Ольга Симонова (sim.play.art) — художница-керамист из Санкт-Петербурга. Керамические объекты на магнитах: проект PLAY, «Облака», «А можно забрать его домой?». Видео, выставки, где купить.",
         body, schema=schema, images=imgs)

def build_series(s):
    imgs = []
    path = f"works/{s['slug']}/"
    def body(R):
        facts = "".join(f"<tr><th>{e(k)}</th><td>{e(v)}</td></tr>" for k, v in s["facts"])
        idea = "".join(f"<p>{e(p)}</p>" for p in s["idea"])
        proc = ("<h2 style='margin-top:1.2em'>Процесс</h2>" + "".join(f"<p>{e(p)}</p>" for p in s["process"])) if s["process"] else ""
        works = ""
        if s["works"]:
            w = []
            for name, year, mat, size, im, where, url in s["works"]:
                st = '<span class="status wip">в работе</span>' if where == "wip" else ""
                link = f'<a href="{url}" target="_blank" rel="noopener">Купить в галерее SAMPLE →</a>' if url else ""
                meta = " · ".join(x for x in (year, mat, size) if x)
                w.append(f'<article class="work reveal">{img(R, im, f"{name}, {year}: {mat} — работа Ольги Симоновой", collect=imgs)}<div><h3>{e(name)}</h3><p>{e(meta)}</p>{st}{link}</div></article>')
            works = f'<section class="section" style="padding-top:0"><div class="wrap"><h2>Работы</h2><div class="works">{"".join(w)}</div></div></section>'
        stitle = s["title"]
        gal = "".join(f'<figure class="reveal">{img(R, n, c + " — " + stitle + ", Ольга Симонова (sim.play.art)", collect=imgs)}<figcaption><b>{e(c)}</b></figcaption></figure>' for n, c in s["gallery"])
        vids = f'<section class="section tint-lilac round-top" id="play-video"><div class="wrap">{video_block(R)}</div></section>' if s["videos"] else ""
        others = "".join(f'<a class="card reveal" href="{R}works/{o["slug"]}/" style="--c:{o["c"]}"><div class="card-img">{img(R, o["cover"], o["title"])}</div><div class="card-body"><span class="tag">{e(o["years"])}</span><h3>{e(o["title"])}</h3></div></a>' for o in SERIES if o["slug"] != s["slug"])[:]
        return f'''<div class="wrap crumbs"><a href="{R}">Главная</a> / <a href="{R}#projects">Проекты</a> / {e(s["title"])}</div>
<section class="series-hero"><div class="wrap two">
<div class="reveal in"><span class="eyebrow">{e(s["tag"])} · {e(s["years"])}</span><h1>{e(s["title"])}</h1>
<p class="answer">{e(s["answer"])}</p>
<table class="ftable">{facts}</table></div>
<div class="reveal in">{img(R, s["hero"], f'{s["title"]} — керамика Ольги Симоновой (sim.play.art)', sizes="(min-width:900px) 45vw, 100vw", eager=True, collect=imgs)}</div>
</div></section>
<section class="section" style="padding-top:24px"><div class="wrap prose reveal"><h2>Идея</h2>{idea}{proc}</div></section>
{vids}{works}
<section class="section" style="padding-top:0" id="gallery"><div class="wrap"><h2>Галерея</h2><div class="gallery">{gal}</div>
<p class="muted" style="margin-top:24px">Обновлено: {UPDATED}. Вопросы о покупке — <a href="{LINKS["telegram"]}">Telegram @simplayart</a>, <a href="{LINKS["instagram"]}">Instagram @sim.play.art</a>.</p></div></section>
{press_section([p for p in PRESS if p["play"]], title="О PLAY пишут", eyebrow="Пресса", sid="press-play", wide=False, lead=f'Все публикации — на странице <a href="{R}about/#o-ney-pishut">«Обо мне»</a>.') if s["slug"] == "play" else ""}
<section class="section tint-butter round-top"><div class="wrap"><h2>Другие проекты</h2><div class="cards">{others}</div></div></section>'''
    arts = []
    for name, year, mat, size, im, where, url in s["works"]:
        a = {"@type": "VisualArtwork", "name": name, "creator": {"@id": PERSON_ID}, "dateCreated": year, "artform": "Керамика",
             "artMedium": mat, "image": f"{SITE_URL}/img/{im}.webp", "isPartOf": {"@type": "CreativeWorkSeries", "name": s["title"], "url": SITE_URL + "/" + path}}
        if size:
            parts = size.replace("~", "").replace("см", "").split("×")
            if len(parts) == 2:
                a["height"] = {"@type": "Distance", "name": parts[0].strip() + " см"}
                a["width"] = {"@type": "Distance", "name": parts[1].strip() + " см"}
        if url: a["url"] = url; a["offers"] = {"@type": "Offer", "url": url, "availability": "https://schema.org/InStock", "seller": {"@type": "ArtGallery", "name": "SAMPLE"}}
        arts.append(a)
    schema = [person(), breadcrumbs([("Главная", ""), (s["title"], path)]),
              {"@type": "CollectionPage", "@id": SITE_URL + "/" + path + "#page", "url": SITE_URL + "/" + path, "name": s["seo_title"],
               "description": s["answer"], "author": {"@id": PERSON_ID}, "dateModified": iso_dt(UPDATED), "inLanguage": "ru",
               "about": {"@type": "CreativeWorkSeries", "name": s["title"], "creator": {"@id": PERSON_ID}},
               **({"hasPart": arts} if arts else {})}]
    if s["videos"]: schema += video_schema()
    page(path, f"{s['seo_title']} · Ольга Симонова (sim.play.art)", s["answer"][:250], body, schema=schema, active="projects", images=imgs)

def build_about():
    imgs = []
    def body(R):
        by_year = {}
        for y, w, p, a, _ in EXHIBITIONS: by_year.setdefault(y, []).append((w, p, a))
        ex = "".join(f'<li><b>{y}</b>' + "<br>".join(f'{e(w)}, {e(p)}' + (f' <span class="award" style="background:var(--butter);padding:1px 8px;border-radius:999px;font-size:.78rem;font-weight:700">{e(a)}</span>' if a else "") for w, p, a in items) + "</li>" for y, items in by_year.items())
        lst = lambda L: "".join(f"<li><b>{y}</b>{e(t)}</li>" for y, t in L)
        press = "".join(f'<figure class="reveal">{img(R, n, a, collect=imgs)}<figcaption><b>{e(a)}</b></figcaption></figure>' for n, a in [
            ("olga-simonova-portret-sankt-peterburg", "Ольга Симонова, портрет"), ("olga-simonova-hudozhnitsa-keramist", "Ольга Симонова с керамическими объектами"),
            ("olga-simonova-colour-block-art-brut-2023", "На выставке «Colour Block», Art Brut, 2023"), ("olga-simonova-portret", "Ольга Симонова, Санкт-Петербург"),
            ("olga-simonova-s-oblakom", "С облаком из серии «Облака»"), ("vystavka-simplayart-ekspozitsiya", "Экспозиция работ sim.play.art")])
        return f'''<div class="wrap crumbs"><a href="{R}">Главная</a> / Обо мне</div>
<section class="series-hero"><div class="wrap two">
<div class="reveal in"><span class="eyebrow">Обо мне</span><h1>{NAME}</h1>
<p class="answer">{e(BIO_FULL[0])}</p>{"".join(f"<p>{e(p)}</p>" for p in BIO_FULL[1:])}
<div class="btns"><a class="btn btn-fill" href="{LINKS["instagram"]}" target="_blank" rel="me noopener">Instagram</a><a class="btn btn-ghost" href="{LINKS["telegram"]}" target="_blank" rel="me noopener">Написать в Telegram</a></div></div>
<div class="portrait-stack reveal in">{img(R, "olga-simonova-v-masterskoy", "Ольга Симонова в своей керамической мастерской в Санкт-Петербурге", sizes="(min-width:900px) 45vw, 100vw", eager=True, collect=imgs)}</div>
</div></section>
<section class="section tint-lilac round-top" id="statement"><div class="wrap prose">
<span class="eyebrow">Artist statement</span>
<p class="statement">{e(STATEMENT[1])}</p>{"".join(f"<p>{e(p)}</p>" for p in (STATEMENT[0], STATEMENT[2], STATEMENT[3]))}</div></section>
{press_section(PRESS, lead="Независимые медиа и институции о работах Ольги Симоновой (sim.play.art): обзоры выставок, интервью, итоги конкурсов.")}
<section class="section cv" id="cv"><div class="wrap two">
<div><span class="eyebrow">CV</span><h2>Образование</h2><ul>{lst(EDUCATION)}</ul>
<h3>Дополнительное образование</h3><ul>{lst(EDU_EXTRA)}</ul>
<h3>Награды</h3><ul>{"".join(f'<li><b>{y}</b>{e(t)}' + (f'<span class="srcs">{press_chips(t)}</span>' if press_chips(t) else "") + "</li>" for y, t in AWARDS)}</ul>
<h3>Проекты</h3><ul>{lst(PROJECTS)}</ul>
<h3>Сотрудничество</h3><p>{e(PARTNERS)}</p></div>
<div><h2>Выставки и ярмарки</h2><p class="muted cv-note">Со стрелкой ↗ — ссылки на публикации о выставке.</p>{ex_list(EXHIBITIONS, chips=True)}</div></div></section>
<section class="section tint-blush round-top" id="press"><div class="wrap"><span class="eyebrow">Для прессы</span><h2>Фотографии</h2>
<p class="lead" style="margin-bottom:32px">Портреты и фото работ можно использовать в публикациях с подписью «Ольга Симонова / sim.play.art». Фото в высоком разрешении — по запросу в Telegram.</p>
<div class="gallery">{press}</div></div></section>'''
    exevents = [{"@type": "ExhibitionEvent", "name": w, "startDate": y, "location": {"@type": "Place", "name": p}, "performer": {"@id": PERSON_ID}} for y, w, p, a, h in EXHIBITIONS if h]
    schema = [person(full=True), breadcrumbs([("Главная", ""), ("Обо мне", "about/")]),
              {"@type": "ProfilePage", "url": SITE_URL + "/about/", "name": f"{NAME} — биография и CV", "mainEntity": {"@id": PERSON_ID}, "dateModified": iso_dt(UPDATED)}, *exevents]
    page("about/", f"{NAME} — биография, CV, выставки · sim.play.art",
         "Биография и CV художницы-керамиста Ольги Симоновой (sim.play.art): образование (академия Штиглица), выставки в Русском музее и Cube.Moscow, награды, artist statement.",
         body, schema=schema, active="about", images=imgs)

def build_en():
    imgs = []
    def body(R):
        ex = [("2026", "“You can play” (duo show)", "Cube.Moscow, Moscow", "", True), ("2026", "“Games People Play”", "State Russian Museum, Saint Petersburg", "", True),
              ("2026", "Spring Art Fair “All paths One place”", "Taoxichuan Art Center, China", "", True), ("2026", "BLAZAR art fair", "with SAMPLE gallery", "", True),
              ("2025", "“Back to Matter”", "Byl Contemporary Art Centre, Stary Oskol", "", True), ("2025", "“Cabinet of Curiosities” festival", "Bulthaup Design Gallery, Saint Petersburg", "", True),
              ("2024", "Third Art Fair", "Saint Petersburg", "3rd prize", True), ("2023", "“Colour Block”", "Art Brut Gallery, Moscow", "1st prize", True)]
        return f'''<section class="hero" id="about"><div class="hero-bg"></div><div class="wrap hero-grid">
<div class="reveal in"><span class="eyebrow">Ceramic artist · Saint Petersburg</span><h1>{NAME_EN}<span class="nick">sim.play.art</span></h1>
{"".join(f'<p class="{"lead" if i==0 else ""}">{e(p)}</p>' for i, p in enumerate(BIO_EN))}
<div class="btns"><a class="btn btn-fill" href="{LINKS["instagram"]}" target="_blank" rel="me noopener">Instagram @sim.play.art</a><a class="btn btn-ghost" href="{R}#play-video">Assembly videos</a></div></div>
<div class="hero-media">{img(R, "olga-simonova-portret-s-plodom", "Olga Simonova, ceramic artist (sim.play.art), with a ceramic fruit on her head", sizes="(min-width:900px) 45vw, 100vw", eager=True, collect=imgs)}<span class="blob b1"></span><span class="blob b2"></span></div>
</div></section>
<section class="section tint-lilac round-top" id="play"><div class="wrap two">
<div class="prose"><span class="eyebrow">Artist statement</span>{"".join(f"<p>{e(p)}</p>" for p in STATEMENT_EN)}
<h2 style="margin-top:1em">PLAY (2023 — ongoing)</h2><p>PLAY is an open visual system: each object is a ceramic pyramid built from parts held together by magnets. The parts can be connected, rotated and swapped, so the work is never fixed and the viewer can rebuild it. Clay, glaze, magnets; some objects include glass. PLAY 1, PLAY 10 and PLAY 12 are available through <a href="{LINKS["sample"]}">SAMPLE gallery</a>.</p></div>
<div>{img(R, "play-11-keramika-2026", "PLAY 11 (2026), ceramic pyramid with magnetic parts by Olga Simonova", sizes="(min-width:900px) 45vw, 100vw", collect=imgs).replace('<img', '<img style="border-radius:var(--radius)"')}</div></div></section>
{press_section(PRESS, title="Press", eyebrow="Media", sid="press", lang="en", lead="Independent media and institutions writing about Olga Simonova (sim.play.art). All articles are in Russian.")}
<section class="section" id="cv"><div class="wrap two"><div><span class="eyebrow">Selected exhibitions</span><h2>Exhibitions & awards</h2>
<p class="lead">Education: Stieglitz Saint Petersburg State Academy of Art and Industry, Department of Ceramics and Glass (from 2014); SPbGUPTD, Graphic Design (2012–2014). Residencies: ART BOOST (2022) and Clay (2023), GetArtFit.</p></div>
<div>{ex_list(ex)}</div></div></section>'''
    p = person(); p.update({"name": NAME_EN, "alternateName": [NAME, NICK], "jobTitle": "Ceramic artist", "description": BIO_EN[0],
                            "homeLocation": {"@type": "Place", "name": "Saint Petersburg, Russia"}})
    page("en/", "Olga Simonova (sim.play.art) — ceramic artist, Saint Petersburg",
         "Olga Simonova (sim.play.art) is a ceramic artist from Saint Petersburg creating modular ceramic objects held together by magnets. PLAY project, exhibitions, contacts.",
         body, lang="en", schema=[p, {"@type": "ProfilePage", "url": SITE_URL + "/en/", "mainEntity": {"@id": PERSON_ID}, "inLanguage": "en", "dateModified": iso_dt(UPDATED)}], images=imgs)

# ---------------- конструктор ----------------
def build_play():
    app = open(os.path.join(SRC, "play", "app.html"), encoding="utf-8").read()
    def body(R):
        return app + f'''
<section class="pa-about"><div class="wrap">
<div class="pa-about-grid">
<div>
<p class="eyebrow">Поиграть</p>
<h1>3D-конструктор PLAY</h1>
<p class="lead">Соберите свою пирамиду из деталей, придуманных по мотивам работ Ольги Симоновой (sim.play.art): воздушные шарики, груша, яблоко и огрызок, облако, лестница, волна, корона, геометрические фигуры и основания.</p>
<h2 style="font-size:1.5rem">Зачем этот конструктор</h2>
<p>В практике Ольги игра — не тема, а метод. Пирамиды PLAY собираются на магнитах: элементы можно соединять, вращать и менять местами, и зритель становится соавтором работы. Конструктор продолжает этот принцип в цифровом виде: правила простые, а вариаций — бесконечно много.</p>
<p>Здесь можно сделать то, чего нельзя с керамикой: поставить детали друг в друга, сменить глазурь одним касанием, собрать пирамиду высотой в метр. Это игра по мотивам работ, а не копии конкретных объектов. Настоящие пирамиды PLAY — <a href="{R}works/play/">на странице проекта</a>, купить их можно в галерее SAMPLE или напрямую у художницы.</p>
</div>
<div>
<h2 style="font-size:1.5rem">Как сохранить</h2>
<ol>
<li><b>Видео для Reels 9:16</b> или <b>квадратное 1:1</b> — оборот вокруг оси и финальная карточка, MP4 в Safari и свежем Chrome.</li>
<li><b>3D-модель .glb</b> — вместе с подиумом; открывается в Blender, «Средстве 3D-просмотра» Windows, на Sketchfab.</li>
<li><b>Картинка .png</b> — снимок сцены как на экране.</li>
<li><b>Ссылка на сборку</b> — пирамида хранится прямо в адресе, ей можно поделиться.</li>
</ol>
<p class="muted">Выложили свою сборку? Отметьте @sim.play.art — Ольге будет интересно посмотреть.</p>
</div>
</div>
<div class="pa-rules" id="rules">
<h2>Правила использования</h2>
<ul>
<li>Формы деталей созданы по мотивам работ Ольги Симоновой (sim.play.art). Права на них остаются у художницы.</li>
<li>Свои сборки можно свободно публиковать в соцсетях и блогах — с отметкой @sim.play.art или ссылкой на simplayart.ru/play.</li>
<li>Знак sim.play.art на подиуме, видео и картинках — часть сборки, пожалуйста, не удаляйте его.</li>
<li>Коммерческое использование — продажа, печать на 3D-принтере на продажу, использование в рекламе и чужих продуктах — только с письменного согласия художницы. Написать: <a href="{LINKS["telegram"]}" rel="noopener" target="_blank">Telegram</a> или <a href="{LINKS["instagram"]}" rel="noopener" target="_blank">Instagram</a>.</li>
<li>Конструктор работает целиком в вашем браузере: сборки никуда не отправляются и не хранятся на сервере.</li>
</ul>
</div>
</div></section>'''
    head = (f'<link rel="stylesheet" href="../assets/play/play.css?v={ver("play/play.css")}">'
            f'<link rel="modulepreload" href="../assets/play/three/three.module.min.js">\n')
    play_ver = hashlib.md5("".join(ver("play/" + f) for f in ("app.js", "shapes.js", "materials.js", "brand.js", "three/sim-font.json")).encode()).hexdigest()[:8]
    scripts = f'\n<script type="module" src="../assets/play/app.js?v={play_ver}"></script>'
    app_ld = {"@type": "WebApplication", "@id": SITE_URL + "/play/#app", "name": "3D-конструктор PLAY",
              "url": SITE_URL + "/play/", "applicationCategory": "GameApplication", "operatingSystem": "Любая, в браузере",
              "inLanguage": "ru", "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "RUB"},
              "description": "Браузерный 3D-конструктор по мотивам керамических пирамид PLAY художницы Ольги Симоновой (sim.play.art): детали, фактуры, принты, экспорт видео и 3D-модели.",
              "creator": {"@id": PERSON_ID}, "isBasedOn": {"@type": "CreativeWork", "name": "PLAY", "url": SITE_URL + "/works/play/", "creator": {"@id": PERSON_ID}}}
    page("play/", "3D-конструктор PLAY — соберите свою пирамиду · sim.play.art",
         "Поиграйте в 3D-конструктор по мотивам керамических пирамид PLAY Ольги Симоновой (sim.play.art): шарики, фрукты, геометрия, фактуры и принты. Сохраните видео для Reels и 3D-модель.",
         body, schema=[app_ld, breadcrumbs([("Главная", ""), ("3D-конструктор PLAY", "play/")])], active="play",
         head_extra=head, scripts=scripts)

# ---------------- service files ----------------
def build_service():
    open(os.path.join(OUT, ".nojekyll"), "w").write("")
    host = SITE_URL.split("//")[1].split("/")[0]
    cname = os.path.join(OUT, "CNAME")
    if host.endswith("github.io"):
        if os.path.exists(cname): os.remove(cname)
    else:
        open(cname, "w").write(host)
    urls = []
    for path, ims in SITEMAP:
        seen, im_xml = set(), ""
        for n, a in ims:
            if n in seen: continue
            seen.add(n); im_xml += f"<image:image><image:loc>{SITE_URL}/img/{n}.webp</image:loc><image:title>{e(a)}</image:title></image:image>"
        urls.append(f"<url><loc>{SITE_URL}/{path}</loc><lastmod>{UPDATED}</lastmod>{im_xml}</url>")
    open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
        + "".join(urls) + "</urlset>")
    robots = open(os.path.join(SRC, "..", "..", "04_tech", "robots.txt"), encoding="utf-8").read()
    robots = robots.replace("Disallow: /admin/\nDisallow: /cart/\n", "").replace("https://{{DOMAIN}}", SITE_URL).replace("{{DOMAIN}}", SITE_URL.split("//")[1])
    open(os.path.join(OUT, "robots.txt"), "w", encoding="utf-8").write(robots)
    hi = [x for x in EXHIBITIONS if x[4]]
    llms = f"""# {NAME} (sim.play.art)

> {BIO_SHORT}

{NAME} — художница-керамист из Санкт-Петербурга (родилась в 1994 году в Пскове). Публичный ник — sim.play.art. English: {NAME_EN}, ceramic artist, Saint Petersburg.

## Ключевые факты
- Медиум: керамика — глина, глазурь, магниты; в отдельных объектах стекло
- Метод: игра как метод; модульные объекты на магнитах, детали можно соединять, вращать и менять местами; зритель — соавтор
- Образование: СПГХПА им. А. Л. Штиглица (кафедра художественной керамики и стекла), СПбГУПТД (графический дизайн)
- Мастерская: собственная, с 2019 года, Санкт-Петербург
- Награды: {"; ".join(f"{t} ({y})" for y, t in AWARDS)}
- Избранные выставки: {"; ".join(f"{w}, {p} ({y})" for y, w, p, a, h in hi)}
- Галерея: SAMPLE — {LINKS["sample"]}
- Контакты: Instagram {LINKS["instagram"]} · Telegram {LINKS["telegram"]} · ВКонтакте {LINKS["vk"]}

## Страницы
- [Главная]({SITE_URL}/): кто такая Ольга Симонова, метод, видео сборки, проекты, FAQ
- [Обо мне и CV]({SITE_URL}/about/): биография, artist statement, образование, выставки, награды
- [Поиграть: 3D-конструктор PLAY]({SITE_URL}/play/): соберите свою пирамиду из деталей по мотивам работ Ольги — шарики, фрукты, геометрия; фактуры, принты, видео вращения и 3D-модель
""" + "".join(f"- [{s['title']}]({SITE_URL}/works/{s['slug']}/): {s['short']}\n" for s in SERIES) + f"- [English]({SITE_URL}/en/): bio and statement in English\n" \
      + "\n## О ней пишут (независимые источники)\n" + "".join(f"- [{p['outlet']} — {p['title']}]({p['url']}) ({press_date(p['date'])}): {p['preview']}\n" for p in PRESS)
    open(os.path.join(OUT, "llms.txt"), "w", encoding="utf-8").write(llms)
    nf = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Страница не найдена · sim.play.art</title><meta name="robots" content="noindex"><link rel="stylesheet" href="{SITE_URL}/assets/style.css"></head>
<body><main class="wrap" style="min-height:80vh;display:grid;place-items:center;text-align:center"><div><p class="eyebrow">404</p><h1>Эта деталь потерялась</h1><p class="lead">Похоже, магнит не сработал. Вернитесь на главную и соберите заново.</p><div class="btns" style="justify-content:center"><a class="btn btn-fill" href="{SITE_URL}/">На главную</a></div></div></main></body></html>'''
    open(os.path.join(OUT, "404.html"), "w", encoding="utf-8").write(nf)

def build_root():
    """Репозиторий nsimonov-design.github.io: корень домена — переадресация, robots.txt, llms.txt, подтверждение Яндекса."""
    root = os.path.join(SRC, "..", "..", "site-root")
    os.makedirs(root, exist_ok=True)
    open(os.path.join(root, ".nojekyll"), "w").write("")
    shutil.copy(os.path.join(OUT, "robots.txt"), os.path.join(root, "robots.txt"))
    shutil.copy(os.path.join(OUT, "llms.txt"), os.path.join(root, "llms.txt"))
    target = SITE_URL + "/"
    open(os.path.join(root, "index.html"), "w", encoding="utf-8").write(f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{NAME} (sim.play.art) — художница-керамист</title>
<meta name="description" content="{e(BIO_SHORT)}">
<link rel="canonical" href="{target}">{verify_tags()}
<script>location.replace("{target}")</script>
<style>body{{font:17px/1.6 system-ui,sans-serif;background:#FBF8F5;color:#2A2833;display:grid;place-items:center;min-height:90vh;margin:0;padding:16px;text-align:center}}a{{color:#3B55C9}}</style>
</head><body><p>{NAME} (sim.play.art) — художница-керамист из Санкт-Петербурга.<br><a href="{target}">Перейти на сайт →</a></p></body></html>''')

if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "assets"), exist_ok=True)
    for f in ("style.css", "main.js"):
        shutil.copy(os.path.join(SRC, f), os.path.join(OUT, "assets", f))
    play_out = os.path.join(OUT, "assets", "play")
    if os.path.exists(play_out): shutil.rmtree(play_out)
    shutil.copytree(os.path.join(SRC, "play"), play_out, ignore=shutil.ignore_patterns("app.html"))
    # версии модулей в импортах: после обновления браузер не смешает старые и новые файлы
    mods = {f: ver("play/" + f) for f in ("shapes.js", "materials.js", "brand.js")}
    for f in ("app.js", "shapes.js", "materials.js", "brand.js"):
        fp = os.path.join(play_out, f); t = open(fp, encoding="utf-8").read()
        for m, h in mods.items(): t = t.replace(f"'./{m}'", f"'./{m}?v={h}'")
        t = t.replace("'./three/sim-font.json'", f"'./three/sim-font.json?v={ver('play/three/sim-font.json')}'")
        open(fp, "w", encoding="utf-8").write(t)
    build_index(); build_about(); build_en(); build_play()
    for s in SERIES: build_series(s)
    build_service()
    build_root()
    print("built", len(SITEMAP), "pages →", os.path.abspath(OUT))
