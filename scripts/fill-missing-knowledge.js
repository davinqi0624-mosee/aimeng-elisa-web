const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MISSING_DATES = ['2026-05-05', '2026-05-06', '2026-05-08', '2026-05-09'];
const SITE_URL = process.env.SITE_URL || 'https://aimeng-elisa-web.vercel.app';

async function generateArticle(date) {
  const res = await fetch(`${SITE_URL}/api/knowledge/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  });
  const data = await res.json();
  if (!data.success || !data.article) {
    throw new Error(`Generate failed for ${date}: ${data.error || 'unknown'}`);
  }
  return data.article;
}

function extractContent(article) {
  let content = article.content;
  // Sometimes the AI returns nested JSON inside content
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    try {
      const nested = JSON.parse(content);
      if (nested.content) {
        content = nested.content;
      }
      // Prefer nested title/category if present
      if (nested.title) article.title = nested.title;
      if (nested.category) article.category = nested.category;
      if (nested.tags) article.tags = nested.tags;
      if (nested.summary) article.summary = nested.summary;
    } catch {
      // not valid JSON, keep as-is
    }
  }
  return { ...article, content };
}

async function insertArticle(article) {
  const { error } = await supabase.from('daily_knowledge').insert({
    date: article.publish_date,
    title: article.title,
    summary: article.summary || '',
    content: article.content,
    category: article.category || '操作技巧',
    tags: Array.isArray(article.tags) ? article.tags : ['ELISA', '实验技巧'],
    quality_score: 0.75,
    source_type: 'ai_generated',
    lifecycle_status: 'active',
    is_published: true,
    is_featured: false,
  });

  if (error) {
    throw new Error(`Insert failed: ${error.message}`);
  }
}

async function main() {
  for (const date of MISSING_DATES) {
    try {
      console.log(`Generating for ${date}...`);
      const raw = await generateArticle(date);
      const article = extractContent(raw);
      console.log(`  -> ${article.title}`);
      await insertArticle(article);
      console.log(`  -> Saved to daily_knowledge`);
    } catch (err) {
      console.error(`  -> ERROR: ${err.message}`);
    }
  }
}

main();
