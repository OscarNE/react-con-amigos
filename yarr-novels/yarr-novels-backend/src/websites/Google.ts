import puppeteer from 'puppeteer';
import logger from '../utils/Logger';

export async function searchBookTranslationUrl(bookTitle: string, translationSiteUrl: string): Promise<string | null> {
    const browser = await puppeteer.connect({
      // Run on Powershell: 
      // & "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-profile"
      browserURL: 'http://localhost:9222',
      defaultViewport: null,
    });
  
    const page = await browser.newPage();
  
    try {
      const translatorName = extractDomain(translationSiteUrl);
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${bookTitle} ${translatorName}`)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
  
      // Wait for search results to load
      await page.waitForSelector('a[jsname="UWckNb"]');
  
      // Extract all href attributes of <a> elements with the specified jsname
      const allResultsUrls = await page.$$eval('a[jsname="UWckNb"]', (links: Element[]) => {
        return links
          .map(link => link.getAttribute('href'))
          .filter(href => href !== null) as string[];
      });
  
      // Extract the domain from translationSiteUrl for domain-level matching
      const baseDomain = new URL(translationSiteUrl).hostname;
  
      // Filter URLs that belong to the base domain and have a minimum path depth
      const validUrls = allResultsUrls.filter(url => {
        try {
          const parsedUrl = new URL(url);
          return (
            parsedUrl.hostname === baseDomain &&
            parsedUrl.pathname.split('/').filter(Boolean).length > 2 // Ensure at least 2 meaningful path segments
          );
        } catch {
          return false; // Skip invalid URLs
        }
      });
  
      if (validUrls.length > 0) {
        // Pick the first valid URL and simplify it
        const matchedUrl = validUrls[0];
        const simplifiedUrl = simplifyUrl(matchedUrl, baseDomain);
        console.debug(`Found and simplified URL: ${simplifiedUrl}`);
        return simplifiedUrl;
      } else {
        console.debug('No valid URL found.');
        return null;
      }
    } catch (error) {
      console.error(`Error searching Google: ${error}`);
      return null;
    } finally {
      await page.close();
      browser.disconnect();
    }
  }
  
  
  /**
   * Simplifies a URL by truncating extra path segments beyond the main series/project level.
   * @param url The full URL to simplify.
   * @param domain The base domain to match.
   * @returns Simplified URL.
   */
  function simplifyUrl(url: string, domain: string): string {
    try {
        logger.debug(`Simplifying URL: ${url}`)
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean); // Filter out empty segments
      if (pathSegments.length > 2) {
        // Keep only the domain and first-level meaningful path (e.g., /projects/<series>)
        const simplifiedURL = `${urlObj.origin}/${pathSegments.slice(0, 2).join('/')}`;
        logger.debug(`Simplified URL: ${simplifiedURL}`)
        return simplifiedURL;
      }
      return url; // Return as is if already simplified
    } catch {
      return url; // Return the original URL on parsing errors
    }
  }
  
    
  

  export function extractDomain(url: string): string {
    try {
      // Use the URL class to parse the URL
      const parsedUrl = new URL(url);
  
      // Extract the hostname (e.g., "example.com" from "https://example.com/path")
      return parsedUrl.hostname;
    } catch (error) {
      throw new Error('Invalid URL provided');
    }
  }
  