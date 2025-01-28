import { BookManager } from "./Books/BooksManager";
import logger from "./utils/Logger";

/**
 * Main flow
 */
async function main(): Promise<void> {

  logger.info("🚀 Starting 🚀");
  
  // Load config file in to memory
  const bookManager = new BookManager();
  bookManager.initialize();

  //Update in memory books
  await bookManager.updateBooksList();

  //download books
  //await bookManager.downloadChapters();

  //zip chapters
  await bookManager.zipBooks();
}

// Start scraping process
main().catch(console.error);
