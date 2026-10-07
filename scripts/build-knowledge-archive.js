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
  '증여론': "오늘은 마르셀 모스의 '증여론'을 알아볼게요. 남태평양 트로브리안드 제도의 '쿨라' 교환에서는 선물이 자발적인 것처럼 건네지지만, 정해진 방향과 시간 안에 반드시 답례되어야 해요. 모스는 주어야 할 의무, 받아야 할 의무, 답례해야 할 의무가 맞물려서 선물에 사회적 강제력이 생긴다고 봤어요. 그래서 증여를 경제 행위 하나가 아니라 종교·법·도덕·위신이 함께 얽힌 '총체적 사회적 사실'이라고 불렀어요. 순수한 선물이라는 우리의 상식을 되묻게 하는 이론이에요.",
  '대표성휴리스틱결합오류': "오늘은 '대표성 휴리스틱과 결합 오류'를 알아볼게요. '린다는 31세이고 독신이며 사회 정의에 관심이 많다'는 설명을 들으면, 사람들은 린다가 그냥 은행원이기보다 '은행원이면서 페미니스트'일 가능성이 더 높다고 답해요. 그런데 이건 명백한 오류예요. 은행원이면서 페미니스트인 사람은 은행원 전체의 일부일 뿐이라, 그 확률이 은행원일 확률을 넘어설 수 없거든요. 심리학자 카너먼과 트버스키는 이야기가 구체적이고 그럴듯하게 느껴질수록, 사람들이 실제 확률 법칙을 무시하고 판단한다는 걸 밝혀냈어요. 이야기가 정교해질수록 설득력은 커지지만, 그게 확률적으로 맞다는 뜻은 아니라는 거예요.",
  // 2026-09-24: 이중코딩부터 공개키암호까지 4개 회차는 릴스 내레이션이 아직 없어 findDraftSummary()의
  // 한 줄 인용문만 쓰이면서 다른 회차보다 눈에 띄게 짧았음(길이 44~55자 vs 다른 회차 160~325자).
  // 원장님 지적으로 각 초안의 hook/concepts 절을 바탕으로 같은 톤의 여러 문장 요약으로 보강.
  '이중코딩': "오늘은 '이중코딩'을 알아볼게요. 1972년, '형태는 기능을 따른다'는 원칙대로 지어진 아파트 단지가 입주민에게 외면받다 결국 철거됐어요. 건축이론가 찰스 젠크스는 이 사건을 계기로 포스트모던 건축을 제안하는데, 핵심이 바로 이중코딩이에요. 건축 전문가에게는 정교한 역사적 인용으로, 일반 대중에게는 친숙한 장식으로 동시에 읽히도록 설계하는 방식이에요. 전문성과 대중성이라는 상반된 두 가치를, 절충하지 않고 각자의 독립성을 유지한 채 하나의 건물 안에 공존시키는 게 핵심이에요.",
  '형태추종기능': "오늘은 '형태추종기능'을 알아볼게요. 19세기 말 철골구조 기술로 고층 건물이 가능해지자, 건축가 루이스 설리번은 '형태는 언제나 기능을 따른다'는 원칙을 제시했어요. 독수리의 날개가 나는 기능에 맞춰 그 모양이 되었듯, 건물의 형태도 목적에서 자연스럽게 도출돼야 하고 장식은 군더더기라는 거예요. 이 원칙은 바우하우스를 거쳐 미스 반 데어 로에의 '적을수록 풍부하다'로 극단화됐지만, 훗날 로버트 벤추리가 '적을수록 지루하다'며 장식의 복원을 주장하면서 포스트모더니즘으로 이어졌어요.",
  '그라이스협력원칙': "오늘은 '그라이스의 협력원칙과 대화 함축'을 알아볼게요. '저녁 뭐 먹을까'라는 질문에 '아까 점심을 늦게 먹었어'라고 답하면, 말하지 않았는데도 '가볍게 먹자'는 뜻이 정확히 전달돼요. 언어철학자 그라이스는 대화 참여자들이 목적에 협력한다는 '협력의 원리'를 전제로, 양·질·관련성·태도라는 네 가지 격률을 제시했어요. 격률을 표면적으로 어기는 것처럼 보여도, 청자는 화자가 여전히 협력하고 있다고 믿고 그 이유를 추론해 새로운 의미, 즉 대화 함축을 읽어내요.",
  '공개키암호': "오늘은 '공개키 암호(RSA)'를 알아볼게요. 인터넷에서 한 번도 만난 적 없는 서버와 비밀 정보를 주고받을 수 있는 건, 열쇠를 아예 공개해버리는 역설적인 발상 덕분이에요. 전통적인 대칭키 암호는 열쇠를 안전하게 나눠 갖는 과정 자체가 도청될 수 있다는 '키 배송 문제'를 안고 있었는데, 리베스트·샤미르·애들먼은 암호화용 공개키와 복호화용 개인키를 분리해 이 문제를 풀었어요. 두 개의 큰 소수를 곱하기는 쉽지만 그 곱을 다시 소인수로 분해하기는 어렵다는 수학적 비대칭성이, 이 암호의 안전성을 만들어요.",
  // 2026-09-29: 쇤베르크12음기법~클론선택설 3개 회차도 릴스 내레이션이 없어 findDraftSummary()의
  // 한 줄 인용문만 쓰이면서 다른 회차보다 짧아졌음(50~57자). 같은 방식으로 hook/concepts 절을 바탕으로 보강.
  '쇤베르크12음기법': "오늘은 '쇤베르크의 12음 기법'을 알아볼게요. 19세기 말 서양음악을 지탱해온 조성 체계가 한계에 다다르자, 쇤베르크는 조성 중심을 아예 포기하는 무조음악을 시도했어요. 그런데 중심음이 사라지자 음악은 산만하게 들리기 쉬웠고, 그는 12개의 반음을 한 번씩만 쓰도록 정한 순서표인 음렬을 만들어 곡 전체를 구성하는 새 규칙 체계를 세워요. 원형·역행·전위·역행전위라는 네 가지 변형만으로 선율과 화성을 짜는 이 기법은, 자유로워 보이는 파괴가 실은 더 엄격한 질서로 대체된 것임을 보여줘요.",
  '아비투스': "오늘은 '아비투스'를 알아볼게요. 미술관에서 같은 그림을 보고도 누군가는 느낌만 말하고 누군가는 화풍과 맥락을 짚어내는데, 사회학자 부르디외는 이 차이가 개인 취향이 아니라 계급이 새긴 것이라고 봤어요. 특정 가정환경과 교육 속에서 무의식적으로 체화된 성향 체계가 아비투스이고, 사회는 경제자본뿐 아니라 문화자본·사회자본이 함께 작동하는 여러 '장'으로 이루어져요. 상류층은 특정 취향을 '고급'으로 규정해 스스로를 구별지으며, 피지배계급은 강요 없이도 그 기준을 우월한 것으로 받아들이는 상징폭력까지 일어나요.",
  '클론선택설': "오늘은 '클론선택설'을 알아볼게요. 예전에는 항원이 틀처럼 작용해 항체가 그 모양에 맞춰진다는 '지시설'을 믿었지만, 한 번도 겪어본 적 없는 물질에도 항체가 만들어지는 현상은 설명하지 못했어요. 면역학자 버넷은 다윈의 자연선택을 빌려와, 몸이 항원을 만나기 전부터 이미 수백만 가지 모양의 수용체를 가진 림프구를 무작위로 만들어두고, 항원과 우연히 맞는 것만 선택되어 증식한다고 설명해요. 이 원리에서 일부는 기억세포로 남아 백신의 원리가 되고, 자기 몸에 반응하는 위험한 클론은 미리 제거되는 자기 관용도 함께 작동해요.",
  // 2026-09-30: 라반동작분석도 릴스 내레이션이 없어 findDraftSummary()의 한 줄 인용문만 쓰이면서
  // 다른 회차보다 짧았음(67자). 같은 방식으로 hook/concepts 절을 바탕으로 보강.
  '라반동작분석': "오늘은 '라반 동작 분석'을 알아볼게요. 음악은 오선지에 남아 그대로 재현되지만, 무용은 오랫동안 '악보 없는 예술'이라 무대를 내려오는 순간 사라져버렸어요. 무용이론가 루돌프 폰 라반은 몸짓을 음악처럼 기록할 수 있는 기호 체계를 고민했고, 몸·에너지·형태·공간 네 요소로 움직임을 분해해 '라바노테이션'이라는 무보로 남기는 라반 동작 분석을 만들었어요. 다만 이 체계가 움직임의 구조는 보존해도, 그 순간의 고유한 표현성과 생동감까지 완전히 담아내지는 못한다는 근본적 딜레마도 함께 지적돼요.",
  // 2026-10-05: 미메시스도 릴스 내레이션이 없어 findDraftSummary()의 한 줄 인용문만 쓰이며 짧아졌음.
  // 같은 방식으로 hook/concepts 절을 바탕으로 보강.
  '미메시스': "오늘은 '미메시스'를 알아볼게요. 플라톤은 화가가 그린 침대를 이데아를 베낀 현실을 다시 베낀 '그림자의 그림자'라 부르며 예술을 진리에서 멀어진 흉내내기로 깎아내렸어요. 반면 제자 아리스토텔레스는 예술의 모방이야말로 인간의 본성이며, 실제로 일어난 사실이 아니라 일어날 법한 보편적 진실을 다룬다는 점에서 오히려 역사보다 더 철학적이라고 반박했어요. 비극을 보며 연민과 공포를 느끼고 해소하는 카타르시스를 예술의 기능으로 제시했고, 이후 사진과 영화의 등장으로 재현 개념이 흔들리면서 보드리야르는 원본 없이 이미지가 이미지를 복제하는 '시뮬라크르' 단계까지 논의를 확장했어요.",
  // 2026-10-07: 자유의지와결정론도 릴스 내레이션이 없어 findDraftSummary()의 한 줄 인용문만 쓰이며 짧아졌음.
  // 같은 방식으로 hook/concepts 절을 바탕으로 보강.
  '자유의지와결정론': "오늘은 '자유의지와 결정론'을 알아볼게요. 수학자 라플라스는 우주의 모든 입자 정보를 아는 존재라면 미래까지 정확히 계산할 수 있다고 상상했는데, 이게 참이라면 내 선택도 이미 정해진 결과일 뿐이라는 거예요. 신경과학자 벤저민 리벳의 실험에서는 뇌의 준비전위가 의식적 결심보다 약 0.3초 먼저 나타나, 결심이 행동의 원인이 아니라 뒤늦게 따라붙는 착각일 수 있다는 해석을 낳았어요. 강한 결정론은 여기서 자유의지를 환상으로 보지만, 철학자 해리 프랑크푸르트의 양립가능론은 자유의 핵심이 인과 사슬에서 벗어나는 데 있는 게 아니라 자신의 욕구를 스스로 성찰하고 승인하는 능력에 있다고 봐요.",
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
      category: getTag(block, 'category').replace(/^[■□●]\s*/, ''),
      title: cleanTitle(getTag(block, 'title')),
      // PC 버전(blog.naver.com)은 네이버가 항상 noindex를 걸어두고, 모바일 버전(m.blog.naver.com)만 index로 열어둔다.
      // 우리 아카이브가 PC 링크를 그대로 걸어두면 구글이 그 링크를 따라가서 noindex를 보고 색인에서 빼버린다.
      link: getTag(block, 'link').replace('https://blog.naver.com/', 'https://m.blog.naver.com/'),
      pubDate: getTag(block, 'pubDate'),
      thumbnail: extractThumbnail(description),
    };
  }).filter((it) => it.category === '지식한스푼' || it.category === '배경지식한스푼');

  items.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate));
  // RSS는 최근 글 50개만 주기 때문에, 오래된 글이 피드에서 빠지면 Day 번호가 밀린다.
  // 그래서 이미 만든 회차는 scripts/archive-items.json에 저장해 두고(번호 고정), RSS에서 새로 나온 글만 뒤에 이어 붙인다.
  const CACHE_PATH = path.join(__dirname, 'archive-items.json');
  const cache = fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : [];
  // 예전에 캐시에 저장된 PC 링크도 모바일 링크로 바로잡는다(2026-09-28, noindex 문제 발견).
  cache.forEach((c) => { c.link = String(c.link).replace('https://blog.naver.com/', 'https://m.blog.naver.com/'); });
  const keyOf = (l) => String(l).split('?')[0];
  const knownKeys = new Set(cache.map((c) => keyOf(c.link)));
  const fresh = items.filter((it) => !knownKeys.has(keyOf(it.link)));
  let nextDay = cache.reduce((m, c) => Math.max(m, c.day), 0) + 1;
  fresh.forEach((it) => { it.day = nextDay++; it.displayTitle = displayTitleOf(it.title); });

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

  fresh.forEach((it) => {
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

  items = [...cache, ...fresh];
  fs.writeFileSync(CACHE_PATH, JSON.stringify(items.map((it) => ({ day: it.day, displayTitle: it.displayTitle, thumbnail: it.thumbnail, summary: it.summary, link: it.link })), null, 1));

  const missing = fresh.filter((it) => !it.summary);
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
<meta property="og:image" content="https://jessie5599.github.io/assets/og-image-v2.png">
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
  .brand{font-family:'Gowun Dodum',sans-serif;font-weight:700;font-size:21px;color:var(--navy);}
  .brand span{color:var(--teal);}
  .navlinks{display:flex;gap:24px;font-size:16px;font-weight:500;color:var(--navy);}
  .navlinks a{padding:6px 0;border-bottom:2px solid transparent;transition:border-color .2s;}
  .navlinks a:hover, .navlinks a.active{border-color:var(--orange);}
  .nav-cta{background:var(--orange);color:#fff;padding:9px 18px;border-radius:3px;font-size:16px;font-weight:600;white-space:nowrap;}
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
  .footer-inner{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-size:15px;}
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
  .k-day{display:inline-block;padding:3px 10px;border-radius:12px;font-size:13.5px;font-weight:700;background:var(--teal-soft);color:var(--teal);}
  .detail-head h1{font-size:24px;line-height:1.5;font-weight:600;}
  .detail-thumb{width:100%;max-width:420px;aspect-ratio:1/1;object-fit:cover;border-radius:8px;margin:24px auto;box-shadow:0 8px 24px rgba(27,42,65,0.12);background:var(--teal-soft);}
  .detail-summary{font-size:17.5px;line-height:1.8;color:var(--ink);padding:0 0 32px;}
  .detail-link{display:inline-block;margin:0 0 64px;font-size:16.5px;font-weight:600;color:#fff;background:var(--teal);padding:11px 20px;border-radius:4px;}
  .back-link{font-size:15.5px;color:var(--ink-soft);display:inline-block;flex-shrink:0;}
  .back-link-bottom{margin-top:24px;}
</style>
</head>
<body>
${HEADER}
<div class="wrap">
  <div class="detail-head">
    <div class="detail-head-top">
      <span class="k-day">Day ${it.day}</span>
      <a class="back-link" href="basic-knowledge.html">← 목록으로 돌아가기</a>
    </div>
    <h1>${esc(it.displayTitle)}</h1>
  </div>
  <img class="detail-thumb" src="${it.thumbnail}" referrerpolicy="no-referrer" loading="lazy" alt="${esc(altText)}">
  <p class="detail-summary">${esc(it.summary)}</p>
  <a class="detail-link" href="${it.link}" target="_blank" rel="noopener">네이버 블로그에서 전체 글 보기 →</a>
  <div><a class="back-link back-link-bottom" href="basic-knowledge.html">← 목록으로 돌아가기</a></div>
</div>
${FOOTER}
${NAV_SCRIPT}
</body>
</html>`;
    fs.writeFileSync(path.join(OUT_DIR, `${it.day}.html`), html, 'utf8');
  });

  // ---- 배경지식 한 스푼 목록 페이지 (basic-knowledge.html, basic-knowledge-2.html, ...) : 한 페이지 15개씩, 최신순 ----
  const PER_PAGE = 15;
  const sortedDesc = [...items].sort((a, b) => b.day - a.day);
  const totalPages = Math.max(1, Math.ceil(sortedDesc.length / PER_PAGE));
  const pageFile = (n) => (n === 1 ? 'basic-knowledge.html' : `basic-knowledge-${n}.html`);
  const listDesc = '옥길동·범박동·소사동 학생들을 위해 국어·영어 지문에 자주 나오는 배경지식을 정리한 아카이브입니다.';

  for (let pg = 1; pg <= totalPages; pg++) {
    const listRows = sortedDesc.slice((pg - 1) * PER_PAGE, pg * PER_PAGE).map((it) => {
      const label = `옥길동 영어학원 제씨영어입시학원 — 배경지식 한 스푼: ${it.displayTitle}`;
      return `      <li><a href="${it.day}.html"><span class="k-day">Day ${it.day}</span><span class="k-label">${esc(label)}</span></a></li>`;
    }).join('\n');

    let pager = '';
    if (totalPages > 1) {
      const parts = [];
      if (pg > 1) parts.push(`<a href="${pageFile(pg - 1)}" rel="prev">이전</a>`);
      for (let n = 1; n <= totalPages; n++) {
        parts.push(n === pg ? `<span class="cur" aria-current="page">${n}</span>` : `<a href="${pageFile(n)}">${n}</a>`);
      }
      if (pg < totalPages) parts.push(`<a href="${pageFile(pg + 1)}" rel="next">다음</a>`);
      pager = `\n<nav class="pager" aria-label="페이지 이동">${parts.join('')}</nav>`;
    }

    const listTitle = pg === 1 ? '배경지식 한 스푼 아카이브 | 제씨영어입시학원' : `배경지식 한 스푼 아카이브 (${pg}페이지) | 제씨영어입시학원`;
    const listCanonical = `https://jessie5599.github.io/archive/${pageFile(pg)}`;
    const listHtml = `<!doctype html>
<html lang="ko">
<head>
${SITE_HEAD(listTitle, listDesc, listCanonical)}
<style>
${SHARED_STYLE}
  .page-head{padding:40px 0 20px;}
  .page-head .eyebrow{color:var(--teal);font-weight:600;font-size:15px;letter-spacing:.03em;}
  .page-head h1{font-size:28px;line-height:1.4;font-weight:600;margin-top:8px;}
  .page-head p{color:var(--ink-soft);font-size:17px;margin-top:10px;}
  .back-link{font-size:15.5px;color:var(--ink-soft);display:inline-block;}
  .k-list{list-style:none;margin:0;padding:0 0 72px;border-top:1px solid var(--line);}
  .k-list li{border-bottom:1px solid var(--line);}
  .k-list a{display:flex;align-items:center;gap:12px;padding:14px 4px;font-size:16.5px;font-weight:500;color:var(--navy);transition:color .15s;}
  .k-list a:hover{color:var(--teal);}
  .k-list .k-day{flex-shrink:0;display:inline-block;padding:3px 10px;border-radius:12px;font-size:13.5px;font-weight:700;background:var(--teal-soft);color:var(--teal);}
  .k-list .k-label{flex:1;}
  .pager{display:flex;justify-content:center;flex-wrap:wrap;gap:6px;padding:0 0 72px;}
  .pager a,.pager span{min-width:36px;padding:8px 12px;text-align:center;border:1px solid var(--line);border-radius:6px;font-size:16px;background:var(--paper);color:var(--navy);}
  .pager a:hover{border-color:var(--teal);color:var(--teal);}
  .pager .cur{background:var(--teal);border-color:var(--teal);color:#fff;font-weight:700;}
</style>
</head>
<body>
${HEADER}
<section class="page-head">
  <div class="wrap">
    <a class="back-link" href="../archive.html">← 아카이브 홈으로</a>
    <span class="eyebrow" style="display:block;margin-top:16px;">ARCHIVE</span>
    <h1>배경지식 한 스푼 아카이브</h1>
    <p>지문마다 자주 나오는 배경지식을 하나씩 정리했습니다. 제목을 누르면 자세한 설명을 볼 수 있어요.</p>
  </div>
</section>
<section class="wrap">
  <ul class="k-list"${totalPages > 1 ? ' style="padding-bottom:32px"' : ''}>
${listRows}
  </ul>${pager}
</section>
${FOOTER}
${NAV_SCRIPT}
</body>
</html>`;
    fs.writeFileSync(path.join(OUT_DIR, pageFile(pg)), listHtml, 'utf8');
  }

  // ---- 아카이브 허브 페이지 (archive.html, 사이트 루트) — 4개 시리즈 카테고리 선택 화면 ----
  const CATEGORIES = [
    {
      name: '배경지식 한 스푼',
      desc: '국어·영어 지문에 자주 나오는 배경지식을 하나씩 정리했어요.',
      href: 'archive/basic-knowledge.html',
      count: `${items.length}편`,
      ready: true,
    },
    {
      name: '낯선단어 쪼개보기',
      desc: '낯선 영단어를 어원(뿌리)으로 쪼개서 뜻을 추론해보는 시리즈예요.',
      href: 'archive/word-breakdown.html',
      count: '7편',
      ready: true,
    },
    {
      name: '쏙쏙어법 한 조각',
      desc: '중등부터 수능까지 이어지는 어법 포인트를 하나씩 짚어보는 시리즈예요.',
      href: 'archive/soksok-grammar.html',
      count: '7편',
      ready: true,
    },
    {
      name: '거친구문 길들이기',
      desc: '도치·생략처럼 날뛰는 구문을 붙잡아 뜯어서 설명하는 시리즈예요.',
      href: 'archive/rough-syntax.html',
      count: '7편',
      ready: true,
    },
  ];

  const hubCards = CATEGORIES.map((c) => {
    const inner = `<div class="hub-card-top"><h3>${esc(c.name)}</h3><span class="hub-count${c.ready ? '' : ' hub-count-soon'}">${esc(c.count)}</span></div><p class="hub-desc">${esc(c.desc)}</p>`;
    return c.ready
      ? `      <a class="hub-card" href="${c.href}">${inner}</a>`
      : `      <div class="hub-card hub-card-disabled">${inner}</div>`;
  }).join('\n');

  const hubTitle = '콘텐츠 아카이브 | 제씨영어입시학원';
  const hubDesc = '배경지식 한 스푼, 낯선단어 쪼개보기, 쏙쏙어법 한 조각, 거친구문 길들이기 시리즈를 모아뒀습니다.';
  const hubCanonical = 'https://jessie5599.github.io/archive.html';
  const hubHtml = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(hubTitle)}</title>
<meta name="description" content="${esc(hubDesc)}">
<link rel="canonical" href="${hubCanonical}">
<link rel="icon" type="image/png" href="assets/favicon.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="제씨영어입시학원">
<meta property="og:title" content="${esc(hubTitle)}">
<meta property="og:description" content="${esc(hubDesc)}">
<meta property="og:url" content="${hubCanonical}">
<meta property="og:image" content="https://jessie5599.github.io/assets/og-image-v2.png">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>
${SHARED_STYLE.replace(/\.\.\//g, '')}
  .page-head{padding:48px 0 24px;}
  .page-head .eyebrow{color:var(--teal);font-weight:600;font-size:15px;letter-spacing:.03em;}
  .page-head h1{font-size:30px;line-height:1.4;font-weight:600;margin-top:8px;}
  .page-head p{color:var(--ink-soft);font-size:17px;margin-top:10px;}
  .hub-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;padding:8px 0 72px;}
  @media(max-width:640px){ .hub-grid{grid-template-columns:1fr;} }
  .hub-card{
    display:block;background:var(--paper);border:1px solid var(--line);border-radius:8px;
    padding:22px;transition:box-shadow .2s, transform .2s;
  }
  a.hub-card:hover{box-shadow:0 10px 24px rgba(27,42,65,0.09);transform:translateY(-2px);}
  .hub-card-disabled{opacity:.6;}
  .hub-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
  .hub-card h3{font-size:19px;font-weight:600;}
  .hub-count{flex-shrink:0;font-size:13.5px;font-weight:700;padding:3px 10px;border-radius:12px;background:var(--teal-soft);color:var(--teal);}
  .hub-count-soon{background:var(--line);color:var(--ink-soft);}
  .hub-desc{font-size:15.5px;color:var(--ink-soft);line-height:1.6;margin:0;}
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
    <h1>콘텐츠 아카이브</h1>
    <p>제씨영어입시학원이 꾸준히 쌓아가는 시리즈들을 카테고리별로 모아뒀어요. 카드를 누르면 해당 시리즈 목록으로 이동합니다.</p>
  </div>
</section>
<section class="wrap">
  <div class="hub-grid">
${hubCards}
  </div>
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

  fs.writeFileSync(path.join(SITE_ROOT, 'archive.html'), hubHtml, 'utf8');

  // ---- sitemap.xml 갱신: 기존 항목은 보존하고 아카이브 URL만 다시 씀 ----
  const sitemapPath = path.join(SITE_ROOT, 'sitemap.xml');
  const existing = fs.readFileSync(sitemapPath, 'utf8');
  const nonArchiveUrls = (existing.match(/<url>[\s\S]*?<\/url>/g) || [])
    .filter((u) => !u.includes('/archive'));
  const archiveUrls = [
    `  <url>\n    <loc>https://jessie5599.github.io/archive.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/basic-knowledge.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ...Array.from({ length: totalPages - 1 }, (_, i) => `  <url>\n    <loc>https://jessie5599.github.io/archive/basic-knowledge-${i + 2}.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`),
    ...items.map((it) => `  <url>\n    <loc>https://jessie5599.github.io/archive/${it.day}.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`),
    // 낯선단어 쪼개보기 시리즈 — 이 스크립트가 관리하는 게 아니라 수동으로 만든 페이지지만,
    // sitemap 재생성이 "/archive" 포함 항목을 전부 지우고 다시 쓰기 때문에 여기서 같이 챙겨야 안 없어진다.
    `  <url>\n    <loc>https://jessie5599.github.io/archive/word-breakdown.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/word-breakdown-1.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/word-breakdown-2.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/word-breakdown-3.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/word-breakdown-4.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/word-breakdown-5.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>
    <loc>https://jessie5599.github.io/archive/word-breakdown-6.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
    `  <url>
    <loc>https://jessie5599.github.io/archive/word-breakdown-7.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
    // 쏙쏙어법 한 조각 시리즈 — 마찬가지로 수동으로 만든 페이지, sitemap 재생성 시 같이 챙겨야 안 없어진다.
    `  <url>\n    <loc>https://jessie5599.github.io/archive/soksok-grammar.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/soksok-grammar-1.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/soksok-grammar-2.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/soksok-grammar-3.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/soksok-grammar-4.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/soksok-grammar-5.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>
    <loc>https://jessie5599.github.io/archive/soksok-grammar-6.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
    `  <url>
    <loc>https://jessie5599.github.io/archive/soksok-grammar-7.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
    // 거친구문 길들이기 시리즈 — 마찬가지로 수동으로 만든 페이지, sitemap 재생성 시 같이 챙겨야 안 없어진다.
    `  <url>\n    <loc>https://jessie5599.github.io/archive/rough-syntax.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/rough-syntax-1.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/rough-syntax-2.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/rough-syntax-3.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/rough-syntax-4.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>\n    <loc>https://jessie5599.github.io/archive/rough-syntax-5.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    `  <url>
    <loc>https://jessie5599.github.io/archive/rough-syntax-6.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
    `  <url>
    <loc>https://jessie5599.github.io/archive/rough-syntax-7.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${nonArchiveUrls.join('\n')}\n${archiveUrls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');

  console.log('완료:', items.length, '개 상세 페이지 + 목록 페이지 1개 + 허브 페이지 1개 + sitemap.xml 갱신');
}

main().catch((err) => { console.error(err); process.exit(1); });
