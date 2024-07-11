import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import {Entry} from './csvManager';
import {csvManager} from './csvManager';
import connectDB from './db';
import Name from './models/name';

const app = express();
const port = 3000;

const csv = new csvManager('data.csv');
// Connect to database
connectDB(); 

app.use(bodyParser.json());


app.post('/api/name', async (req, res) => {
    const { raiz_phazori, comun, significado, regular, masculino } = req.body;
    try {
        const name = new Name({ 
            raiz_phazori, 
            comun, 
            significado, 
            regular, 
            masculino });
        await name.save();
        res.status(201).json(name);
    } catch (error) {
        res.status(500).json({ message: error });
    }
});


// POST /register endpoint
app.post('/register', async (req: Request, res: Response) => {
    const { phazori, significado, comun, verbo } = req.body;

    if (!phazori || !comun) {
        return res.status(400).json({ message: 'phazori and comun are required' });
    }

    try {
        let entries = await csv.read();

        if (entries.some(entry => entry.phazori === phazori)) {
            return res.status(409).json({ message: 'Entry already exists' });
        }

        const newEntry: Entry = { phazori, significado, comun, verbo };
        entries.push(newEntry);

        // Sort entries alphabetically by phazori
        entries = entries.sort((a, b) => a.phazori.localeCompare(b.phazori));

        await csv.write(entries);

        res.status(201).json({ message: 'Entry added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /phazori/:value endpoint
app.get('/phazori/:value', async (req: Request, res: Response) => {
    const { value } = req.params;

    try {
        const entries = await csv.read();
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
        const entries = await csv.read();
        const entry = entries.find(entry => entry.comun === value);

        if (!entry) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        res.json({ phazori: entry });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
