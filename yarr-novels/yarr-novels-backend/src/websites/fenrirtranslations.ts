import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScrapper';
import { ChapterLink } from '../types/ChapterLink';
import { Book } from '../types/Book';
import * as path from 'path';
import * as fs from 'fs';
import puppeteer from 'puppeteer';
import logger from '../utils/Logger';
import { cleanChapterHtml } from '../utils/htmlManipulation';

export class FenrirTranslationsScraper extends BaseScraper {
  private chaptersPath: string = "";
  private coverPath: string = "";

  constructor(book: Book) {
    super(book);
    if (book.bookPath) {
      this.chaptersPath = book.bookPath;
    } else {
      this.generatePaths();
    }
    
  }

  // Prepare folders and paths for chapters and cover
  private generatePaths(): void {
    this.chaptersPath = path.join('src', 'Library', this.book.sanitizedTitle);
    this.coverPath = path.join(this.chaptersPath, 'cover');

    logger.debug(`📂 Using chapters directory: ${this.chaptersPath}`);

    if (!fs.existsSync(this.chaptersPath)) {
      fs.mkdirSync(this.chaptersPath, { recursive: true });
      logger.info(`📂 Created chapters directory: ${this.chaptersPath}`);
    }

    if (!fs.existsSync(this.coverPath)) {
      fs.mkdirSync(this.coverPath, { recursive: true });
      logger.info(`🖼️ Created cover directory: ${this.coverPath}`);
    }
  }

  async scrapeChapterList(): Promise<ChapterLink[]> {
    const browser = await puppeteer.connect({
      // Run on Poweshell: 
      // & "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-profile"
      browserURL: 'http://localhost:9222',
      defaultViewport: null,
    });
    const page = await browser.newPage();
    const links: ChapterLink[] = [];

    try {
      // Go to the page without waiting for `networkidle2`
      await page.goto(this.book.translationUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      logger.debug('Page navigation started successfully.');
    
      // Wait for the specific element to load
      await page.waitForSelector('div.chap-wrapper.active li.wp-manga-chapter.free-chap', { timeout: 30000 });
      logger.debug('Chapter list element loaded successfully.');
    
      // Extract the page content
      const response = await page.content();
      const $ = cheerio.load(response);
    
      // Extract chapter links
      $('div.chap-wrapper.active li.wp-manga-chapter.free-chap').each((_, el) => {
        const href = $(el).find('a').attr('href');
        const text = $(el).find('a').text().trim();
        const episode = text.match(/\d+/)?.[0];
        if (href && episode) links.push({ href, text, episode });
      });
    
      logger.debug(`Extracted ${links.length} chapters.`);
    } catch (error) {
      logger.error(`Error scraping chapter list`, error);
    } finally {
      await page.close();
      browser.disconnect();
    }
    logger.info(`🔗 Extracted ${links.length} chapter links.`);
    return links.reverse();
  }

  async scrapeCoverImage(): Promise<string> {
    try {
      // Define the cover directory
      const coverDirectory = path.join(__dirname, this.book.coverImagePath);
  
      // Check if the cover directory exists and contains any files
      if (fs.existsSync(coverDirectory)) {
        const files = fs.readdirSync(coverDirectory);
  
        // Check if there is at least one file with a .jpg or .png extension
        const hasCoverImage = files.some((file) => file.endsWith('.jpg') || file.endsWith('.png'));
  
        if (hasCoverImage) {
          logger.info(`✅ Cover image already exists in directory: ${coverDirectory}`);
          return coverDirectory; // Return the directory path
        }
      }
  
      // If no cover image exists, proceed with scraping
      const response = await axios.get(this.book.translationUrl);
      const $ = cheerio.load(response.data);
  
      // Get the cover URL
      const coverUrl = $('div.summary_image img').attr('src') || '';
      if (!coverUrl) {
        logger.warn('⚠️ No cover image found.');
        return '';
      }
  
      logger.debug(`📖 Cover image found: ${coverUrl}`);
  
      // Create the cover directory if it doesn't exist
      if (!fs.existsSync(coverDirectory)) {
        fs.mkdirSync(coverDirectory, { recursive: true });
        logger.info(`📂 Created cover directory: ${coverDirectory}`);
      }
  
      // Determine file extension from the cover URL or default to .png
      const fileExtension = path.extname(coverUrl) || '.png';
      const coverFilePath = path.join(coverDirectory, `cover${fileExtension}`);
  
      // Download the image and save it to the file
      const imageResponse = await axios.get(coverUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(coverFilePath, imageResponse.data);
      logger.info(`✅ Cover image saved at: ${coverFilePath}`);
  
      return coverFilePath; // Return the path to the saved cover image
    } catch (error) {
      logger.error('❌ Error scraping cover image:', error);
      return '';
    }
  }


  async scrapeChapter(chapterUrl: string): Promise<string> {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null,
    });
    const page = await browser.newPage();
    let chapter = ""; // Initialize chapter content
  
    try {
      // Visit the main page without waiting for `networkidle2`
      await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      logger.debug('Page navigation started successfully.');
  
      // Wait for the specific element to load
      await page.waitForSelector('div.reading-content', { timeout: 20000 });
      logger.debug('Reading content element loaded successfully.');
  
      // Extract the page content
      const response = await page.content();
      const $ = cheerio.load(response);
  
      const rawHtml = $('div.reading-content').html() || '';
      // logger.debug('Raw HTML (truncated):', rawHtml.substring(0, 1500)); // Print the first 500 characters
  
      if (!rawHtml) {
        logger.error('div.reading-content is empty or not found');
      }
  
      chapter = cleanChapterHtml(rawHtml);
      // logger.debug('Cleaned HTML:', chapter); // Log cleaned HTML for debugging
  
      logger.info(`📄 Extracted content from chapter: ${chapterUrl}`);
    } catch (error) {
      logger.error(`Error scraping chapter`, error);
    } finally {
      await page.close();
      browser.disconnect();
    }
  
    return chapter;
  }
   

  async storeChapter(content: string, chapter: ChapterLink): Promise<void> {
    try {
      const sanitizedFileName = chapter.text.replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize filename
      const filePath = path.join(this.chaptersPath, `${sanitizedFileName}.html`);
  
      // Ensure the folder path exists
      const folderPath = path.dirname(filePath); // Get the folder path from the file path
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        logger.info(`📂 Created missing folder: ${folderPath}`);
      }
  
      // Write the chapter content to the file
      fs.writeFileSync(filePath, content, 'utf-8');
      logger.info(`✅ Chapter stored: ${filePath}`);
    } catch (error) {
      logger.error(`❌ Failed to store chapter ${chapter.text}:`, error);
    }
  }
  
}

