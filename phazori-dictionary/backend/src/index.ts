import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import connectDB from './db';
import Name from './models/name';

const app = express();
const port = 3000;

// Connect to database
connectDB(); 

app.use(bodyParser.json());


app.post('/api/name', async (req, res) => {
    const { raiz_phazori, comun, notas } = req.body;
    try {
        const name = new Name({ 
            raiz_phazori, 
            comun, 
            notas,
        });
        await name.save();
        res.status(201).json(name);
    } catch (error) {
        res.status(500).json({ message: error });
    }
});

// GET endpoint to retrieve an entry by the comun key
app.get('/api/name/comun/:comun', async (req, res) => {
    const { comun } = req.params;
    try {
        const name = await Name.findOne({ comun });
        if (name) {
            res.status(200).json(name);
        } else {
            res.status(404).json({ message: 'Name not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error });
    }
});

// GET endpoint to retrieve an entry by the raiz_phazori key
app.get('/api/name/raiz_phazori/:raiz_phazori', async (req, res) => {
    const { raiz_phazori } = req.params;
    try {
        const name = await Name.findOne({ raiz_phazori });
        if (name) {
            res.status(200).json(name);
        } else {
            res.status(404).json({ message: 'Name not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
