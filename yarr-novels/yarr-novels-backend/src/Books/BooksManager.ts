import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { Book, BookMap } from '../types/Book'
import { sanitizeTitle } from '../utils/filesManager';
import { getDropdownItemsNU, scrapeBookMetadata, scrapeBookURL } from '../websites/novelUpdates';
import { config } from "../config/config";
import { NovelUpdateBooks } from '../types/BooksLinks';
import logger from '../utils/Logger';
import puppeteer from 'puppeteer';
import { extractDomain, searchBookTranslationUrl } from '../websites/Google';


const DATA_PATH = path.join(__dirname, '..', 'Library', 'books.json');

export class BookManager {
  private books: BookMap = {};

  // Load JSON and convert to dictionary
  async initialize(): Promise<void> {
    logger.debug(`Starting loadBooksConfig`)
    try {
      // Try reading the file
      const data = await readFile(DATA_PATH, 'utf-8');
  
      // Handle empty file
      if (!data.trim()) {
        logger.warn("⚠️ The books data file is empty.");
        this.books = {};
        return;
      }
  
      try {
        const booksArray: Book[] = JSON.parse(data);
  
        // Convert array to dictionary with title as key
        this.books = booksArray.reduce((acc, book) => {
          acc[book.sanitizedTitle] = book;
          return acc;
        }, {} as BookMap);
      } catch (error) {
        logger.error("❌ Failed to parse the books data file:", error);
        this.books = {};
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`⚠️ The file ${DATA_PATH} does not exist. Creating a new empty file.`);
        await writeFile(DATA_PATH, '[]', 'utf-8');  // Create an empty JSON array
        this.books = {};
      } else {
        logger.error("❌ Error reading the books data file:", error);
        this.books = {};
      }
    }
    logger.debug(`Finished loadBooksConfig`)
  }


  /**
   * Checks if a book with the given title already exists in the books map.
   * @param title The title of the book to check.
   * @returns True if the book exists, false otherwise.
   */
  public bookExists(title: string): boolean {
    return Object.values(this.books).some(book => book.title === title);
  }
  

  // Get a book by title
  getBook(title: string): Book | undefined {
    return this.books[title];
  }

  // Update a book by title
  updateBook(sanitizedTitle: string, updatedData: Partial<Book>): void {
    if (this.books[sanitizedTitle]) {
      this.books[sanitizedTitle] = { ...this.books[sanitizedTitle], ...updatedData };
    }
  }

  // Save back to JSON as an array
  async saveBooksToConfigFile(): Promise<void> {
    const booksArray = Object.values(this.books);
    await writeFile(DATA_PATH, JSON.stringify(booksArray, null, 2), 'utf-8');
  }

  /**
   * Adds a new book and populates the entry with the NovelUpdates information.
   * @param url URL of the book in NovelUpdates
   * @returns 
   */
  async addBook(url: string): Promise<void> {
    logger.debug(`Starting addBook: ${url}`)

      // Check if the URL is an exception
    if (exception(url)) {
      logger.debug(`URL is in the exception list. Skipping: ${url}`);
      return;
    } else {
      logger.debug(`URL is not in the exception list. Proceeding: ${url}`);
    }

    const scrapedData = await scrapeBookMetadata(url);
    
    if (!scrapedData.title) {
      logger.warn(`⚠️ No title found for URL: ${url}`);
      return;
    }

    const sanitizedTitle = sanitizeTitle(scrapedData.title);

    const bookPath = path.join('..', 'Library', sanitizedTitle);
    const coverPath = path.join(bookPath, 'cover');

    // Create necessary directories
    if (!existsSync(bookPath)) {
      mkdirSync(bookPath, { recursive: true });
      logger.info(`📂 Created directory: ${bookPath}`);
    }

    if (!existsSync(coverPath)) {
      mkdirSync(coverPath, { recursive: true });
      logger.info(`🖼️ Created cover directory: ${coverPath}`);
    }

    // Create and add the new book entry
    const newBook: Book = {
      title: scrapedData.title,
      sanitizedTitle: sanitizedTitle,
      novelUpdatesUrl: url,
      translationUrl: scrapedData.translationUrl || '',
      bookPath: bookPath,
      coverImagePath: coverPath,
      summary: scrapedData.summary || '',
      genres: scrapedData.genres || [],
      tags: scrapedData.tags || [],
      nChapters: 0,
      nfiles: 0,
      lastChapter: 0
    };

    this.books[sanitizedTitle] = newBook;
    logger.info(`📚 Added new book: ${newBook.title}`);

    this.saveBooksToConfigFile();
    logger.info(`🖨 Updates books_config.json`)
  }

  /**
   * Compares the urls gotten from novelupdates to the ones saved in the config file
   * @returns An array NovelUpdateBooks with the new titles
   */
  async updateBooksList() {
    const booksURLs: NovelUpdateBooks = [];
  
    // Process each config URL (group site in NovelUpdates) sequentially
    for (const urlPair of config) {
      try {
        console.debug(`Scraping dropdown titles from: ${urlPair.NovelUpdatesURL}`);
        const bookTitles = await getDropdownItemsNU(urlPair.NovelUpdatesURL);
        // If book has not been added still, get the NovelUpdates URL
        for (const book of bookTitles) {
          if ( !this.bookExists(book.text) ){
            console.debug(`📕 New book: ${book.text}`);
            const bookUrl = await scrapeBookURL(urlPair.NovelUpdatesURL, book.text);
            if (bookUrl) {
              console.debug(`Scrapping and adding ${book.text}.`)
              await this.addBook(bookUrl);
          } else {
              console.warn(`Failed to scrape URL for book: ${book.text}`);
          }
          } else {
            logger.debug(`📗 Already exists: ${book.text}`);
            logger.debug(`Translation URL: ${this.books[sanitizeTitle(book.text)].translationUrl}`)
          }
          if (!this.books[sanitizeTitle(book.text)].translationUrl) {
            console.debug('Grabbing translation URL...');
            
            const sanitizedTitle = sanitizeTitle(book.text);
            const bookTitle = this.books[sanitizedTitle]?.title;
            
            if (bookTitle) {
              await searchBookTranslationUrl(bookTitle, urlPair.TranslatorURL)
                .then((translationUrl) => {
                  if (translationUrl) {
                    const updatedData: Partial<Book> = { translationUrl };
                    this.updateBook(sanitizedTitle, updatedData);
                    this.saveBooksToConfigFile();
                  } else {
                    const updatedData: Partial<Book> = { translationUrl: "fill_manually" };
                    this.updateBook(sanitizedTitle, updatedData);
                    this.saveBooksToConfigFile();
                  }
                })
                .catch((error) => {
                  console.error('Error fetching translation URL:', error);
                });
            } else {
              console.error('Book title not found for:', book.text);
            }
          }
        }

      } catch (error) {
        console.error(`Failed to scrape URLs from ${urlPair.NovelUpdatesURL}:`, error);
      }
    }
  }
}

function exception(url: string): boolean {
  // List of URLs to check against
  const exceptions = [
    'https://www.novelupdates.com/group/fenrir-realm/',
    // Add more URLs here as needed
  ];

  // Check if the URL matches any in the list
  return exceptions.includes(url);
}
