import { scrapeSkyDemonOrder } from './lib/websites/skydemonorder';
import { scrapeFenrirTranslations } from './lib/websites/fenrirtranslations';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { updateBooksConfig } from './lib/scripts/updateBooksConfig';

// Load books configuration
const configPath = path.join(__dirname, 'books', 'books_config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

/**
 * Extracts the domain from a given URL.
 * @param url - The URL to extract the domain from.
 * @returns The domain (e.g., 'skydemonorder.com')
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (error) {
    console.error(`❌ Invalid URL: ${url}`);
    return '';
  }
}

/**
 * Decides which scraping script to run based on the domain.
 * @param url - The translation URL of the book.
 */
async function runScraper(url: string): Promise<void> {
  const domain = extractDomain(url);

  switch (domain) {
    case 'skydemonorder.com':
      console.log(`🟢 Running SkyDemonOrder scraper for ${url}`);
      // Out of order, Cloudflare
      // await scrapeSkyDemonOrder([url]);
      break;

    case 'fenrirtranslations.com':
      console.log(`🟢 Running FenrirTranslations scraper for ${url}`);
      await scrapeFenrirTranslations([url]);
      break;

    default:
      console.warn(`⚠️ No scraper implemented for domain: ${domain}`);
  }
}

/**
 * Iterates over all books and runs the appropriate scraper.
 */
async function scrapeBooks(): Promise<void> {
  const books = config.books;

  if (!books || books.length === 0) {
    console.error('❌ No books found in the configuration.');
    return;
  }

  for (const book of books) {
    if (book.translationUrl) {
      await runScraper(book.translationUrl);
    } else {
      console.warn(`⚠️ No translation URL for book: ${book.title}`);
    }
  }
  //After downloading the books, update the books_config.json file
  // updateBooksConfig();
}

// Start scraping process
scrapeBooks().catch(console.error);
