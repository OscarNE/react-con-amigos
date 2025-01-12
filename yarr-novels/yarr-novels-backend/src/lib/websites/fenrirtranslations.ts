import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  // Handle consent dialog if it appears
  try {
    await page.waitForSelector('.fc-dialog-container .fc-footer-buttons-container .fc-primary-button', { timeout: 3000 });
    console.log('Consent dialog found. Clicking the "Consent" button...');
    await page.click('.fc-dialog-container .fc-footer-buttons-container .fc-primary-button'); // Click the "Consent" button
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
  } catch (err) {
    console.log('No consent dialog found.');
  }

  const content = await page.content();
  const $ = cheerio.load(content);
  fs.writeFileSync('debug.html', content); // Save the content to a file for inspection

  // Extract the title, ensuring no unwanted content is included
  let title = $('span[style*="font-weight: 400"]').first().text().trim();
  console.log(`Extracted title: ${title}`);

  // Clean the title to ensure it's safe for use in file and directory names
  title = title.replace(/[^\w\s-]/g, '').trim(); // Remove special characters except spaces and hyphens
  title = title.replace(/\s+/g, ' '); // Replace multiple spaces with a single space
  title = title.replace(/[-\s]+/g, ' '); // Replace hyphens and spaces with a single space

  const folderPath = path.join(__dirname, '..', '..', 'downloads', 'fenrirtranslations', title);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Read the list of already processed files
  const processedFiles = fs.readdirSync(folderPath).map(file => path.basename(file, '.html'));

  const links: { href: string; text: string; episode: string }[] = [];
  
  // Select all <li> elements within the <div class="chap-wrapper active"> and extract chapter links
  $('div.chap-wrapper.active li.wp-manga-chapter.free-chap').each((index, element) => {
    const href = $(element).find('a').attr('href');
    const text = $(element).find('a').text().trim();

    // For fenrirtranslations, extract the episode number or equivalent from the chapter link or structure
    const episode = text.match(/\d+/)?.[0]; // Assuming the episode number is embedded in the text (you can adjust this as needed)

    if (href && episode) {
      links.push({ href, text, episode });
    }
  });

  console.log(`Title: ${title}`);

  // Reverse the array to start fetching from the beginning
  links.reverse();

  for (const [index, link] of links.entries()) {
    console.log(`Processing link ${index + 1} of ${links.length}: ${link.text}, URL: ${link.href}`);

    // Wait between 4 to 6 seconds before processing the next chapter
    const randomWaitTime = Math.floor(Math.random() * (6000 - 4000 + 1)) + 4000;
    console.log(`Waiting for ${randomWaitTime / 1000} seconds before processing the next chapter...`);
    await sleep(randomWaitTime);

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

    // Extract the chapter content from <div class="reading-content">
    let chapterBody = $$('.reading-content').html()?.trim();

    // Check if content was found
    if (!chapterBody) {
      console.error(`No content found for link ${index + 1} of ${links.length}: ${link.text}, URL: ${fullUrl}`);
      fs.writeFileSync("debug.txt", chapterContent);
      console.log("Full body at debug.txt");
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

export async function scrapeFenrirTranslations(urls: string[]) {
  for (const url of urls) {
    try {
      await scrapeSite(url);
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }
}
