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
 * Zips the entire Library folder and names it Library_<timestamp>.zip
 * @param libraryFolderPath - Path to the Library folder.
 */
export async function zipLibraryFolder(libraryFolderPath: string): Promise<void> {
  // Check if the Library folder exists
  if (!fs.existsSync(libraryFolderPath)) {
    console.warn(`📂 Library folder does not exist: ${libraryFolderPath}, skipping zipping.`);
    return;
  }

  // Generate timestamp in YYYY_MM_DD format
  const now = new Date();
  const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
  const zipFileName = `Library_${timestamp}.zip`;
  const zipFilePath = path.join(path.dirname(libraryFolderPath), zipFileName);

  // Check if zip already exists
  if (fs.existsSync(zipFilePath)) {
    console.info(`📦 Library zip file already exists: ${zipFilePath}`);
    return;
  }

  // Create zip stream
  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise<void>((resolve, reject) => {
    output.on('close', () => {
      console.info(`✅ Successfully zipped Library: ${zipFileName} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error(`❌ Error while zipping Library:`, err);
      reject(err);
    });

    archive.pipe(output);
    archive.directory(libraryFolderPath, false); // Add all contents of the Library folder
    archive.finalize();
  });
}

/**
 * Zips all HTML files in the book folder to a new path with a progress bar. It checks if the zip is up to date or a new one
 * needs to be created
 * @param bookFolderPath - Path to the book's folder.
 * @param sanitizedTitle - Sanitized name of the book.
 */
export async function zipBookFolder(bookFolderPath: string, sanitizedTitle: string): Promise<void> {
  // Check if the folder exists
  if (!fs.existsSync(bookFolderPath)) {
    logger.warn(`📂 Folder does not exist: ${bookFolderPath}, skipping zipping.`);
    return;
  }

  const htmlFiles: string[] = fs.readdirSync(bookFolderPath).filter((file: string) => file.endsWith('.html'));
  const chapterCount: number = htmlFiles.length;

  if (chapterCount === 0) {
    logger.warn(`📭 No HTML files found in ${sanitizedTitle}, skipping zipping.`);
    return;
  }

  // Check if a zip file with the correct number of files already exists
  const expectedZipFileName = `${sanitizedTitle}_${chapterCount}.zip`;
  const existingZipFiles: string[] = fs.readdirSync(bookFolderPath).filter((file: string) => file.endsWith('.zip'));

  const upToDateZip = existingZipFiles.find((zipFile) => zipFile === expectedZipFileName);

  if (upToDateZip) {
    logger.info(`📦 Up-to-date zip file already exists: ${upToDateZip}`);
    return;
  }

  const zipFilePath: string = path.join(bookFolderPath, expectedZipFileName);
  const output: WriteStream = fs.createWriteStream(zipFilePath);
  const archive: Archiver = archiver('zip', { zlib: { level: 9 } });

  // Initialize progress bar
  const progressBar = new cliProgress.SingleBar({
    format: `📦 Zipping ${sanitizedTitle} | {bar} | {percentage}% | File {value}/{total}`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  try {
    // Start zipping process with a promise to ensure proper waiting
    await new Promise<void>((resolve, reject) => {
      output.on('close', (): void => {
        progressBar.stop();
        logger.info(`✅ Successfully zipped book: ${expectedZipFileName} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', (err: Error): void => {
        progressBar.stop();
        logger.error(`❌ Error while zipping ${sanitizedTitle}:`, err);
        reject(err);
      });

      archive.pipe(output);

      // Start the progress bar
      progressBar.start(chapterCount, 0);

      // Add files one by one in order
      (async function addFilesSequentially(index: number): Promise<void> {
        if (index >= htmlFiles.length) {
          archive.finalize();
          return;
        }

        const file = htmlFiles[index];
        const filePath = path.join(bookFolderPath, file);

        // Add the file to the archive
        archive.file(filePath, { name: file });

        // Update progress bar after adding the file
        progressBar.update(index + 1);

        // Process the next file
        await addFilesSequentially(index + 1);
      })(0);
    });
  } catch (error) {
    logger.error(`❌ Zipping process failed for: ${sanitizedTitle}`, error);
  } finally {
    if (progressBar.isActive) {
      progressBar.stop();
    }
  }
}

