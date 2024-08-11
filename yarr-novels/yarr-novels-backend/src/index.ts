import puppeteer from 'puppeteer-extra';
import * as cheerio from 'cheerio';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin()); 

const fetchWebsiteContent = async (url: string): Promise<void> => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: 'networkidle2',
    });

    // Get the page content after JavaScript execution
    const content = await page.content();

    // Log the page content to the console
    // console.log('Page content:', content);

    const $ = cheerio.load(content);


    /**
     * Get title
     */
    const titleDiv = $('.rounded.p-4.bg-primary-200.space-y-3.md\\:p-6');
    const title = titleDiv.find('h1').text().trim();
    if (!title) {
      console.error('No title found in the document.');
      return;
    }
    console.log('Page Title:', title);

    /**
     * Get list of chapters
     */
    const links: { href: string; text: string }[] = [];
    $('div[x-show="expanded"] a').each((index, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      if (href) {
        links.push({ href, text });
      }
    });

    // Check if links were found
    if (links.length === 0) {
      // Save the page content to a debug file
      const debugFilename = `debug-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
      const filePath = path.join(__dirname, debugFilename);
      fs.writeFileSync(filePath, content);
      console.log(`No links found. Page content saved to ${debugFilename}`);
    } else {
      console.log('Links and their text:');
      links.forEach(link => {
        console.log(`Text: ${link.text}, URL: ${link.href}`);
      });
    }


    await browser.close();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error fetching the website: ${error.message}`);
    } else {
      console.error('An unknown error occurred');
    }
  }
};

// Example usage
const url = 'https://skydemonorder.com/projects/i-entered-a-gacha-game-that-i-had-abandoned-10-years-ago';
fetchWebsiteContent(url);
