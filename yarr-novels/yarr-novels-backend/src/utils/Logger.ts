import fs from 'fs';
import path from 'path';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private static instance: Logger;
  private currentLevel: LogLevel;
  private logFilePath: string;

  private constructor(level: LogLevel = LogLevel.INFO, logFilePath: string = 'app.log') {
    this.currentLevel = level;
    this.logFilePath = path.resolve(logFilePath); // Resolve the file path
    console.log(`Logger initialized with logFilePath: ${this.logFilePath}`);

    // Ensure the directory exists
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      console.log(`Creating log directory: ${logDir}`);
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
      console.log('Logger instance created.');
    }
    return Logger.instance;
  }

  setLogFilePath(filePath: string) {
    this.logFilePath = path.resolve(filePath);
    console.log(`Log file path updated to: ${this.logFilePath}`);

    // Ensure the directory exists
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      console.log(`Creating log directory: ${logDir}`);
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  private writeToFile(logMessage: string) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${logMessage}\n`;

    fs.appendFile(this.logFilePath, message, (err) => {
      if (err) {
        console.error(`Failed to write log to file: ${err.message}`);
      }
    });
  }

  private log(level: string, message: string, ...args: any[]) {
    const formattedMessage = `[${level}]: ${message}`;
    console.log(formattedMessage, ...args); // Log to the console
    this.writeToFile(formattedMessage);    // Log to the file
  }

  debug(message: string, ...args: any[]) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      this.log("DEBUG", message, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.currentLevel <= LogLevel.INFO) {
      this.log("INFO", message, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.currentLevel <= LogLevel.WARN) {
      this.log("WARN", message, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.currentLevel <= LogLevel.ERROR) {
      this.log("ERROR", message, ...args);
    }
  }
}

/* Usage */
// Set up a global logger instance
const logger = Logger.getInstance();
logger.setLevel(LogLevel.DEBUG);
logger.setLogFilePath('logs/app.log'); // Specify your log file path

export default logger;
