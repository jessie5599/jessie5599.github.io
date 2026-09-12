const fs = require('fs');

const CATEGORY_LABEL = {
  '제씨영어소식': '제씨영어소식',
  '고등부': '고등부',
  '중등부': '중등부',
  '지식한스푼': '배경지식 한 스푼',
};
const CATEGORY_ORDER = ['제씨영어소식', '고등부', '중등부', '지식한스푼'];

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

function extractExcerpt(description) {
  let text = description.replace(/<img[^>]*>/g, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text).replace(/\s+/g, ' ').trim();
  if (text.length > 90) text = text.slice(0, 90).trim() + '...';
  return text;
}

async function main() {
  const res = await fetch('https://rss.blog.naver.com/jessie5599.xml');
  if (!res.ok) throw new Error('RSS fetch failed: ' + res.status);
  const xml = await res.text();

  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const items = itemBlocks.map((block) => {
    const description = getTag(block, 'description');
    return {
      category: getTag(block, 'category').replace(/^[■□]\s*/, ''),
      title: getTag(block, 'title'),
      link: getTag(block, 'link'),
      pubDate: getTag(block, 'pubDate'),
      thumbnail: extractThumbnail(description),
      excerpt: extractExcerpt(description),
    };
  });

  const picked = [];
  for (const key of CATEGORY_ORDER) {
    const found = items.find((it) => it.category === key);
    if (found) {
      picked.push({ label: CATEGORY_LABEL[key], title: cleanTitle(found.title), link: found.link });
    }
  }

  if (picked.length === 0) {
    throw new Error('No matching categories found in feed — check category names in the RSS');
  }

  const archive = items
    .filter((it) => CATEGORY_LABEL[it.category])
    .map((it) => ({
      label: CATEGORY_LABEL[it.category],
      title: cleanTitle(it.title),
      link: it.link,
      pubDate: it.pubDate,
      thumbnail: it.thumbnail,
      excerpt: it.excerpt,
    }))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  fs.writeFileSync(
    'blog-feed.json',
    JSON.stringify({ updatedAt: new Date().toISOString(), items: picked, archive }, null, 2) + '\n'
  );
  console.log('Wrote blog-feed.json with', picked.length, 'teaser items and', archive.length, 'archive items');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
