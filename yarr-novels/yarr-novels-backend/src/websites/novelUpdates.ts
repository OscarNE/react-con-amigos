import fs from 'fs';
import path from 'path';
import puppeteer, { Page } from 'puppeteer';
import { NovelUpdateBooks, NovelUpdateURL } from '../types/BooksLinks';
import { BookMap } from '../types/Book';
import { sanitizeTitle } from '../utils/filesManager';
import logger from '../utils/Logger';
import { queue } from 'async';

const configPath = path.join(__dirname, '..', '..', 'books', 'books_config.json');
const taskQueue = queue(async (task: () => Promise<void>) => {
    await task();
  }, 1); // Concurrency = 1

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
 * Scrapes a book in NovelUpdates to get all the information of the book
 * @param url URL to a book in NovelUpdates
 * @returns a Book with the scrapped information
 */
export async function scrapeBookMetadata(url: string): Promise<Partial<Book>> {
  const browser = await puppeteer.connect({
    // Run on Powershell: 
    // & "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-profile"
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
  });

  const page = await browser.newPage();
  const scrapedData: Partial<Book> = {};

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    novelUpdatesPrompt(page);

    // Title
    try {
      const titleSelector = 'div.seriestitlenu';
      scrapedData.title = await page.$eval(titleSelector, el => el.textContent?.trim() || '');
    } catch {
      logger.warn(`⚠️ Title not found for URL: ${url}`);
    }

    // Summary
    try {
      const summarySelector = '#editdescription > p';
      scrapedData.summary = await page.$eval(summarySelector, el => el.textContent?.trim() || '');
    } catch {
      logger.warn(`⚠️ Summary not found for URL: ${url}`);
    }

    // Genres
    try {
      const genreSelector = '#seriesgenre a.genre';
      scrapedData.genres = await page.$$eval(genreSelector, elements => elements.map(el => el.textContent?.trim() || ''));
    } catch {
      logger.warn(`⚠️ Genres not found for URL: ${url}`);
    }

    // Tags
    try {
      const tagSelector = '#showtags a.genre';
      scrapedData.tags = await page.$$eval(tagSelector, elements => elements.map(el => el.textContent?.trim() || ''));
    } catch {
      logger.warn(`⚠️ Tags not found for URL: ${url}`);
    }

    // Cover Image
    try {
      const coverSelector = 'div.seriesimg img';
      const coverUrl = await page.$eval(coverSelector, img => img.getAttribute('src'));
      if (coverUrl) {
        const sanitizedTitle = sanitizeTitle(scrapedData.title || '');
        const coverFolderPath = path.join(__dirname, '..', '..', `books/${sanitizedTitle}`, 'cover');
        scrapedData.bookPath = `books_data/${sanitizedTitle}`;
      }
    } catch {
      logger.warn(`⚠️ Cover image not found for URL: ${url}`);
    }

  } catch (error) {
    logger.error(`❌ Error scraping ${url}:`, error);
    const debugPath = path.join(__dirname, '..', 'debug.html');
    const pageContent = await page.content();
    fs.writeFileSync(debugPath, pageContent);
    logger.error(`📄 Saved debug page to ${debugPath}`);
  } finally {
    await page.close();
    browser.disconnect();
  }

  return scrapedData;
}


  
/**
 * Checks if there are books not registered in the BookMap
 * @param novelUpdateBooks List of books scrapped from NovelUpdates
 * @param bookMap List of books loaded from the config file
 * @returns 
 */
export function findMissingBooks(novelUpdateBooks: NovelUpdateBooks, bookMap: BookMap): NovelUpdateURL[] {
    return novelUpdateBooks.filter(book => !(book.sanitizedTitle in bookMap));
}

/**
 * Function to handle the prompt when accessing NovelUpdates
 * @param page 
 */
export async function novelUpdatesPrompt(page: Page): Promise<void> {
    try {
      // Wait for the page to load
      await page.waitForSelector('button', { timeout: 10000 });
  
      // Search for the button using XPath
      const buttonExists = await page.evaluate(() => {
        const button = document.evaluate(
          "//button[contains(text(), 'Agree and proceed')]",
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
        if (button) {
          (button as HTMLElement).click();
          return true;
        }
        return false;
      });
  
      if (buttonExists) {
        logger.debug("⚠️ Found and clicked 'Agree and proceed' button.");
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10000)));
      } else {
        logger.debug("⏩ No 'Agree and proceed' prompt detected.");
      }
    } catch (error) {
      logger.debug("⚠️ 'Agree and proceed' button not found.");
    }
  }
  
  /**
   * 
   * @param title Scrapes the url of a single book
   * @returns 
   */
  export async function scrapeBookURL(url: string, title: string): Promise<string | null> {
    logger.debug(`Opening new browser`)
    const browser = await puppeteer.connect({
        // Run on Powershell: 
        // & "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-profile"
        browserURL: 'http://localhost:9222',
        defaultViewport: null,
    });
    logger.debug(`Opening new page`)
    const page = await browser.newPage();

    try {
        logger.debug(`Scraping URL for title: ${title}`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

        // Handle the "Agree and proceed" prompt
        await novelUpdatesPrompt(page);

        // Click the dropdown to load the elements
        await page.waitForSelector('#grouplst_chosen'); // Wait for the dropdown to be available
        await page.click('#grouplst_chosen .chosen-single'); // Click the dropdown to trigger the options to load

        // Wait for the dropdown list to load
        await page.waitForSelector('.chosen-results');

        // Find the matching item in the dropdown
        const match = await page.$$eval(
            '.chosen-results .active-result',
            (elements, targetTitle) => {
                const matchingElement = elements.find(el => el.textContent?.trim() === targetTitle);
                if (matchingElement) {
                    return {
                        text: matchingElement.textContent?.trim() || '',
                        index: matchingElement.getAttribute('data-option-array-index') || ''
                    };
                }
                return null;
            },
            title
        );

        if (!match) {
            logger.warn(`Title not found in the dropdown: ${title}`);
            return null;
        }

        logger.debug(`Found match for title: ${match.text} (Index: ${match.index})`);

        // Click the matched item
        try {
          await page.waitForSelector(
              `.chosen-results .active-result[data-option-array-index="${match.index}"]`,
              { visible: true, timeout: 10000 }
          );
          await page.click(`.chosen-results .active-result[data-option-array-index="${match.index}"]`);
          logger.debug(`Clicked successfully: ${match.text}`);
        } catch (error) {
            logger.warn(`First attempt failed for ${match.text}. Retrying...`);
        
            try {
                await new Promise(resolve => setTimeout(resolve, 500)); // ✅ Cross-version delay
                await page.click(`.chosen-results .active-result[data-option-array-index="${match.index}"]`);
                logger.debug(`Clicked successfully on retry: ${match.text}`);
            } catch (retryError) {
                logger.error(`Second attempt failed for ${match.text}. Error: ${retryError}`);
                return null;
            }
        }
      
      

        // Capture the URL
        const currentUrl = page.url();
        logger.debug(`Captured URL: ${currentUrl} for title: ${match.text}`);

        return currentUrl;
    } catch (error) {
        logger.error(`Error scraping URL for title: ${title}. Error: ${error}`);
        return null;
    } finally {
        await page.close()
        browser.disconnect()
    }
}

/**
 * Gets the list of items (text and index) from the dropdown of a NovelUpdates group page.
 * @param url URL pointing to a translation group page in NovelUpdates
 * @returns Promise<Array<{ text: string, index: string }>>
 */
export async function getDropdownItemsNU(url: string): Promise<Array<{ text: string, index: string }>> {
    const browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
        defaultViewport: null,
    });
    const page = await browser.newPage();
    const items: Array<{ text: string, index: string }> = [];

    try {
        logger.debug(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

        // Handle the "Agree and proceed" prompt if it appears
        await novelUpdatesPrompt(page);

        // Wait for the dropdown to be available
        await page.waitForSelector('#grouplst_chosen', { timeout: 20000 });

        // Click the dropdown to trigger the options to load
        await page.click('#grouplst_chosen .chosen-single');

        // Wait for the dropdown list to load
        await page.waitForSelector('.chosen-results', { timeout: 20000 });

        // Extract dropdown items with their text and index
        items.push(...await page.$$eval('.chosen-results .active-result', elements =>
            elements.map(el => ({
                text: el.textContent?.trim() || '',
                index: el.getAttribute('data-option-array-index') || ''
            })).filter(item => item.text !== "---") // Exclude invalid entries
        ));

        logger.debug(`Found ${items.length} items on ${url}`);

    } catch (error) {
        logger.error(`Error getting dropdown items from: ${url}.`, error);
    } finally {
        await page.close()
        browser.disconnect()
    }

    return items;
}
