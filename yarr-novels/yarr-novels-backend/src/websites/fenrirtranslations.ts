import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScrapper';
import { ChapterLink } from '../types/ChapterLink';
import { Book } from '../types/Book';
import * as path from 'path';
import * as fs from 'fs';

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
    this.chaptersPath = path.join('..', 'Library', this.book.sanitizedTitle);
    this.coverPath = path.join(this.chaptersPath, 'cover');

    if (!fs.existsSync(this.chaptersPath)) {
      fs.mkdirSync(this.chaptersPath, { recursive: true });
      console.log(`📂 Created chapters directory: ${this.chaptersPath}`);
    }

    if (!fs.existsSync(this.coverPath)) {
      fs.mkdirSync(this.coverPath, { recursive: true });
      console.log(`🖼️ Created cover directory: ${this.coverPath}`);
    }
  }

  async scrapeChapterList(): Promise<ChapterLink[]> {
    const response = await axios.get(this.book.translationUrl);
    const $ = cheerio.load(response.data);
    const links: ChapterLink[] = [];

    $('div.chap-wrapper.active li.wp-manga-chapter.free-chap').each((_, el) => {
      const href = $(el).find('a').attr('href');
      const text = $(el).find('a').text().trim();
      const episode = text.match(/\d+/)?.[0];
      if (href && episode) links.push({ href, text, episode });
    });

    console.log(`🔗 Extracted ${links.length} chapter links.`);
    return links.reverse();
  }

  async scrapeCoverImage(): Promise<string> {
    const response = await axios.get(this.book.translationUrl);
    const $ = cheerio.load(response.data);

    const coverUrl = $('div.post-title img').attr('src') || '';
    console.log(`📖 Cover image found: ${coverUrl}`);
    return coverUrl;
  }

  async scrapeChapter(chapterUrl: string): Promise<string> {
    const response = await axios.get(chapterUrl);
    const $ = cheerio.load(response.data);

    const content = $('div.chapter-content').html() || '';
    console.log(`📄 Extracted content from chapter: ${chapterUrl}`);
    return content;
  }
}
