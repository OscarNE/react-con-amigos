import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

type CheerioAPI = cheerio.CheerioAPI;
puppeteer.use(StealthPlugin());

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handlePrompt(page: Page, selector: string, description: string): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout: 3000 });
    console.log(`${description} found. Clicking...`);
    await page.click(selector);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
  } catch {
    console.log(`No ${description} found.`);
  }
}

function sanitizeTitle(title: string): string {
  return title.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').replace(/[-\s]+/g, ' ').trim();
}

function createFolder(folderPath: string): void {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`Created folder: ${folderPath}`);
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
  console.log(`Extracted ${links.length} chapter links.`);
  return links.reverse();
}

function cleanHTMLContent(htmlContent: string): string {
  const $ = cheerio.load(htmlContent);
  const textContent = $.text().split('\n').map(line => line.trim()).filter(line => line.length > 0);
  return textContent.map(line => `<p>${line}</p>`).join('\n');
}

async function processChapter(
  page: Page,
  link: ChapterLink,
  folderPath: string,
  processedFiles: string[],
  index: number,
  total: number
): Promise<void> {
  const fullUrl: string = new URL(link.href).toString();
  const paddedEpisode: string = link.episode.padStart(4, '0');
  const sanitizedText: string = link.text.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName: string = `Chapter_${paddedEpisode}_${sanitizedText}.html`;
  const filePath: string = path.join(folderPath, fileName);

  if (processedFiles.includes(path.basename(fileName, '.html')))
  {
    console.log(`Skipping already processed: ${fileName}`);
    return;
  }

  console.log(`Processing chapter ${index + 1}/${total}: ${link.text}`);
  await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 10000 });
  await handlePrompt(page, '.px-6.py-8 button:first-of-type', 'Age verification prompt');

  const content: string = await page.content();
  const $$ = cheerio.load(content);
  if ($$('.mb-4.text-sm').text().includes('Unlock this episode')) {
    console.warn(`Locked content detected. Skipping ${link.text}`);
    return;
  }

  let chapterBody: string | undefined = $$('.reading-content').html()?.trim();
  if (!chapterBody) {
    console.error(`No content found for ${link.text}. Exiting.`);
    fs.writeFileSync('debug.txt', content);
    process.exit(1);
  }

  chapterBody = cleanHTMLContent(chapterBody);
  fs.writeFileSync(filePath, chapterBody);
  console.log(`Saved: ${filePath}`);
}

async function scrapeSite(url: string): Promise<void> {
  const browser: Browser = await puppeteer.launch({ headless: true });
  const page: Page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });

  await handlePrompt(page, '.px-6.py-8 button:first-of-type', 'Age verification prompt');
  await handlePrompt(page, '.fc-dialog-container .fc-footer-buttons-container .fc-primary-button', 'Consent dialog');

  const $: CheerioAPI = cheerio.load(await page.content());
  let title: string = sanitizeTitle($('div.post-title > h1').first().text());
  const folderPath: string = path.join(__dirname, '..', '..', 'downloads', 'fenrirtranslations', title);
  createFolder(folderPath);
  const processedFiles: string[] = fs.readdirSync(folderPath).map(f => path.basename(f, '.html'));

  const links: ChapterLink[] = await extractLinks($);
  for (const [index, link] of links.entries()) {
    await sleep(Math.floor(Math.random() * 2000) + 4000);
    await processChapter(page, link, folderPath, processedFiles, index, links.length);
  }

  await browser.close();
  console.log(`Finished scraping: ${title}`);
}

export async function scrapeFenrirTranslations(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      console.log(`Starting scrape for: ${url}`);
      await scrapeSite(url);
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
    }
  }
}
