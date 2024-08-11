import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

async function scrapeSite(url: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Visit the main page
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });

  // Handle age verification prompt if it appears
  try {
    await page.waitForSelector('.px-6.py-8 button', { timeout: 3000 });
    console.log('Age verification prompt found. Clicking the "Yes" button...');
    await page.click('.px-6.py-8 button:first-of-type'); // Click the first button ("Yes")
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
  } catch (err) {
    console.log('No age verification prompt found.');
  }

  const content = await page.content();
  const $ = cheerio.load(content);

  // Extract the title, ensuring no unwanted content is included
  let title = $('h1.font-bold').first().text().trim();

  // Clean the title to ensure it's safe for use in file and directory names
  title = title.replace(/[^\w\s-]/g, '').trim(); // Remove special characters except spaces and hyphens
  title = title.replace(/\s+/g, ' '); // Replace multiple spaces with a single space
  title = title.replace(/[-\s]+/g, ' '); // Replace hyphens and spaces with a single space

  const folderPath = path.join(__dirname, 'downloads', 'skydemonorder', title);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }


  // Create a folder named after the title if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Read the list of already processed files
  const processedFiles = fs.readdirSync(folderPath).map(file => path.basename(file, '.html'));

  const links: { href: string; text: string; episode: string }[] = [];
  $('div[x-show="expanded"] a').each((index, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().trim();

    // Find the closest div containing the chapter number
    const parentDiv = $(element).closest('div.py-4.text-base.space-y-2');
    const episode = parentDiv.find('span[x-text="chapter.episode"]').text().trim();

    if (href && episode) {
      links.push({ href, text, episode });
    }
  });

  console.log(`Title: ${title}`);
  console.log('Links and their text:');

  // Reverse the array to start fetching from the begining
  links.reverse();

  for (const [index, link] of links.entries()) {
    console.log(`Processing link ${index + 1} of ${links.length}: ${link.text}, URL: ${link.href}`);

    // Construct the full URL for the chapter
    const fullUrl = new URL(link.href, url).toString();
    
    // Zero-pad the episode number to four digits
    const paddedEpisodeNumber = link.episode.padStart(4, '0');

    // Create the expected file name
    const sanitizedText = link.text.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const expectedFileName = `Chapter_${paddedEpisodeNumber}_${sanitizedText}.html`;

    // Check if the file has already been processed
    if (processedFiles.includes(path.basename(expectedFileName, '.html'))) {
      console.log(`Skipping already processed chapter: ${expectedFileName}`);
      continue; // Skip to the next iteration
    }

    // Visit each link and extract chapter content with a 10-second timeout
    await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 10000 });

    // Handle age verification prompt if it appears on chapter pages
    try {
      await page.waitForSelector('.px-6.py-8 button', { timeout: 3000 });
      console.log(`Age verification prompt found on link ${index + 1}. Clicking the "Yes" button...`);
      await page.click('.px-6.py-8 button:first-of-type'); // Click the first button ("Yes")
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch (err) {
      //console.log(`No age verification prompt found on link ${index + 1}.`);
    }

    const chapterContent = await page.content();
    const $$ = cheerio.load(chapterContent);

    // Check if the page contains the "Unlock this episode" text and skip if found
    const unlockText = $$('.mb-4.text-sm').filter((_, element) => {
      return $$(element).text().trim().includes('Unlock this episode');
    });

    if (unlockText.length > 0) {
      console.log(`Skipping locked content for link ${index + 1} of ${links.length}: ${link.text}, URL: ${fullUrl}`);
      console.log("Skipping the rest of chapters");
      return 0; // Skip to the next iteration
    }

    let chapterBody = $$('#chapter-body').html()?.trim();

    // Check if content was found
    if (!chapterBody) {
      console.error(`No content found for link ${index + 1} of ${links.length}: ${link.text}, URL: ${fullUrl}`);
      fs.writeFileSync("debug.txt", chapterContent);
      console.log("Full body at debug.txt")
      await browser.close();
      process.exit(1); // Exit the program with a non-zero status to indicate an error
    }

    // Load the chapter body into Cheerio for further processing
    const chapterBodyCheerio = cheerio.load(chapterBody);

    // Remove any <div> with class "google-auto-placed ap_container"
    chapterBodyCheerio('div.google-auto-placed.ap_container').remove();

    // Get the cleaned-up HTML
    chapterBody = chapterBodyCheerio.html();

    // Save the chapter content to a file
    const filePath = path.join(folderPath, expectedFileName);
    fs.writeFileSync(filePath, chapterBody);

    console.log(`Content saved to ${filePath}`);
    console.log("");
  }

  await browser.close();
}

export async function scrapeSkyDemonOrder(urls: string[]) {
  for (const url of urls) {
    try {
      await scrapeSite(url);
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }
}
