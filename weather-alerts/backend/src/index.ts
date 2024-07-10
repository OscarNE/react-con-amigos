import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.get('/weather', async (req, res) => {
    const options = {
        method: 'GET',
        url: 'https://weatherbit-v1-mashape.p.rapidapi.com/forecast/3hourly',
        params: { lat: '48.158930', lon: '-11.563740' },
        headers: {
            'x-rapidapi-host': 'weatherbit-v1-mashape.p.rapidapi.com',
            'x-rapidapi-key': process.env.RAPIDAPI_KEY
        }
    };

    try {
        const response = await axios.request(options);
        res.json(response.data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Axios error:', error.response?.data || error.message);
            res.status(500).json({ message: 'Axios error', error: error.response?.data || error.message });
        } else {
            console.error('Unexpected error:', error);
            res.status(500).json({ message: 'Unexpected error', error: error });
        }
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
