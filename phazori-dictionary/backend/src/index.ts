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

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
