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

  
