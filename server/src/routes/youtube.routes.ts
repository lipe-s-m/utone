import { Router } from 'express';
import { searchVideos, downloadVideo } from '../controllers/youtube.controller';

const router = Router();

router.get('/search', searchVideos);
router.get('/download/:videoId', downloadVideo);

export const youtubeRouter = router;
