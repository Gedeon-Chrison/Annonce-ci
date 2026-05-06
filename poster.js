/**
 * AnnonceCI — Script GitHub Actions v2
 * Correction : attente des champs JS + sélecteurs étendus + debug HTML
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

// Attend qu'un sélecteur apparaisse parmi une liste (le premier trouvé)
async function waitForAny(page, selectors, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) return { el, sel };
      } catch(e) {}
    }
    await wait(500);
  }
  return null;
}

// Remplit un champ en attendant qu'il apparaisse
async function typeIn(page, selectors, text) {
  const sels = Array.isArray(selectors) ? selectors : [selectors];
  const found = await waitForAny(page, sels, 12000);
  if (!found) {
    console.log(`  ⚠️  Champ introuvable: ${sels[0]}`);
    return false;
  }
  try {
    await page.click(found.sel, { clickCount: 3 });
    await page.type(found.sel, String(text), { delay: 40 });
    return true;
  } catch(e) {
    console.log(`  ⚠️  Erreur remplissage: ${found.sel}`);
    return false;
  }
}

// Clique sur un bouton parmi une liste
async function clickAny(page, selectors, timeout = 8000) {
  const sels = Array.isArray(selectors) ? selectors : [selectors];
  const found = await waitForAny(page, sels, timeout);
  if (!found) return false;
  try {
    await page.click(found.sel);
    return true;
  } catch(e) { return false; }
}

// Screenshot + dump HTML pour debug
async function screenshot(page, name) {
  try {
    await page.screenshot({ path: `screenshot-${name}.png` });
    // Sauvegarde aussi le HTML pour analyser les vrais sélecteurs
    const html = await page.content();
    const inputs = html.match(/<input[^>]*>/gi) || [];
    const forms = html.match(/<form[^>]*>/gi) || [];
    console.log(`  📸 ${name} — ${forms.length} form(s), ${inputs.length} input(s) détectés`);
    // Log des inputs trouvés pour debug
    inputs.slice(0, 10).forEach(inp => {
      const type = (inp.match(/type="([^"]*)"/) || [])[1] || '?';
      const name = (inp.match(/name="([^"]*)"/) || [])[1] || '';
      const id = (inp.match(/id="([^"]*)"/) || [])[1] || '';
      const placeholder = (inp.match(/placeholder="([^"]*)"/) || [])[1] || '';
      console.log(`      input: type=${type} name=${name} id=${id} placeholder=${placeholder}`);
    });
  } catch(e) {}
}

// Upload photos
async function uploadPhotos(page, photos) {
  if (!photos || photos.length === 0) return;
  const fichiers = photos.filter(p => fs.existsSync(p));
  if (!fichiers.length) { console.log('  ⚠️  Photos introuvables'); return; }
  console.log(`  📷 Upload de ${fichiers.length} photo(s)...`);
  try {
    await page.evaluate(() => {
      document.querySelectorAll('input[type="file"]').forEach(i => {
        i.style.cssText = 'display:block!important;opacity:1!important;position:relative!important;z-index:9999!important';
      });
    });
    await wait(500);
    const input = await page.$('input[type="file"]');
    if (input) {
      await input.uploadFile(...fichiers);
      await wait(2000);
      console.log(`  ✅ ${fichiers.length} photo(s) uploadée(s)`);
    }
  } catch(e) { console.log(`  ⚠️  Upload photos échoué: ${e.message}`); }
}

// ─── CONNEXION GÉNÉRIQUE ──────────────────────────────────────────────────────
async function seConnecter(page, loginUrl, email, password, siteName) {
  console.log(`  → Connexion à ${siteName}...`);
  await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000); // Attend le JS
  await screenshot(page, `${siteName}-login`);

  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[name="login"]',
    'input[id="email"]',
    'input[id="username"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="mail" i]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]',
  ];

  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[name="pass"]',
    'input[id="password"]',
    'input[placeholder*="mot de passe" i]',
    'input[placeholder*="password" i]',
    'input[autocomplete="current-password"]',
  ];

  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button.login',
    'button.signin',
    'button.btn-login',
    'button.btn-primary',
    '[class*="login-btn"]',
    '[class*="submit"]',
  ];

  const emailOk = await typeIn(page, emailSelectors, email);
  const passOk = await typeIn(page, passwordSelectors, password);

  if (!emailOk || !passOk) {
    console.log(`  ⚠️  Formulaire de connexion non trouvé sur ${siteName} — vérifier le screenshot`);
  }

  await wait(500);
  await clickAny(page, submitSelectors);
  await wait(4000);
  console.log(`  ✅ Connexion envoyée sur ${siteName}`);
}

// ─── FORMULAIRE ANNONCE GÉNÉRIQUE ─────────────────────────────────────────────
async function remplirFormulaire(page, annonce, siteName) {
  await wait(3000);
  await screenshot(page, `${siteName}-form`);

  const desc = annonce.description ||
    `${annonce.type_bien} à ${annonce.type_transaction.toLowerCase()} · ${annonce.ville} ${annonce.quartier} · ` +
    `${annonce.surface ? annonce.surface + 'm² · ' : ''}${annonce.pieces} pièces · ${annonce.prix} FCFA · Tél: ${annonce.tel}`;

  await typeIn(page, [
    'input[name="title"]', 'input[name="titre"]', 'input[name="subject"]',
    'input[id="title"]', 'input[id="titre"]',
    'input[placeholder*="titre" i]', 'input[placeholder*="title" i]',
    'input[placeholder*="objet" i]', 'input[placeholder*="annonce" i]',
    '[class*="title"] input', '[class*="titre"] input',
  ], annonce.titre);

  await typeIn(page, [
    'input[name="price"]', 'input[name="prix"]',
    'input[id="price"]', 'input[id="prix"]',
    'input[placeholder*="prix" i]', 'input[placeholder*="price" i]',
    'input[placeholder*="loyer" i]', 'input[placeholder*="montant" i]',
    '[class*="price"] input', '[class*="prix"] input',
  ], annonce.prix);

  await typeIn(page, [
    'textarea[name="description"]', 'textarea[name="body"]', 'textarea[name="content"]',
    'textarea[id="description"]', 'textarea[placeholder*="description" i]',
    'textarea[placeholder*="détail" i]', 'textarea[placeholder*="votre annonce" i]',
    'textarea',
  ], desc);

  await typeIn(page, [
    'input[name="phone"]', 'input[name="telephone"]', 'input[name="tel"]',
    'input[name="phone_number"]', 'input[id="phone"]', 'input[id="telephone"]',
    'input[type="tel"]',
    'input[placeholder*="téléphone" i]', 'input[placeholder*="phone" i]',
    'input[placeholder*="numéro" i]', 'input[placeholder*="contact" i]',
  ], annonce.tel);

  await uploadPhotos(page, annonce.photos);
  await screenshot(page, `${siteName}-filled`);

  // Soumettre
  const submitted = await clickAny(page, [
    'button[type="submit"]', 'input[type="submit"]',
    'button.btn-primary', 'button.btn-success',
    'button[class*="submit"]', 'button[class*="publish"]',
    'button[class*="poster"]', 'button[class*="publier"]',
    'button[class*="valider"]', 'button[class*="envoyer"]',
  ]);

  await wait(5000);
  await screenshot(page, `${siteName}-result`);

  if (submitted) {
    console.log(`  ✅ Annonce soumise sur ${siteName}`);
  } else {
    console.log(`  ⚠️  Bouton submit non trouvé sur ${siteName} — vérifier screenshot-${siteName}-filled.png`);
  }
}

// ─── JIJI ────────────────────────────────────────────────────────────────────
async function posterJiji(page, annonce) {
  console.log('\n  🌐 JIJI.CO.CI');
  await seConnecter(page, 'https://jiji.co.ci/login', COMPTES.jiji.email, COMPTES.jiji.password, 'jiji');
  await page.goto('https://jiji.co.ci/post-ad', { waitUntil: 'networkidle2', timeout: 30000 });
  await remplirFormulaire(page, annonce, 'jiji');
}

// ─── IVOIREDOMI ──────────────────────────────────────────────────────────────
async function posterIvoiredomi(page, annonce) {
  console.log('\n  🌐 IVOIREDOMI.CI');
  const loginUrls = ['https://ivoiredomi.ci/connexion', 'https://ivoiredomi.ci/login', 'https://www.ivoiredomi.ci/connexion'];
  for (const url of loginUrls) {
    try {
      await seConnecter(page, url, COMPTES.ivoiredomi.email, COMPTES.ivoiredomi.password, 'ivoiredomi');
      break;
    } catch(e) {}
  }
  const postUrls = ['https://ivoiredomi.ci/deposer-annonce', 'https://ivoiredomi.ci/poster-annonce', 'https://ivoiredomi.ci/annonce/new'];
  for (const url of postUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      break;
    } catch(e) {}
  }
  await remplirFormulaire(page, annonce, 'ivoiredomi');
}

// ─── MOBOO ───────────────────────────────────────────────────────────────────
async function posterMoboo(page, annonce) {
  console.log('\n  🌐 MOBOO.CI');
  const loginUrls = ['https://moboo.ci/login', 'https://moboo.ci/connexion', 'https://www.moboo.ci/login'];
  for (const url of loginUrls) {
    try {
      await seConnecter(page, url, COMPTES.moboo.email, COMPTES.moboo.password, 'moboo');
      break;
    } catch(e) {}
  }
  const postUrls = ['https://moboo.ci/deposer-annonce', 'https://moboo.ci/annonce/new', 'https://moboo.ci/poster'];
  for (const url of postUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      break;
    } catch(e) {}
  }
  await remplirFormulaire(page, annonce, 'moboo');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🏠 AnnonceCI v2 — ${ANNONCES.length} annonce(s) à publier\n`);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  // Ignore les erreurs de ressources non critiques
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
