import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { parse } from '@fast-csv/parse';
import { format, writeToStream } from '@fast-csv/format';

const app = express();
const port = 3000;
const csvFilePath = path.resolve(__dirname, 'data.csv');

app.use(bodyParser.json());

interface Entry {
    phazori: string;
    significado: string;
    comun?: string;
}

// Helper function to read the CSV file and return its content
const readCsvFile = async (): Promise<Entry[]> => {
    return new Promise((resolve, reject) => {
        const results: Entry[] = [];
        fs.createReadStream(csvFilePath)
            .pipe(parse({ headers: true }))
            .on('data', (data: Entry) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
};

// Helper function to write data to the CSV file
const writeCsvFile = async (entries: Entry[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(csvFilePath);
        writeToStream(ws, entries, { headers: true })
            .on('finish', resolve)
            .on('error', reject);
    });
};

// POST /addword endpoint
app.post('/addword', async (req: Request, res: Response) => {
    const { phazori, significado, comun } = req.body;

    if (!phazori || !significado) {
        return res.status(400).json({ message: 'phazori and significado are required' });
    }

    try {
        let entries = await readCsvFile();

        if (entries.some(entry => entry.phazori === phazori)) {
            return res.status(409).json({ message: 'Entry already exists' });
        }

        const newEntry: Entry = { phazori, significado, comun };
        entries.push(newEntry);

        // Sort entries alphabetically by phazori
        entries = entries.sort((a, b) => a.phazori.localeCompare(b.phazori));

        await writeCsvFile(entries);

        res.status(201).json({ message: 'Entry added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /pathori/:value endpoint
app.get('/pathori/:value', async (req: Request, res: Response) => {
    const { value } = req.params;

    try {
        const entries = await readCsvFile();
        const entry = entries.find(entry => entry.phazori === value);

        if (!entry) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        res.json({ comun: entry.comun });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /comun/:value endpoint
app.get('/comun/:value', async (req: Request, res: Response) => {
    const { value } = req.params;

    try {
        const entries = await readCsvFile();
        const entry = entries.find(entry => entry.comun === value);

        if (!entry) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        res.json({ phazori: entry.phazori });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
