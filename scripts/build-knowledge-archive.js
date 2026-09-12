// 배경지식 한 스푼 아카이브 빌드 스크립트.
// 네이버 RSS에서 지식한스푼 카테고리 글을 모두 가져와 실제 게시 순서로 Day 번호를 매기고,
// 릴스용 내레이션 원고(또는 초안의 한 줄 정리)를 재구성해 목록 페이지 1개 + 상세 페이지 N개를
// 정적 HTML로 생성한다. 방문자 브라우저가 나중에 JS로 그리는 방식이 아니라, 빌드 시점에
// 실제 텍스트를 HTML에 박아 넣어 크롤러가 그대로 읽을 수 있게 한다.
const fs = require('fs');
const path = require('path');

const SITE_ROOT = path.join(__dirname, '..');
const NARRATIONS_DIR = 'D:\\우리학원AI\\도구\\tts\\narrations';
const DRAFTS_ROOT = 'D:\\우리학원AI';
const DRAFTS_SUB = 'D:\\우리학원AI\\블로그초안';
const OUT_DIR = path.join(SITE_ROOT, 'archive');

// 대표성휴리스틱결합오류: 아직 릴스 내레이션이 없어 원고의 한 줄 정리만 쓰면 다른 회차보다
// 눈에 띄게 짧아짐. 원고의 hook/concepts 절을 바탕으로 같은 톤으로 다시 써서 보강.
const SUMMARY_OVERRIDES = {
  '대표성휴리스틱결합오류': "오늘은 '대표성 휴리스틱과 결합 오류'를 알아볼게요. '린다는 31세이고 독신이며 사회 정의에 관심이 많다'는 설명을 들으면, 사람들은 린다가 그냥 은행원이기보다 '은행원이면서 페미니스트'일 가능성이 더 높다고 답해요. 그런데 이건 명백한 오류예요. 은행원이면서 페미니스트인 사람은 은행원 전체의 일부일 뿐이라, 그 확률이 은행원일 확률을 넘어설 수 없거든요. 심리학자 카너먼과 트버스키는 이야기가 구체적이고 그럴듯하게 느껴질수록, 사람들이 실제 확률 법칙을 무시하고 판단한다는 걸 밝혀냈어요. 이야기가 정교해질수록 설득력은 커지지만, 그게 확률적으로 맞다는 뜻은 아니라는 거예요.",
};

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function getTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
  return m ? decodeEntities(m[1].trim()) : '';
}
function extractThumbnail(description) {
  const m = description.match(/<img[^>]+src="([^"]+)"/);
  return m ? m[1] : '';
}
function cleanTitle(title) {
  return title.replace(/^[^|]*\|\s*/, '').trim();
}
function displayTitleOf(title) {
  return title.replace(/^오늘의 배경지식 한 스푼_/, '').replace(/_옥길동[^_]*$/, '').replace(/^옥길동[^_]*$/, '') || title;
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function normalize(s) {
  return s.replace(/\([^)]*\)/g, '').replace(/[_\s\-·]/g, '')
    .replace(/(의|와|과|와의|과의)/g, '').replace(/가설$/, '').trim();
}
function trimNarration(text) {
  const sentences = text.split(/(?<=[.요다임]\.)\s*/).filter(Boolean);
  if (sentences.length > 1) sentences.pop();
  return sentences.join(' ').trim();
}

async function main() {
  const res = await fetch('https://rss.blog.naver.com/jessie5599.xml');
  if (!res.ok) throw new Error('RSS fetch failed: ' + res.status);
  const xml = await res.text();
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  let items = itemBlocks.map((block) => {
    const description = getTag(block, 'description');
    return {
      category: getTag(block, 'category').replace(/^[■□]\s*/, ''),
      title: cleanTitle(getTag(block, 'title')),
      link: getTag(block, 'link'),
      pubDate: getTag(block, 'pubDate'),
      thumbnail: extractThumbnail(description),
    };
  }).filter((it) => it.category === '지식한스푼');

  items.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate));
  items.forEach((it, idx) => { it.day = idx + 1; it.displayTitle = displayTitleOf(it.title); });

  // 내레이션/초안 텍스트 매칭
  const narrationFiles = fs.readdirSync(NARRATIONS_DIR).filter((f) => f.endsWith('.txt'));
  const narrationMap = {};
  narrationFiles.forEach((f) => {
    narrationMap[f.replace(/\.txt$/, '')] = fs.readFileSync(path.join(NARRATIONS_DIR, f), 'utf8').trim();
  });

  function draftPathFor(topic) {
    const candidates = [
      path.join(DRAFTS_ROOT, `블로그초안_배경지식한스푼_${topic}.md`),
      path.join(DRAFTS_SUB, `블로그초안_배경지식한스푼_${topic}.md`),
    ];
    return candidates.find((p) => fs.existsSync(p)) || null;
  }
  function findDraftSummary(topic) {
    const p = draftPathFor(topic);
    if (!p) return '';
    const m = fs.readFileSync(p, 'utf8').match(/\*\*"([^"]+)"\*\*/);
    return m ? m[1] : '';
  }

  const draftTopicsRoot = fs.readdirSync(DRAFTS_ROOT)
    .filter((f) => f.startsWith('블로그초안_배경지식한스푼_') && f.endsWith('.md'))
    .map((f) => f.replace('블로그초안_배경지식한스푼_', '').replace(/\.md$/, ''));
  const draftTopicsSub = fs.readdirSync(DRAFTS_SUB)
    .filter((f) => f.startsWith('블로그초안_배경지식한스푼_') && f.endsWith('.md'))
    .map((f) => f.replace('블로그초안_배경지식한스푼_', '').replace(/\.md$/, ''));
  const topicKeys = Array.from(new Set([...Object.keys(narrationMap), ...draftTopicsRoot, ...draftTopicsSub]));

  function matchTopic(title) {
    const norm = normalize(title);
    return [...topicKeys].sort((a, b) => b.length - a.length).find((k) => norm.includes(normalize(k)));
  }

  items.forEach((it) => {
    const topic = matchTopic(it.title);
    it.topic = topic || null;
    if (SUMMARY_OVERRIDES[topic]) {
      it.summary = SUMMARY_OVERRIDES[topic];
    } else if (topic && narrationMap[topic]) {
      it.summary = trimNarration(narrationMap[topic]);
    } else if (topic) {
      it.summary = findDraftSummary(topic);
    } else {
      it.summary = '';
    }
  });

  const missing = items.filter((it) => !it.summary);
  if (missing.length) {
    console.warn('경고: 요약을 찾지 못한 항목', missing.map((m) => `Day ${m.day} ${m.title}`));
  }

  // ---- 정적 페이지 생성 ----
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const SITE_HEAD = (title, description, canonical) => `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/png" href="../assets/favicon.png">
<meta property="og:type" content="article">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="제씨영어입시학원">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="https://jessie5599.github.io/assets/og-image.png">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">`;

  const SHARED_STYLE = `
  :root{
    --navy:#1B2A41; --navy-deep:#101C2C; --teal:#128F76; --teal-soft:#DCEFEA;
    --orange:#E67E22; --cream:#F7F5F0; --paper:#FFFFFF; --ink:#2B2B2B;
    --ink-soft:#5B6472; --line:#E3DFD5;
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{margin:0;font-family:'Pretendard',sans-serif;background:var(--cream);color:var(--ink);line-height:1.65;}
  h1,h2,h3{font-family:'Gowun Dodum',sans-serif;margin:0;color:var(--navy);}
  a{color:inherit;text-decoration:none;}
  img{max-width:100%;display:block;}
  .wrap{max-width:760px;margin:0 auto;padding:0 24px;}
  header{position:sticky;top:0;z-index:50;background:rgba(247,245,240,0.92);backdrop-filter:blur(6px);border-bottom:1px solid var(--line);}
  .nav{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;max-width:1120px;margin:0 auto;}
  .brand{font-family:'Gowun Dodum',sans-serif;font-weight:700;font-size:19px;color:var(--navy);}
  .brand span{color:var(--teal);}
  .navlinks{display:flex;gap:24px;font-size:14px;font-weight:500;color:var(--navy);}
  .navlinks a{padding:6px 0;border-bottom:2px solid transparent;transition:border-color .2s;}
  .navlinks a:hover, .navlinks a.active{border-color:var(--orange);}
  .nav-cta{background:var(--orange);color:#fff;padding:9px 18px;border-radius:3px;font-size:14px;font-weight:600;white-space:nowrap;}
  .nav-right{display:flex;align-items:center;gap:12px;}
  .nav-toggle{display:none;flex-direction:column;justify-content:center;gap:5px;width:32px;height:32px;background:none;border:none;cursor:pointer;padding:0;}
  .nav-toggle span{display:block;width:100%;height:2px;background:var(--navy);border-radius:2px;}
  @media(max-width:760px){
    .nav-toggle{display:flex;}
    .navlinks{
      display:none;position:absolute;top:100%;left:0;right:0;
      flex-direction:column;gap:0;background:var(--paper);
      border-bottom:1px solid var(--line);padding:4px 24px 12px;
      box-shadow:0 8px 16px rgba(0,0,0,0.06);
    }
    .navlinks.open{display:flex;}
    .navlinks a{padding:12px 4px;border-bottom:1px solid var(--line);}
    .navlinks a:last-child{border-bottom:none;}
  }
  footer{background:var(--navy-deep);color:#B9C2CE;padding:32px 0;}
  .footer-inner{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-size:13px;}
  .footer-inner .brand{color:#B9C2CE;}
  .footer-inner .brand span{color:var(--teal);}
`;

  const HEADER = `<header>
  <div class="nav">
    <a href="../index.html" class="brand">제씨<span>영어</span>입시학원</a>
    <nav class="navlinks" id="navlinks">
      <a href="../index.html#about">학원소개</a>
      <a href="../index.html#director">원장소개</a>
      <a href="../index.html#curriculum">커리큘럼</a>
      <a href="../index.html#locations">학원안내</a>
      <a href="../index.html#news">소식</a>
      <a href="../archive.html" class="active">아카이브</a>
    </nav>
    <div class="nav-right">
      <a href="../index.html#contact" class="nav-cta">상담 신청</a>
      <button class="nav-toggle" id="navToggle" aria-label="메뉴 열기" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>`;

  const NAV_SCRIPT = `<script>
(function(){
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navlinks');
  if(!toggle || !links) return;
  toggle.addEventListener('click', function(){
    var isOpen = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
})();
</script>`;

  const FOOTER = `<footer>
  <div class="wrap footer-inner">
    <div class="brand">제씨<span>영어</span>입시학원</div>
    <p style="margin:0;">부천시 범안로 231-15 옥길중앙타워 1002호 · 010-8040-5599</p>
  </div>
</footer>`;

  // ---- 상세 페이지 ----
  items.forEach((it) => {
    const pageTitle = `${it.displayTitle} — 배경지식 한 스푼 (Day ${it.day}) | 제씨영어입시학원`;
    const canonical = `https://jessie5599.github.io/archive/${it.day}.html`;
    const altText = `옥길동 영어학원 제씨영어입시학원 - ${it.displayTitle} 카드뉴스`;
    const html = `<!doctype html>
<html lang="ko">
<head>
${SITE_HEAD(pageTitle, it.summary.slice(0, 110), canonical)}
<style>
${SHARED_STYLE}
  .detail-head{padding:32px 0 8px;}
  .detail-head-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}
  .k-day{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11.5px;font-weight:700;background:var(--teal-soft);color:var(--teal);}
  .detail-head h1{font-size:22px;line-height:1.5;font-weight:600;}
  .detail-thumb{width:100%;max-width:420px;aspect-ratio:1/1;object-fit:cover;border-radius:8px;margin:24px auto;box-shadow:0 8px 24px rgba(27,42,65,0.12);background:var(--teal-soft);}
  .detail-summary{font-size:15.5px;line-height:1.8;color:var(--ink);padding:0 0 32px;}
  .detail-link{display:inline-block;margin:0 0 64px;font-size:14.5px;font-weight:600;color:#fff;background:var(--teal);padding:11px 20px;border-radius:4px;}
  .back-link{font-size:13.5px;color:var(--ink-soft);display:inline-block;flex-shrink:0;}
  .back-link-bottom{margin-top:24px;}
</style>
</head>
<body>
${HEADER}
<div class="wrap">
  <div class="detail-head">
    <div class="detail-head-top">
      <span class="k-day">Day ${it.day}</span>
      <a class="back-link" href="../archive.html">← 목록으로 돌아가기</a>
    </div>
    <h1>${esc(it.displayTitle)}</h1>
  </div>
  <img class="detail-thumb" src="${it.thumbnail}" referrerpolicy="no-referrer" loading="lazy" alt="${esc(altText)}">
  <p class="detail-summary">${esc(it.summary)}</p>
  <a class="detail-link" href="${it.link}" target="_blank" rel="noopener">네이버 블로그에서 전체 글 보기 →</a>
  <div><a class="back-link back-link-bottom" href="../archive.html">← 목록으로 돌아가기</a></div>
</div>
${FOOTER}
${NAV_SCRIPT}
</body>
</html>`;
    fs.writeFileSync(path.join(OUT_DIR, `${it.day}.html`), html, 'utf8');
  });

  // ---- 목록 페이지 (archive.html, 사이트 루트) ----
  const listRows = [...items].sort((a, b) => b.day - a.day).map((it) => {
    const label = `옥길동 영어학원 제씨영어입시학원 — 배경지식 한 스푼: ${it.displayTitle}`;
    return `      <li><a href="archive/${it.day}.html"><span class="k-day">Day ${it.day}</span><span class="k-label">${esc(label)}</span></a></li>`;
  }).join('\n');

  const listTitle = '배경지식 한 스푼 아카이브 | 제씨영어입시학원';
  const listDesc = '옥길동·범박동·소사동 학생들을 위해 국어·영어 지문에 자주 나오는 배경지식을 정리한 아카이브입니다.';
  const listHtml = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(listTitle)}</title>
<meta name="description" content="${esc(listDesc)}">
<link rel="canonical" href="https://jessie5599.github.io/archive.html">
<link rel="icon" type="image/png" href="assets/favicon.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="제씨영어입시학원">
<meta property="og:title" content="${esc(listTitle)}">
<meta property="og:description" content="${esc(listDesc)}">
<meta property="og:url" content="https://jessie5599.github.io/archive.html">
<meta property="og:image" content="https://jessie5599.github.io/assets/og-image.png">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>
${SHARED_STYLE.replace(/\.\.\//g, '')}
  .page-head{padding:40px 0 20px;}
  .page-head .eyebrow{color:var(--teal);font-weight:600;font-size:13px;letter-spacing:.03em;}
  .page-head h1{font-size:26px;line-height:1.4;font-weight:600;margin-top:8px;}
  .page-head p{color:var(--ink-soft);font-size:15px;margin-top:10px;}
  .k-list{list-style:none;margin:0;padding:0 0 72px;border-top:1px solid var(--line);}
  .k-list li{border-bottom:1px solid var(--line);}
  .k-list a{display:flex;align-items:center;gap:12px;padding:14px 4px;font-size:14.5px;font-weight:500;color:var(--navy);transition:color .15s;}
  .k-list a:hover{color:var(--teal);}
  .k-list .k-day{flex-shrink:0;display:inline-block;padding:3px 10px;border-radius:12px;font-size:11.5px;font-weight:700;background:var(--teal-soft);color:var(--teal);}
  .k-list .k-label{flex:1;}
</style>
</head>
<body>
<header>
  <div class="nav">
    <a href="index.html" class="brand">제씨<span>영어</span>입시학원</a>
    <nav class="navlinks" id="navlinks">
      <a href="index.html#about">학원소개</a>
      <a href="index.html#director">원장소개</a>
      <a href="index.html#curriculum">커리큘럼</a>
      <a href="index.html#locations">학원안내</a>
      <a href="index.html#news">소식</a>
      <a href="archive.html" class="active">아카이브</a>
    </nav>
    <div class="nav-right">
      <a href="index.html#contact" class="nav-cta">상담 신청</a>
      <button class="nav-toggle" id="navToggle" aria-label="메뉴 열기" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>
<section class="page-head">
  <div class="wrap">
    <span class="eyebrow">ARCHIVE</span>
    <h1>배경지식 한 스푼 아카이브</h1>
    <p>지문마다 자주 나오는 배경지식을 하나씩 정리했습니다. 제목을 누르면 자세한 설명을 볼 수 있어요.</p>
  </div>
</section>
<section class="wrap">
  <ul class="k-list">
${listRows}
  </ul>
</section>
<footer>
  <div class="wrap footer-inner">
    <div class="brand">제씨<span>영어</span>입시학원</div>
    <p style="margin:0;">부천시 범안로 231-15 옥길중앙타워 1002호 · 010-8040-5599</p>
  </div>
</footer>
${NAV_SCRIPT}
</body>
</html>`;

  fs.writeFileSync(path.join(SITE_ROOT, 'archive.html'), listHtml, 'utf8');

  // ---- sitemap.xml 갱신: 기존 항목은 보존하고 아카이브 URL만 다시 씀 ----
  const sitemapPath = path.join(SITE_ROOT, 'sitemap.xml');
  const existing = fs.readFileSync(sitemapPath, 'utf8');
  const nonArchiveUrls = (existing.match(/<url>[\s\S]*?<\/url>/g) || [])
    .filter((u) => !u.includes('/archive'));
  const archiveUrls = [
    `  <url>\n    <loc>https://jessie5599.github.io/archive.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ...items.map((it) => `  <url>\n    <loc>https://jessie5599.github.io/archive/${it.day}.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${nonArchiveUrls.join('\n')}\n${archiveUrls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');

  console.log('완료:', items.length, '개 상세 페이지 + 목록 페이지 1개 + sitemap.xml 갱신');
}

main().catch((err) => { console.error(err); process.exit(1); });
