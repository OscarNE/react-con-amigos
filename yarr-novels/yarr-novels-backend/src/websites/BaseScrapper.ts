import path from 'path';
import { Book } from '../types/Book';
import { ChapterLink } from '../types/ChapterLink';


export abstract class BaseScraper {
  protected book: Book;

  constructor(book: Book) {
    this.book = book;
  }

  // Method to scrape the list of chapters
  abstract scrapeChapterList(): Promise<ChapterLink[]>;

  // Method to scrape the book cover URL or content
  abstract scrapeCoverImage(): Promise<string>;

  // Method to scrape the content of an individual chapter
  abstract scrapeChapter(chapterUrl: string): Promise<string>;
    
}
