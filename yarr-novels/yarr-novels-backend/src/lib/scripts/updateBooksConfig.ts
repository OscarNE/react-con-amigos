import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import https from 'https';

const configPath = path.join(__dirname, '..', '..', 'books', 'books_config.json');

interface Book {
  title: string;
  bookPath: string;
  novelUpdatesUrl: string;
  translationUrl: string;
  coverImage: string;
  summary: string;
  genres: string[];
  tags: string[];
}

/**
 * Sanitizes the book title to create valid folder paths.
 */
function sanitizeTitle(title: string): string {
  return title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').trim();
}

/**
 * Downloads an image from a given URL and saves it to the specified path.
 */
async function downloadImage(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      } else {
        console.warn(`⚠️ Failed to download image from ${url}. Status code: ${response.statusCode}`);
        resolve();
      }
    }).on('error', (err) => {
      console.warn(`⚠️ Error downloading image from ${url}: ${err.message}`);
      resolve();
    });
  });
}

/**
 * Scrapes NovelUpdates for book details.
 */
async function scrapeNovelUpdates(url: string): Promise<Partial<Book>> {
    const browser: Browser = await puppeteer.launch({ headless: true });
    const page: Page = await browser.newPage();
    const scrapedData: Partial<Book> = {};
  
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
  
      // Title
      const titleSelector = 'div.seriestitlenu';
      scrapedData.title = await page.$eval(titleSelector, el => el.textContent?.trim() || '');
  
      // Summary
      const summarySelector = '#editdescription > p';
      scrapedData.summary = await page.$eval(summarySelector, el => el.textContent?.trim() || '');
  
      // Genres
      const genreSelector = '#seriesgenre a.genre';
      scrapedData.genres = await page.$$eval(genreSelector, elements => elements.map(el => el.textContent?.trim() || ''));
  
      // Tags
      const tagSelector = '#showtags a.genre';
      scrapedData.tags = await page.$$eval(tagSelector, elements => elements.map(el => el.textContent?.trim() || ''));
  
      // Cover Image
      const coverSelector = 'div.seriesimg img';
      const coverUrl = await page.$eval(coverSelector, img => img.getAttribute('src')).catch(() => '');
      const sanitizedTitle = sanitizeTitle(scrapedData.title || '');
      const coverFolderPath = path.join(__dirname, '..', `books_data/${sanitizedTitle}`, 'cover');
      if (!fs.existsSync(coverFolderPath)) {
        fs.mkdirSync(coverFolderPath, { recursive: true });
      }
      if (coverUrl) {
        const extension = path.extname(coverUrl).split('?')[0] || '.jpg';
        const coverFilePath = path.join(coverFolderPath, `cover${extension}`);
        await downloadImage(coverUrl, coverFilePath);
        scrapedData.coverImage = coverFilePath;
      } else {
        console.warn(`⚠️ No cover image found for ${url}`);
      }
  
      // Paths
      scrapedData.bookPath = `books_data/${sanitizedTitle}`;
  
    } catch (error) {
      console.error(`❌ Error scraping ${url}:`, error);
      const debugPath = path.join(__dirname, '..', 'debug.html');
      const pageContent = await page.content();
      fs.writeFileSync(debugPath, pageContent);
      console.log(`📄 Saved debug page to ${debugPath}`);
    } finally {
      await browser.close();
    }
  
    return scrapedData;
  }

/**
 * Updates the books_config.json with scraped data.
 */
export async function updateBooksConfig(): Promise<void> {
  const config: { books: Book[] } = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  for (const book of config.books) {
    if (book.novelUpdatesUrl && !book.title) {
      console.log(`🔎 Scraping data for: ${book.novelUpdatesUrl}`);
      const scrapedData = await scrapeNovelUpdates(book.novelUpdatesUrl);

      book.title = scrapedData.title || book.title;
      book.summary = scrapedData.summary || book.summary;
      book.genres = scrapedData.genres && scrapedData.genres.length > 0 ? scrapedData.genres : book.genres;
      book.tags = scrapedData.tags && scrapedData.tags.length > 0 ? scrapedData.tags : book.tags;
      book.bookPath = scrapedData.bookPath || book.bookPath;
      book.coverImage = scrapedData.coverImage || book.coverImage;
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ books_config.json has been updated!');
}
