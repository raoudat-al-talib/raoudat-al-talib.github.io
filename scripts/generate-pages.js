// ==================================================
// سكريبت توليد صفحات SEO لكل كتاب + خريطة الموقع
// يعمل تلقائياً عبر GitHub Actions (بدون أي تدخل يدوي)
// ==================================================

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SITE_URL = 'https://raoudat-al-talib.github.io';
const OUT_DIR = path.join(__dirname, '..', 'book');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function fetchAllBooks() {
  const snapshot = await db.collection('books').get();
  const books = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    books.push({
      id: d.id || 0,
      title: d.title || '',
      author: d.author || '',
      publisher: d.publisher || '',
      price: d.price || 0,
      description: d.description || '',
      authorBio: d.authorBio || '',
      hasCoverBase64: !!d.coverBase64,
    });
  });
  return books;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}

function buildPageHtml(book) {
  const title = escapeHtml(book.title);
  const author = escapeHtml(book.author);
  const publisher = escapeHtml(book.publisher);
  const priceText = (book.price || 0).toLocaleString('ar');
  const description = book.description
    ? escapeHtml(book.description)
    : `كتاب ${title} للمؤلف ${author} متوفر الآن في مكتبة روضة الطالب بسعر ${priceText} دج. اطلبه مباشرة عبر واتساب.`;

  const coverSrc = book.hasCoverBase64 ? null : `../${book.id}.jpg`;
  const waMessage = encodeURIComponent(`أريد طلب كتاب: ${book.title} بسعر ${book.price} دج`);
  const waLink = `https://wa.me/213770664417?text=${waMessage}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - مكتبة روضة الطالب</title>
<meta name="description" content="${escapeHtml(description).slice(0, 160)}">
<link rel="canonical" href="${SITE_URL}/book/${book.id}/">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${escapeHtml(description).slice(0, 160)}">
<meta property="og:type" content="product">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": ${JSON.stringify(book.title)},
  "author": { "@type": "Person", "name": ${JSON.stringify(book.author)} },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "DZD",
    "price": ${book.price || 0},
    "availability": "https://schema.org/InStock"
  }
}
</script>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>* { font-family: 'Tajawal', sans-serif; }</style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-sm border border-slate-100 max-w-md w-full p-6">
    <a href="${SITE_URL}/" class="text-teal-600 text-sm font-bold mb-4 inline-block">→ العودة لكل الكتب</a>
    ${coverSrc ? `<img src="${coverSrc}" alt="${title}" class="w-32 h-44 object-cover rounded-lg mx-auto mb-4 border border-teal-100" onerror="this.style.display='none'">` : ''}
    <h1 class="font-extrabold text-lg text-slate-800 mb-1">${title}</h1>
    <p class="text-sm text-slate-500 mb-1">المؤلف: ${author}</p>
    <p class="text-xs text-teal-600 mb-3">دار النشر: ${publisher}</p>
    <p class="font-extrabold text-teal-700 text-xl mb-4">${priceText} دج</p>
    ${book.description ? `<p class="text-sm text-slate-600 leading-relaxed mb-4">${description}</p>` : ''}
    <a href="${waLink}" target="_blank" rel="noopener" class="block text-center bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-lg transition">طلب عبر واتساب</a>
  </div>
</body>
</html>`;
}

function buildSitemap(books) {
  const urls = books.map(b => `  <url><loc>${SITE_URL}/book/${b.id}/</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc></url>
${urls}
</urlset>`;
}

async function main() {
  console.log('جلب الكتب من Firestore...');
  const books = await fetchAllBooks();
  console.log(`تم جلب ${books.length} كتاب`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  books.forEach(book => {
    if (!book.id) return;
    const dir = path.join(OUT_DIR, String(book.id));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildPageHtml(book), 'utf-8');
  });

  const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
  fs.writeFileSync(sitemapPath, buildSitemap(books), 'utf-8');

  console.log(`تم توليد ${books.length} صفحة + خريطة الموقع بنجاح ✅`);
}

main().catch(err => {
  console.error('فشل التوليد:', err);
  process.exit(1);
});
