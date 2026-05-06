/**
 * AnnonceCI — Script GitHub Actions v3
 * Corrections ciblées par site selon analyse des logs
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

async function waitForAny(page, selectors, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) return { el, sel };
      } catch(e) {}
    }
    await wait(600);
  }
  return null;
}

async function typeIn(page, selectors, text) {
  const sels = Array.isArray(selectors) ? selectors : [selectors];
  const found = await waitForAny(page, sels, 15000);
  if (!found) { console.log(`  ⚠️  Champ introuvable: ${sels[0]}`); return false; }
  try {
    await page.click(found.sel, { clickCount: 3 });
    await page.type(found.sel, String(text), { delay: 40 });
    console.log(`  ✓ Champ rempli: ${found.sel}`);
    return true;
  } catch(e) { console.log(`  ⚠️  Erreur remplissage: ${found.sel}`); return false; }
}

async function clickAny(page, selectors, timeout = 10000) {
  const sels = Array.isArray(selectors) ? selectors : [selectors];
  const found = await waitForAny(page, sels, timeout);
  if (!found) return false;
  try { await page.click(found.sel); console.log(`  ✓ Cliqué: ${found.sel}`); return true; }
  catch(e) { return false; }
}

async function screenshot(page, name) {
  try {
    await page.screenshot({ path: `screenshot-${name}.png`, fullPage: false });
    const html = await page.content();
    const inputs = html.match(/<input[^>]*>/gi) || [];
    console.log(`  📸 ${name} — ${inputs.length} input(s)`);
    inputs.slice(0, 6).forEach(inp => {
      const type = (inp.match(/type="([^"]*)"/) || [])[1] || '?';
      const name = (inp.match(/name="([^"]*)"/) || [])[1] || '';
      const placeholder = (inp.match(/placeholder="([^"]*)"/) || [])[1] || '';
      if (type !== 'hidden') console.log(`      → type=${type} name=${name} placeholder=${placeholder}`);
    });
  } catch(e) {}
}

async function uploadPhotos(page, photos) {
  if (!photos || !photos.length) return;
  const fichiers = photos.filter(p => fs.existsSync(p));
  if (!fichiers.length) return;
  try {
    await page.evaluate(() => {
      document.querySelectorAll('input[type="file"]').forEach(i => {
        i.style.cssText = 'display:block!important;opacity:1!important;position:relative!important;z-index:9999!important';
      });
    });
    await wait(500);
    const input = await page.$('input[type="file"]');
    if (input) { await input.uploadFile(...fichiers); await wait(2000); console.log(`  ✅ ${fichiers.length} photo(s) uploadée(s)`); }
  } catch(e) { console.log(`  ⚠️  Upload photos échoué`); }
}

// ─── JIJI — Contournement Cloudflare ─────────────────────────────────────────
// Jiji utilise Cloudflare Turnstile qui bloque les bots.
// Solution : on attend longuement que le challenge se résolve automatiquement,
// et on utilise des headers réalistes pour passer pour un vrai navigateur.
async function posterJiji(page, annonce) {
  console.log('\n  🌐 JIJI.CO.CI');

  // Headers ultra réalistes pour tromper Cloudflare
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
  });

  // D'abord visiter la page d'accueil pour établir les cookies
  console.log('  → Visite de la page d\'accueil pour établir les cookies...');
  await page.goto('https://jiji.co.ci', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(5000);

  // Ensuite la page de login
  await page.goto('https://jiji.co.ci/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(8000); // Attente longue pour le challenge Cloudflare
  await screenshot(page, 'jiji-login');

  // Chercher le formulaire avec beaucoup de patience
  const emailOk = await typeIn(page, [
    'input[type="email"]', 'input[name="email"]', 'input[name="session[email]"]',
    'input[id="email"]', 'input[placeholder*="email" i]', 'input[placeholder*="mail" i]',
  ], COMPTES.jiji.email);

  const passOk = await typeIn(page, [
    'input[type="password"]', 'input[name="password"]', 'input[name="session[password]"]',
  ], COMPTES.jiji.password);

  if (!emailOk) {
    console.log('  ❌ Jiji bloque l\'accès via Cloudflare — ce site est difficile à automatiser.');
    console.log('  💡 Conseil : poste manuellement sur Jiji, utilise Ivoiredomi et Moboo pour l\'automatisation.');
    return;
  }

  await clickAny(page, ['button[type="submit"]', 'input[type="submit"]', 'button.btn-primary']);
  await wait(4000);

  await page.goto('https://jiji.co.ci/post-ad', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(5000);
  await screenshot(page, 'jiji-post-form');

  const desc = annonce.description || `${annonce.type_bien} · ${annonce.ville} ${annonce.quartier} · ${annonce.prix} FCFA · Tél: ${annonce.tel}`;

  await typeIn(page, ['input[name="title"]', 'input[name="ad[title]"]', 'input[placeholder*="titre" i]', 'input[placeholder*="title" i]'], annonce.titre);
  await typeIn(page, ['input[name="price"]', 'input[name="ad[price]"]', 'input[placeholder*="prix" i]', 'input[placeholder*="price" i]'], annonce.prix);
  await typeIn(page, ['textarea[name="description"]', 'textarea[name="ad[description]"]', 'textarea[placeholder*="description" i]', 'textarea'], desc);
  await typeIn(page, ['input[name="phone"]', 'input[name="ad[phone]"]', 'input[type="tel"]', 'input[placeholder*="phone" i]'], annonce.tel);
  await uploadPhotos(page, annonce.photos);

  await screenshot(page, 'jiji-filled');
  const submitted = await clickAny(page, ['button[type="submit"]', 'input[type="submit"]', 'button.btn-primary', 'button[class*="submit"]']);
  await wait(5000);
  await screenshot(page, 'jiji-result');
  if (submitted) console.log('  ✅ Annonce soumise sur Jiji');
}

// ─── IVOIREDOMI — Login avec username + redirection correcte ─────────────────
// Ivoiredomi utilise WordPress (Houzez theme) : champ "username" pas "email"
// Après login réussi il faut naviguer vers la page de dépôt d'annonce
async function posterIvoiredomi(page, annonce) {
  console.log('\n  🌐 IVOIREDOMI.CI');
  await page.goto('https://ivoiredomi.ci/connexion', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(4000);
  await screenshot(page, 'ivoiredomi-login');

  // Ivoiredomi = WordPress/Houzez : champ "username" (pas email)
  await typeIn(page, [
    'input[name="username"]',
    'input[name="log"]',
    'input[id="username"]',
    'input[placeholder*="utilisateur" i]',
    'input[placeholder*="email" i]',
  ], COMPTES.ivoiredomi.email);

  await typeIn(page, [
    'input[type="password"]',
    'input[name="password"]',
    'input[name="pwd"]',
  ], COMPTES.ivoiredomi.password);

  await clickAny(page, [
    'button[type="submit"]', 'input[type="submit"]',
    'button.btn-primary', '.houzez-login-btn',
    'input[name="wp-submit"]',
  ]);
  await wait(5000);
  await screenshot(page, 'ivoiredomi-apres-login');

  // Aller directement sur la page de soumission d'annonce
  const postUrls = [
    'https://ivoiredomi.ci/deposer-une-annonce',
    'https://ivoiredomi.ci/deposer-annonce',
    'https://ivoiredomi.ci/submit-property',
    'https://ivoiredomi.ci/soumettre-une-propriete',
    'https://ivoiredomi.ci/ajouter-annonce',
  ];

  let formTrouve = false;
  for (const url of postUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(4000);
      await screenshot(page, `ivoiredomi-form-${url.split('/').pop()}`);
      const html = await page.content();
      // Vérifier qu'on est bien sur un formulaire d'annonce
      if (html.includes('title') && html.includes('price') || html.includes('prix') || html.includes('property')) {
        console.log(`  ✓ Formulaire trouvé sur: ${url}`);
        formTrouve = true;
        break;
      }
    } catch(e) {}
  }

  if (!formTrouve) {
    console.log('  ⚠️  Page de dépôt d\'annonce introuvable — vérifier les screenshots');
  }

  const desc = annonce.description || `${annonce.type_bien} · ${annonce.ville} ${annonce.quartier} · ${annonce.prix} FCFA · Tél: ${annonce.tel}`;

  await typeIn(page, [
    'input[name="title"]', 'input[name="fave_title"]', 'input[name="property_title"]',
    'input[id="title"]', 'input[placeholder*="titre" i]', 'input[placeholder*="title" i]',
  ], annonce.titre);

  await typeIn(page, [
    'input[name="price"]', 'input[name="fave_property_price"]', 'input[name="property_price"]',
    'input[id="price"]', 'input[placeholder*="prix" i]', 'input[placeholder*="price" i]',
  ], annonce.prix);

  await typeIn(page, [
    'textarea[name="description"]', 'textarea[name="fave_property_description"]',
    'textarea[id="description"]', 'textarea[placeholder*="description" i]', 'textarea',
  ], desc);

  await typeIn(page, [
    'input[name="phone"]', 'input[name="fave_property_agent_display_option"]',
    'input[name="mobile"]', 'input[type="tel"]',
    'input[placeholder*="téléphone" i]', 'input[placeholder*="phone" i]',
  ], annonce.tel);

  await uploadPhotos(page, annonce.photos);
  await screenshot(page, 'ivoiredomi-filled');

  const submitted = await clickAny(page, [
    'button[type="submit"]', 'input[type="submit"]',
    'button.btn-primary', 'button[name="submit"]',
    'input[name="submit"]', 'button[class*="submit"]',
    'button[class*="publish"]',
  ]);
  await wait(5000);
  await screenshot(page, 'ivoiredomi-result');
  if (submitted) console.log('  ✅ Annonce soumise sur Ivoiredomi');
}

// ─── MOBOO — Attente longue pour React/Vue ────────────────────────────────────
// Moboo charge tout en JavaScript (0 inputs détectés) — framework SPA
// Solution : attendre beaucoup plus longtemps + utiliser waitForSelector
async function posterMoboo(page, annonce) {
  console.log('\n  🌐 MOBOO.CI');

  await page.goto('https://moboo.ci', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(5000);

  // Trouver la page de login
  const loginUrls = ['https://moboo.ci/login', 'https://moboo.ci/connexion', 'https://moboo.ci/se-connecter', 'https://moboo.ci/auth/login'];
  for (const url of loginUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(6000); // Attente longue pour SPA
      await screenshot(page, `moboo-login`);
      const html = await page.content();
      if (html.includes('password') || html.includes('mot de passe') || html.includes('login')) {
        break;
      }
    } catch(e) {}
  }

  await typeIn(page, [
    'input[type="email"]', 'input[name="email"]', 'input[name="username"]',
    'input[id="email"]', 'input[placeholder*="email" i]', 'input[placeholder*="mail" i]',
  ], COMPTES.moboo.email);

  await typeIn(page, ['input[type="password"]', 'input[name="password"]'], COMPTES.moboo.password);

  await clickAny(page, ['button[type="submit"]', 'input[type="submit"]', 'button.btn-primary', 'button[class*="login"]', 'button[class*="connect"]']);
  await wait(6000);

  const postUrls = ['https://moboo.ci/deposer-annonce', 'https://moboo.ci/annonce/new', 'https://moboo.ci/poster', 'https://moboo.ci/add', 'https://moboo.ci/create'];
  for (const url of postUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(6000);
      await screenshot(page, 'moboo-form');
      const html = await page.content();
      if (html.includes('title') || html.includes('prix') || html.includes('description')) break;
    } catch(e) {}
  }

  const desc = annonce.description || `${annonce.type_bien} · ${annonce.ville} ${annonce.quartier} · ${annonce.prix} FCFA · Tél: ${annonce.tel}`;

  await typeIn(page, ['input[name="title"]', 'input[name="titre"]', 'input[placeholder*="titre" i]', 'input[placeholder*="title" i]'], annonce.titre);
  await typeIn(page, ['input[name="price"]', 'input[name="prix"]', 'input[placeholder*="prix" i]', 'input[placeholder*="price" i]'], annonce.prix);
  await typeIn(page, ['textarea[name="description"]', 'textarea[placeholder*="description" i]', 'textarea'], desc);
  await typeIn(page, ['input[type="tel"]', 'input[name="phone"]', 'input[name="telephone"]', 'input[placeholder*="téléphone" i]', 'input[placeholder*="phone" i]'], annonce.tel);

  await uploadPhotos(page, annonce.photos);
  await screenshot(page, 'moboo-filled');

  const submitted = await clickAny(page, ['button[type="submit"]', 'input[type="submit"]', 'button.btn-primary', 'button[class*="submit"]', 'button[class*="publish"]', 'button[class*="poster"]']);
  await wait(5000);
  await screenshot(page, 'moboo-result');
  if (submitted) console.log('  ✅ Annonce soumise sur Moboo');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🏠 AnnonceCI v3 — ${ANNONCES.length} annonce(s) à publier\n`);

  const browser = await puppeteer.launch({
    args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  // Masquer qu'on est un bot
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });

  page.on('requestfailed', () => {});

  let success = 0, errors = 0;

  for (let i = 0; i < ANNONCES.length; i++) {
    const annonce = ANNONCES[i];
    const nbPhotos = annonce.photos ? annonce.photos.length : 0;
    console.log(`\n📌 Annonce ${i+1}/${ANNONCES.length} : "${annonce.titre}" — ${nbPhotos} photo(s)`);

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
