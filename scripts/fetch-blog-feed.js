const fs = require('fs');

const CATEGORY_LABEL = {
  '제씨영어소식': '제씨영어소식',
  '고등부': '고등부',
  '중등부': '중등부',
  '지식한스푼': '배경지식 한 스푼',
  '배경지식한스푼': '배경지식 한 스푼',
};
const CATEGORY_ORDER = ['제씨영어소식', '고등부', '중등부', '지식한스푼', '배경지식한스푼'];

function cleanTitle(title) {
  title = title.replace(/^[^|]*\|\s*/, '');
  title = title.replace(/_옥길동[^_]*$/, '');
  return title.trim();
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
  return m ? decodeEntities(m[1].trim()) : '';
}

function extractThumbnail(description) {
  const m = description.match(/<img[^>]+src="([^"]+)"/);
  return m ? m[1] : '';
}

async function main() {
  const res = await fetch('https://rss.blog.naver.com/jessie5599.xml');
  if (!res.ok) throw new Error('RSS fetch failed: ' + res.status);
  const xml = await res.text();

  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const items = itemBlocks.map((block) => ({
    category: getTag(block, 'category').replace(/^[■□●]\s*/, ''),
    title: getTag(block, 'title'),
    // PC 버전(blog.naver.com)은 네이버가 noindex를 걸어두고 모바일(m.blog.naver.com)만 index라서, 링크는 항상 모바일로 바꿔 건다.
    link: getTag(block, 'link').replace('https://blog.naver.com/', 'https://m.blog.naver.com/'),
    pubDate: getTag(block, 'pubDate'),
    thumbnail: extractThumbnail(getTag(block, 'description')),
  }));

  const picked = [];
  const pickedLabels = new Set();
  for (const key of CATEGORY_ORDER) {
    const label = CATEGORY_LABEL[key];
    if (pickedLabels.has(label)) continue;
    const found = items.find((it) => it.category === key);
    if (found) {
      picked.push({ label, title: cleanTitle(found.title), link: found.link, thumbnail: found.thumbnail });
      pickedLabels.add(label);
    }
  }

  // 네이버 RSS 는 최근 글 50개만 준다. 시리즈 글이 매일 쌓이면 제씨영어소식·고등부·중등부처럼 가끔 올라오는
  // 카테고리의 글이 50개 밖으로 밀려나 카드가 통째로 사라진다(2026-10-30 중등부 카드가 이렇게 사라짐).
  // RSS 에서 못 찾은 카테고리는 이전 blog-feed.json 의 카드를 그대로 유지한다.
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync('blog-feed.json', 'utf8')).items || []; } catch (e) {}
  for (const key of CATEGORY_ORDER) {
    const label = CATEGORY_LABEL[key];
    if (pickedLabels.has(label)) continue;
    const old = prev.find((p) => p.label === label);
    if (old) {
      picked.push(old);
      pickedLabels.add(label);
      console.log('RSS 에 없어 이전 카드 유지:', label, '|', old.title);
    }
  }
  // 카드 순서는 CATEGORY_ORDER 기준으로 정렬한다(유지된 카드가 뒤로 밀리지 않게).
  const order = [...new Set(CATEGORY_ORDER.map((k) => CATEGORY_LABEL[k]))];
  picked.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

  if (picked.length === 0) {
    throw new Error('No matching categories found in feed — check category names in the RSS');
  }

  fs.writeFileSync(
    'blog-feed.json',
    JSON.stringify({ updatedAt: new Date().toISOString(), items: picked }, null, 2) + '\n'
  );
  console.log('Wrote blog-feed.json with', picked.length, 'items');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
