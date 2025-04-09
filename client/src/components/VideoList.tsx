import React, { useState } from "react";
import { Video } from "../types/video";
import { downloadVideo } from "../services/api";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";

interface VideoListProps {
  videos: Video[];
}

interface DownloadProgress {
  [key: string]: number;
}

export const VideoList: React.FC<VideoListProps> = ({ videos }) => {
  const [downloading, setDownloading] = useState<DownloadProgress>({});

  const handleDownload = async (videoId: string) => {
    try {
      setDownloading((prev) => ({ ...prev, [videoId]: 0 }));

      const response = await downloadVideo(videoId);
      const reader = response.body?.getReader();
      const contentLength = Number(response.headers.get("Content-Length"));

      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      let receivedLength = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        receivedLength += value.length;
        const progress = (receivedLength / contentLength) * 100;
        setDownloading((prev) => ({ ...prev, [videoId]: progress }));
      }

      setDownloading((prev) => ({ ...prev, [videoId]: 100 }));
    } catch (error) {
      console.error("Error downloading video:", error);
      setDownloading((prev) => ({ ...prev, [videoId]: 0 }));
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {videos.map((video) => (
        <Box
          key={video.id}
          sx={{ display: "flex", alignItems: "center", gap: 2 }}
        >
          <Typography variant="h6">{video.title}</Typography>
          <Typography variant="body2" color="textSecondary">
            {video.channelTitle}
          </Typography>
          <Button
            variant="contained"
            startIcon={
              downloading[video.id] ? (
                <CircularProgress size={20} />
              ) : (
                <DownloadIcon />
              )
            }
            onClick={() => handleDownload(video.id)}
            disabled={downloading[video.id] > 0}
          >
            {downloading[video.id]
              ? `${Math.round(downloading[video.id])}%`
              : "Download"}
          </Button>
        </Box>
      ))}
    </Box>
  );
};
