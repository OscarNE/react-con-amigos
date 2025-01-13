import fs from 'fs';
import path from 'path';
import archiver, { Archiver } from 'archiver';
import { WriteStream } from 'fs';
import cliProgress from 'cli-progress';

/**
 * Zips all HTML files in the book folder to a new path with a progress bar.
 * @param bookFolderPath - Path to the book's folder.
 * @param bookName - Name of the book.
 */
export async function zipBookFolder(bookFolderPath: string, bookName: string): Promise<void> {
  const htmlFiles: string[] = fs.readdirSync(bookFolderPath).filter((file: string) => file.endsWith('.html'));
  const chapterCount: number = htmlFiles.length;

  if (chapterCount === 0) {
    console.log(`📭 No HTML files found in ${bookName}, skipping zipping.`);
    return;
  }

  const updatesFolderPath: string = path.join(__dirname, '..', '..', 'books', bookName);
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
      console.log(`\n✅ Zipped book: ${zipFileName} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err: Error): void => {
      progressBar.stop();
      console.error(`❌ Error while zipping ${bookName}:`, err);
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
