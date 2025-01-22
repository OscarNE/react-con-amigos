import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";
import { Book, BookMap } from "../types/Book";
import path from "path";
import fs from "fs";

// Helper to sanitize titles
function sanitizeTitle(title: string): string {
    return title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
}

// Simulate existing books dictionary
const books: BookMap = {};

export async function updateBook(url: string) {
    const browser: Browser = await puppeteer.launch({ headless: true });
    const page: Page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });

        // Wait for the dropdown list to load
        await page.waitForSelector('.chosen-results');

        // Get all dropdown items and their text
        const items = await page.$$eval('.chosen-results .active-result', elements =>
            elements.map(el => ({
                text: el.textContent?.trim() || '',
                index: el.getAttribute('data-option-array-index') || '',
                href: el.querySelector('a')?.getAttribute('href') || ''
            }))
        );

        console.log("Dropdown items:", items);

        for (const item of items) {
            const sanitizedTitle = sanitizeTitle(item.text);

            // Check if the book already exists
            if (books[sanitizedTitle]) {
                console.log(`✅ Book "${item.text}" already exists. Skipping.`);
                continue;
            }

            console.log(`🔍 Scraping new book: ${item.text}`);

            // Scrape detailed info from NovelUpdates
            const scrapedData = await scrapeNovelUpdates(item.href);

            // Create the book entry
            const newBook: Book = {
                title: item.text,
                sanitizedTitle: sanitizedTitle,
                novelUpdatesUrl: item.href,
                translationUrl: "", // Optional: Update if available
                bookPath: path.join('..', 'Library', sanitizedTitle),
                coverImagePath: path.join('..', 'Library', sanitizedTitle, 'cover'),
                summary: scrapedData.summary || "",
                genres: scrapedData.genres || [],
                tags: scrapedData.tags || [],
                nChapters: 0,
                nfiles: 0,
                lastChapter: 0,
                coverImage: scrapedData.coverImage || ""
            };

            // Create necessary directories
            if (!fs.existsSync(newBook.bookPath)) {
                fs.mkdirSync(newBook.bookPath, { recursive: true });
                console.log(`📂 Created directory: ${newBook.bookPath}`);
            }

            if (!fs.existsSync(newBook.coverImagePath)) {
                fs.mkdirSync(newBook.coverImagePath, { recursive: true });
                console.log(`🖼️ Created cover directory: ${newBook.coverImagePath}`);
            }

            // Save the book in the dictionary
            books[sanitizedTitle] = newBook;
            console.log(`📚 Added new book: ${item.text}`);
        }

    } catch (error) {
        console.error(`❌ Error processing ${url}:`, error);
    } finally {
        await browser.close();
    }
}
