import fs, { stat } from 'fs';
import path from 'path';
import { parse } from '@fast-csv/parse';
import { format, writeToStream } from '@fast-csv/format';

export interface Entry {
    phazori: string;
    significado: string;
    comun?: string;
    verbo: boolean;
}

export class csvManager {
    private csvFile;
    
    constructor(fileName:string) {
        this.csvFile = path.resolve(__dirname, fileName);
    }

    // Helper function to read the CSV file and return its content
    public read = async (): Promise<Entry[]> => {
        return new Promise((resolve, reject) => {
            const results: Entry[] = [];
            fs.createReadStream(this.csvFile)
                .pipe(parse({ headers: true }))
                .on('data', (data: Entry) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error));
        });
    };

    // Helper function to write data to the CSV file
    public write = async (entries: Entry[]): Promise<void> => {
        return new Promise((resolve, reject) => {
            const ws = fs.createWriteStream(this.csvFile);
            writeToStream(ws, entries, { headers: true })
                .on('finish', resolve)
                .on('error', reject);
        });
    };
}