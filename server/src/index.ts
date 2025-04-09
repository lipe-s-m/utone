import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { youtubeRouter } from './routes/youtube.routes';
import { audioRouter } from './routes/audio.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rotas
app.use('/api/youtube', youtubeRouter);
app.use('/api/audio', audioRouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
