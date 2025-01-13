import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { zipBookFolder } from '../scripts/zipBooks';

type CheerioAPI = cheerio.CheerioAPI;
puppeteer.use(StealthPlugin());

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handlePrompt(page: Page, selector: string, description: string): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout: 3000 });
    console.log(`✅ ${description} found. Clicking...`);
    await page.click(selector);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
  } catch {
    //console.log(`⚠️ No ${description} found.`);
  }
}

function sanitizeTitle(title: string): string {
  return title.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').replace(/[-\s]+/g, ' ').trim();
}

function createFolder(folderPath: string): void {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`📂 Created folder: ${folderPath}`);
  }
}

type ChapterLink = {
  href: string;
  text: string;
  episode: string;
};

async function extractLinks($: CheerioAPI): Promise<ChapterLink[]> {
  const links: ChapterLink[] = [];
  $('div.chap-wrapper.active li.wp-manga-chapter.free-chap').each((_: number, el: cheerio.Element) => {
    const href = $(el).find('a').attr('href');
    const text = $(el).find('a').text().trim();
    const episode = text.match(/\d+/)?.[0];
    if (href && episode) links.push({ href, text, episode });
  });
  console.log(`🔗 Extracted ${links.length} chapter links.`);
  return links.reverse();
}

function cleanHTMLContent(htmlContent: string): string {
  const $ = cheerio.load(htmlContent);
  const contentDiv = $('.reading-content, .text-left');
  contentDiv.find('script, button, svg, iframe, noscript, style').remove();
  const chapterParagraphs = contentDiv.find('p')
    .filter((_, elem) => {
      const text = $(elem).text().trim();
      return text.length > 0 && !/(PUBFUTURE|記事を読む|truvid|style|video|advertisement)/i.test(text);
    })
    .map((_, elem) => $(elem).text().trim())
    .get()
    .join('\n');
  return chapterParagraphs
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => `<p>${line}</p>`)
    .join('\n');
}

async function processChapter(
  page: Page, 
  link: ChapterLink, 
  folderPath: string, 
  processedFiles: string[], 
  index: number, 
  total: number,
  counters: { skipped: number; downloaded: number; timeout: number }
): Promise<void> {
  const fullUrl: string = new URL(link.href).toString();
  const paddedEpisode: string = link.episode.padStart(4, '0');
  const sanitizedText: string = link.text.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName: string = `Chapter_${paddedEpisode}_${sanitizedText}.html`;
  const filePath: string = path.join(folderPath, fileName);

  if (processedFiles.includes(path.basename(fileName, '.html'))) {
    console.log(`⏭️ Skipping already processed: ${fileName}`);
    counters.skipped += 1;
    return;
  }

  console.log(`📖 Processing file ${index + 1}/${total}: ${link.text}`);
  try {
    await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 20000 });
  } catch (error) {
    console.error(`⏳ Timeout loading page for ${link.text}. Skipping...`);
    counters.timeout += 1;
    return;
  }

  await handlePrompt(page, '.px-6.py-8 button:first-of-type', 'Age verification prompt');
  const content: string = await page.content();
  const $$ = cheerio.load(content);
  if ($$('.mb-4.text-sm').text().includes('Unlock this episode')) {
    console.warn(`🔒 Locked content detected. Skipping ${link.text}`);
    counters.skipped += 1;
    return;
  }

  let chapterBody: string | undefined = $$('.reading-content').html()?.trim();
  if (!chapterBody) {
    console.error(`❌ No content found for ${link.text}. Exiting.`);
    fs.writeFileSync('debug.txt', content);
    process.exit(1);
  }

  chapterBody = cleanHTMLContent(chapterBody);
  fs.writeFileSync(filePath, chapterBody);
  console.log(`✅ Saved: ${fileName}`);
  counters.downloaded += 1;

  await sleep(Math.floor(Math.random() * 2000) + 4000);
}

async function scrapeSite(url: string, counters: { skipped: number; downloaded: number; timeout: number }): Promise<void> {
  const browser: Browser = await puppeteer.launch({ headless: true });
  const page: Page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
  } catch (error) {
    console.error(`⏳ Timeout loading the site: ${url}. Skipping...`);
    counters.timeout += 1;
    await browser.close();
    return;
  }

  await handlePrompt(page, '.px-6.py-8 button:first-of-type', 'Age verification prompt');
  await handlePrompt(page, '.fc-dialog-container .fc-footer-buttons-container .fc-primary-button', 'Consent dialog');

  const $: CheerioAPI = cheerio.load(await page.content());
  const title: string = sanitizeTitle($('div.post-title > h1').first().text());
  const folderPath: string = path.join(__dirname, '..', '..', 'downloads', 'fenrirtranslations', title);

  createFolder(folderPath);

  const processedFiles: string[] = fs.readdirSync(folderPath).map(f => path.basename(f, '.html'));
  const links: ChapterLink[] = await extractLinks($);

  for (const [index, link] of links.entries()) {
    await processChapter(page, link, folderPath, processedFiles, index, links.length, counters);
  }

  await browser.close();

  console.log('--------------------------------------');
  console.log(`📖 Summary for ${url}:`);
  console.log(`⏭️ Skipped: ${counters.skipped}`);
  console.log(`✅ Downloaded: ${counters.downloaded}`);
  console.log(`⏳ Timeouts: ${counters.timeout}`);
  console.log('--------------------------------------');

  // 👉 Zip the book if no timeouts occurred
  if (counters.timeout === 0) {
    console.log(`📦 No timeouts detected. Zipping the book: ${title}`);
    await zipBookFolder(folderPath, title);
  } else {
    console.warn(`⚠️ Skipping zipping for ${title} due to ${counters.timeout} timeout(s).`);
  }
  console.log('--------------------------------------');
}



export async function scrapeFenrirTranslations(urls: string[]): Promise<void> {
  for (const url of urls) {
    const bookCounters = { skipped: 0, downloaded: 0, timeout: 0 };
    try {
      console.log(`🚀 Starting scrape for: ${url}`);
      await scrapeSite(url, bookCounters);

    } catch (error) {
      console.error(`❌ Error scraping ${url}:`, error);
    }
  }
}

