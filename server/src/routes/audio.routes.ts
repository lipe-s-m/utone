import { Router } from 'express';
import multer from 'multer';
import { processAudio } from '../controllers/audio.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/process', upload.single('file'), processAudio);

export const audioRouter = router;
