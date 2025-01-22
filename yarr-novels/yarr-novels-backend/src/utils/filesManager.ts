import fs from 'fs';
import path from 'path';
import archiver, { Archiver } from 'archiver';
import { WriteStream } from 'fs';
import cliProgress from 'cli-progress';
import https from 'https';
import logger from './Logger';
 
/**
 * Removed special characters and replaces spaces with underscores
 * @param title Title of a book
 * @returns 
 */
export function sanitizeTitle(title: string): string {
    return title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').trim();
  }

 /**
 * Downloads an image from a given URL and saves it to the specified path.
 */
export async function downloadImage(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
        if (response.statusCode === 200) {
            const fileStream = fs.createWriteStream(filePath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
            fileStream.close();
            resolve();
            });
        } else {
            logger.warn(`⚠️ Failed to download image from ${url}. Status code: ${response.statusCode}`);
            resolve();
        }
        }).on('error', (err) => {
            logger.warn(`⚠️ Error downloading image from ${url}: ${err.message}`);
        resolve();
        });
    });
}

/**
 * Zips all HTML files in the book folder to a new path with a progress bar.
 * @param bookFolderPath - Path to the book's folder.
 * @param bookName - Name of the book.
 */
export async function zipBookFolder(bookFolderPath: string, bookName: string): Promise<void> {
  const htmlFiles: string[] = fs.readdirSync(bookFolderPath).filter((file: string) => file.endsWith('.html'));
  const chapterCount: number = htmlFiles.length;

  if (chapterCount === 0) {
    logger.warn(`📭 No HTML files found in ${bookName}, skipping zipping.`);
    return;
  }

  const sanitizedTitle = sanitizeTitle(bookName || '');
  const updatesFolderPath: string = path.join(__dirname, '..', '..', 'books', sanitizedTitle);
  if (!fs.existsSync(updatesFolderPath)) {
    fs.mkdirSync(updatesFolderPath, { recursive: true });
  }

  const zipFileName: string = `${bookName}_${chapterCount}.zip`;
  const zipFilePath: string = path.join(updatesFolderPath, zipFileName);

  const output: WriteStream = fs.createWriteStream(zipFilePath);
  const archive: Archiver = archiver('zip', { zlib: { level: 9 } });

  // Create a progress bar
  const progressBar = new cliProgress.SingleBar({
    format: `📦 Zipping | {bar} | {percentage}% | {value}/{total} bytes`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  return new Promise<void>((resolve, reject) => {
    output.on('close', (): void => {
      progressBar.stop();
      logger.info(`\n✅ Zipped book: ${zipFileName} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err: Error): void => {
      progressBar.stop();
      logger.error(`❌ Error while zipping ${bookName}:`, err);
      reject(err);
    });

    archive.on('progress', (progress) => {
      progressBar.setTotal(progress.fs.totalBytes);
      progressBar.update(progress.fs.processedBytes);
    });

    archive.pipe(output);

    htmlFiles.forEach((file: string): void => {
      const filePath: string = path.join(bookFolderPath, file);
      archive.file(filePath, { name: file });
    });

    progressBar.start(1, 0); // Initialize progress bar
    archive.finalize();
  });
}
