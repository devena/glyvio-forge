#!/usr/bin/env node
/**
 * discover_base_url.js — descobre o BASE_URL da API para a empresa logada.
 *
 * Como funciona: o próprio Glyvio App chama `POST {BASE_URL}/query/{companyId}/query-for-user`
 * logo após o login / seleção de empresa. Interceptando essa requisição e removendo o sufixo
 * `/query/{companyId}/query-for-user`, o que sobra é o BASE_URL daquele ambiente + empresa.
 *
 * Por que isso importa: o host da API NÃO é necessariamente o host do app.
 * Em app-beta.glyvio.com, por exemplo, o app serve só estáticos e a API vive em
 * webapi-prod.glyvio.com — chamar o host do app devolve o HTML de fallback da SPA.
 *
 * Credenciais vêm do .env (G_APP_URL / G_USERNAME / G_PASSWORD, com fallback GLYVIO_*).
 * Nenhum token é impresso: tudo passa por redact().
 *
 *   node discover_base_url.js              # imprime o relatório
 *   node discover_base_url.js --json       # só o JSON, para consumo por script
 *   node discover_base_url.js --headed     # abre o browser (útil p/ seleção de empresa)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { chromium } = require('playwright');

const E = process.env;
const APP_URL = E.G_APP_URL || E.GLYVIO_APP_URL;
const USER = E.G_USERNAME || E.G_EMAIL || E.GLYVIO_EMAIL;
const PASS = E.G_PASSWORD || E.GLYVIO_PASSWORD;

const JSON_ONLY = process.argv.includes('--json');
const HEADED = process.argv.includes('--headed');
const log = (...a) => { if (!JSON_ONLY) console.log(...a); };

/** Nunca deixar segredo chegar ao stdout. */
function redact(s) {
  return String(s)
    .replace(/((?:authorization|auth_token|access_token|id_token|token)=)[^&]*/gi, '$1<REDIGIDO>')
    .replace(/(Bearer%20|Bearer\s)[A-Za-z0-9._%\-]+/gi, '$1<REDIGIDO>')
    .replace(/eyJ[A-Za-z0-9._\-]{20,}/g, '<JWT>');
}

/** `{base}/query/{companyId}/query-for-user` -> { baseUrl, companyId } */
const QUERY_RE = /^(.*)\/query\/([0-9a-f-]{36})\/query-for-user(?:\?.*)?$/i;
function parseQueryForUser(url) {
  const m = QUERY_RE.exec(url);
  return m ? { baseUrl: m[1], companyId: m[2] } : null;
}

async function main() {
  if (!APP_URL || !USER || !PASS) {
    console.error('ERRO: .env incompleto — esperado G_APP_URL, G_USERNAME, G_PASSWORD.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: !HEADED, channel: 'chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',          // sem isso o Flutter Intl estoura antes do bridge registrar
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  });

  // Escuta ANTES do login — a chamada acontece assim que a empresa é resolvida.
  let resolveHit;
  const hit = new Promise((r) => { resolveHit = r; });
  const others = new Set();
  context.on('request', (req) => {
    const parsed = parseQueryForUser(req.url());
    if (parsed) resolveHit(parsed);
    else { try { others.add(new URL(req.url()).origin); } catch { /* ignore */ } }
  });

  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Login: só o primeiro input é localizável; senha e botão são por coordenada
  // (Tab não move o foco neste Flutter web). waitFor faz polling; isVisible NÃO.
  try {
    const first = page.locator('input').first();
    await first.waitFor({ state: 'visible', timeout: 45000 });
    log('· form de login detectado, autenticando…');
    await first.fill(USER, { timeout: 30000 });
    await page.mouse.click(1050, 496);
    await page.waitForTimeout(400);
    await page.keyboard.type(PASS, { delay: 30 });
    await page.mouse.click(1050, 569);
  } catch {
    log('· sem form de login (sessão já ativa?)');
  }

  const timeout = new Promise((r) => setTimeout(() => r(null), 60000));
  const found = await Promise.race([hit, timeout]);
  const openedUrl = page.url();
  await browser.close();

  if (!found) {
    console.error('ERRO: não observei nenhuma chamada a /query/{companyId}/query-for-user em 60s.');
    console.error('Causas prováveis: login falhou; ou a conta tem várias empresas e parou na');
    console.error('tela de seleção — nesse caso rode com --headed e selecione a empresa.');
    console.error('Origens vistas: ' + [...others].join(', '));
    process.exit(2);
  }

  const { baseUrl, companyId } = found;
  const out = {
    baseUrl,
    companyId,
    appUrl: APP_URL,
    apiHostDiffersFromApp: new URL(baseUrl).origin !== new URL(APP_URL).origin,
    // External Page (modelo em código). Migração em andamento: o segmento era `report`,
    // hoje reservado para o Report Record (glyvio_entity.Report). `page` é o correto para o novo.
    pageUrlPrivate: `${baseUrl}/custom/private/page/${companyId}/{controllerPath}?authorization=Bearer%20<jwt>`,
    pageUrlPublic: `${baseUrl}/custom/public/page/${companyId}/{controllerPath}`,
    pageUrlExternal: `${baseUrl}/custom/external/page/${companyId}/{controllerPath}?auth_token=<jwt>`,
    // Legado — ainda responde enquanto a migração não termina.
    legacyReportUrlPrivate: `${baseUrl}/custom/private/report/${companyId}/{controllerPath}?authorization=Bearer%20<jwt>`,
  };

  if (JSON_ONLY) { console.log(JSON.stringify(out, null, 2)); return; }

  console.log('\n===== BASE_URL DESCOBERTO =====');
  console.log('  app  :', APP_URL);
  console.log('  BASE :', baseUrl);
  console.log('  empresa:', companyId);
  console.log('  url pós-login:', redact(openedUrl).slice(0, 80));
  if (out.apiHostDiffersFromApp) {
    console.log('\n  ATENÇÃO: o host da API é DIFERENTE do host do app.');
    console.log('  Chamar o host do app devolve o HTML de fallback da SPA, não a API.');
  }
  console.log('\n===== URLs DE EXTERNAL PAGE PARA ESTA EMPRESA =====');
  console.log('  private :', out.pageUrlPrivate);
  console.log('  public  :', out.pageUrlPublic);
  console.log('  external:', out.pageUrlExternal);
  console.log('\n  legado (segmento /report/, ainda respondendo):');
  console.log('  ', out.legacyReportUrlPrivate);
}

main().catch((e) => { console.error('SCRIPT ERROR:', e.message.split('\n')[0]); process.exit(1); });
