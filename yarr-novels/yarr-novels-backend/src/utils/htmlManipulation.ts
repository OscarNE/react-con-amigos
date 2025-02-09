import fs from "fs/promises";
import path from 'path';
import * as cheerio from 'cheerio';
import logger from './Logger';

export function cleanChapterHtml(content: string): string {
  // Load the HTML content into Cheerio
  const $ = cheerio.load(content);

  // Extract only the <p> elements and their content
  const paragraphs = $('p')
      .map((_, element) => $(element).html()?.trim()) // Extract and trim inner HTML of each <p>
      .get()
      .filter(Boolean); // Remove null or empty strings

  // ✅ Wrap each paragraph in <p></p> and join with new lines
  return paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('\n');
}


/**
 * Recursively scans a folder and updates all HTML files by wrapping each line in <p></p> tags.
 * - ✅ Processes files **asynchronously** to prevent "too many open files" errors.
 * - ✅ Avoids duplicating <p> tags if they already exist.
 * - ✅ Fixes nested <p> tags.
 * @param folderPath The root folder to scan.
 */
export async function updateHtmlFilesInFolder(folderPath: string): Promise<void> {
  try {
      if (!(await fs.stat(folderPath)).isDirectory()) {
          console.error(`Folder not found: ${folderPath}`);
          return;
      }

      // Get all HTML file paths
      const allHtmlFiles = await getHtmlFiles(folderPath);
      console.info(`Found ${allHtmlFiles.length} HTML files to process.`);

      // ✅ Process files sequentially using `for...of` + `await`
      for (const filePath of allHtmlFiles) {
          await processFile(filePath);
      }

      console.info("Finished updating all HTML files.");
  } catch (error) {
      console.error(`Error scanning folder: ${error}`);
  }
}

/**
* Recursively gets all HTML file paths in a folder.
*/
async function getHtmlFiles(folder: string): Promise<string[]> {
  let fileList: string[] = [];
  const entries = await fs.readdir(folder, { withFileTypes: true });

  for (const entry of entries) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) {
          fileList = fileList.concat(await getHtmlFiles(fullPath)); // Recursively get HTML files
      } else if (entry.isFile() && fullPath.endsWith('.html')) {
          fileList.push(fullPath);
      }
  }
  return fileList;
}

/**
* Reads, formats, and overwrites an HTML file asynchronously.
*/
async function processFile(filePath: string): Promise<void> {
  try {
      let content = (await fs.readFile(filePath, "utf-8")).trim();
      if (!content) return;

      // ✅ Skip files already formatted correctly
      if (content.startsWith("<p>") && content.endsWith("</p>") && !content.includes("<p><p>")) {
          console.info(`SKIPPED: ${filePath} (Already formatted)`);
          return;
      }

      // ✅ Format the content properly
      const updatedContent = cleanAndFormatContent(content);

      // ✅ Overwrite the file asynchronously
      await fs.writeFile(filePath, updatedContent, "utf-8");
      console.info(`Updated: ${filePath}`);
  } catch (error) {
      console.error(`Failed to process ${filePath}: ${error}`);
  }
}

/**
* Cleans and formats HTML content.
*/
function cleanAndFormatContent(content: string): string {
  return content
      .split(/\r?\n/) // Handle Windows (\r\n) and Unix (\n) line breaks
      .map(line => {
          let cleanedLine = line.trim();

          // ✅ Remove extra nested <p> tags
          cleanedLine = cleanedLine.replace(/<\/?p>/g, ""); // Remove existing <p> tags
          cleanedLine = `<p>${cleanedLine}</p>`; // Wrap content in <p> tags

          return cleanedLine;
      })
      .join("\n");
}
  
