/**
 * AnnonceCI — Script GitHub Actions
 * Poste automatiquement les annonces sur Jiji, Ivoiredomi et Moboo
 */

const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

const ANNONCES = JSON.parse(fs.readFileSync('./annonces.json', 'utf8'));

const COMPTES = {
  jiji:       { email: process.env.JIJI_EMAIL,        password: process.env.JIJI_PASSWORD },
  ivoiredomi: { email: process.env.IVOIREDOMI_EMAIL,  password: process.env.IVOIREDOMI_PASSWORD },
  moboo:      { email: process.env.MOBOO_EMAIL,       password: process.env.MOBOO_PASSWORD },
};

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeIn(page, selector, text) {
  try {
    await page.waitForSelector(selector, { timeout: 8000 });
    await page.click(selector, { clickCount: 3 });
    await page.type(selector, String(text), { delay: 40 });
    return true;
  } catch(e) {
    console.log(`  ⚠️  Champ introuvable: ${selector}`);
    return false;
  }
}

async function screenshot(page, name) {
  try {
    await page.screenshot({ path: `screenshot-${name}.png`, fullPage: false });
    console.log(`  📸 Screenshot: screenshot-${name}.png`);
  } catch(e) {}
}

// ─── JIJI ────────────────────────────────────────────────────────────────────
async function posterJiji(page, annonce) {
  console.log('\n  🌐 JIJI.CO.CI');
  await page.goto('https://jiji.co.ci/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000);
  await screenshot(page, 'jiji-login');

  await typeIn(page, 'input[type="email"], input[name="email"]', COMPTES.jiji.email);
  await typeIn(page, 'input[type="password"]', COMPTES.jiji.password);
  try { await page.click('button[type="submit"]'); } catch(e) {}
  await wait(3000);

  await page.goto('https://jiji.co.ci/post-ad', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000);
  await screenshot(page, 'jiji-post-form');

  const desc = annonce.description || `${annonce.type_bien} à ${annonce.type_transaction.toLowerCase()} · ${annonce.ville} ${annonce.quartier} · ${annonce.surface}m² · ${annonce.pieces} pièces · Tél: ${annonce.tel}`;

  await typeIn(page, '[name="title"], [placeholder*="titre" i], [placeholder*="title" i]', annonce.titre);
  await typeIn(page, '[name="price"], [placeholder*="prix" i], [placeholder*="price" i]', annonce.prix);
  await typeIn(page, 'textarea[name="description"], textarea', desc);
  await typeIn(page, '[name="phone"], [placeholder*="phone" i], [placeholder*="tél" i]', annonce.tel);

  await screenshot(page, 'jiji-filled');
  try {
    await page.click('button[type="submit"]');
    await wait(4000);
    console.log('  ✅ Annonce soumise sur Jiji');
  } catch(e) {
    console.log('  ⚠️  Soumission Jiji à vérifier dans les screenshots');
  }
  await screenshot(page, 'jiji-result');
}

// ─── IVOIREDOMI ──────────────────────────────────────────────────────────────
async function posterIvoiredomi(page, annonce) {
  console.log('\n  🌐 IVOIREDOMI.CI');
  const loginUrls = ['https://ivoiredomi.ci/connexion', 'https://ivoiredomi.ci/login'];
  for (const url of loginUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(1500);
      break;
    } catch(e) {}
  }
  await screenshot(page, 'ivoire-login');

  await typeIn(page, 'input[type="email"], input[name="email"]', COMPTES.ivoiredomi.email);
  await typeIn(page, 'input[type="password"]', COMPTES.ivoiredomi.password);
  try { await page.click('button[type="submit"]'); } catch(e) {}
  await wait(3000);

  const postUrls = ['https://ivoiredomi.ci/deposer-annonce', 'https://ivoiredomi.ci/poster-annonce', 'https://ivoiredomi.ci/annonce/new'];
  for (const url of postUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(1500);
      break;
    } catch(e) {}
  }
  await screenshot(page, 'ivoire-form');

  const desc = annonce.description || `${annonce.type_bien} · ${annonce.ville} ${annonce.quartier} · ${annonce.surface}m² · ${annonce.prix} FCFA · Tél: ${annonce.tel}`;

  await typeIn(page, '[name="title"], [name="titre"]', annonce.titre);
  await typeIn(page, '[name="price"], [name="prix"]', annonce.prix);
  await typeIn(page, 'textarea[name="description"], textarea', desc);
  await typeIn(page, '[name="phone"], [name="telephone"]', annonce.tel);

  await screenshot(page, 'ivoire-filled');
  try {
    await page.click('button[type="submit"]');
    await wait(4000);
    console.log('  ✅ Annonce soumise sur Ivoiredomi');
  } catch(e) {
    console.log('  ⚠️  Soumission Ivoiredomi à vérifier');
  }
  await screenshot(page, 'ivoire-result');
}

// ─── MOBOO ───────────────────────────────────────────────────────────────────
async function posterMoboo(page, annonce) {
  console.log('\n  🌐 MOBOO.CI');
  const loginUrls = ['https://moboo.ci/login', 'https://moboo.ci/connexion'];
  for (const url of loginUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(1500);
      break;
    } catch(e) {}
  }
  await screenshot(page, 'moboo-login');

  await typeIn(page, 'input[type="email"], input[name="email"]', COMPTES.moboo.email);
  await typeIn(page, 'input[type="password"]', COMPTES.moboo.password);
  try { await page.click('button[type="submit"]'); } catch(e) {}
  await wait(3000);

  const postUrls = ['https://moboo.ci/deposer-annonce', 'https://moboo.ci/annonce/new', 'https://moboo.ci/poster'];
  for (const url of postUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(1500);
      break;
    } catch(e) {}
  }
  await screenshot(page, 'moboo-form');

  const desc = annonce.description || `${annonce.type_bien} · ${annonce.ville} ${annonce.quartier} · ${annonce.surface}m² · ${annonce.prix} FCFA · Tél: ${annonce.tel}`;

  await typeIn(page, '[name="title"], [name="titre"]', annonce.titre);
  await typeIn(page, '[name="price"], [name="prix"]', annonce.prix);
  await typeIn(page, 'textarea', desc);
  await typeIn(page, '[name="phone"], [name="telephone"]', annonce.tel);

  await screenshot(page, 'moboo-filled');
  try {
    await page.click('button[type="submit"]');
    await wait(4000);
    console.log('  ✅ Annonce soumise sur Moboo');
  } catch(e) {
    console.log('  ⚠️  Soumission Moboo à vérifier');
  }
  await screenshot(page, 'moboo-result');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🏠 AnnonceCI — ${ANNONCES.length} annonce(s) à publier\n`);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  let success = 0, errors = 0;

  for (let i = 0; i < ANNONCES.length; i++) {
    const annonce = ANNONCES[i];
    console.log(`\n📌 Annonce ${i+1}/${ANNONCES.length} : "${annonce.titre}"`);

    for (const site of annonce.sites) {
      try {
        if (site === 'jiji')        await posterJiji(page, annonce);
        if (site === 'ivoiredomi') await posterIvoiredomi(page, annonce);
        if (site === 'moboo')      await posterMoboo(page, annonce);
        success++;
      } catch(err) {
        console.log(`  ❌ Erreur sur ${site}: ${err.message}`);
        errors++;
      }
      await wait(2000);
    }
  }

  console.log(`\n✅ Terminé ! ${success} publication(s) réussie(s), ${errors} erreur(s).`);
  await browser.close();
})();
