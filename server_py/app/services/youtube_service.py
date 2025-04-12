from typing import List, Dict, Any
import yt_dlp
from fastapi import HTTPException
import tempfile
import os
from pathlib import Path
from pydantic import BaseModel
from functools import lru_cache
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pytube import YouTube
from pytube import request
import pytube.request
import shutil
import re
from urllib.parse import quote
import requests
import json
import subprocess
from pytube.exceptions import PytubeError, RegexMatchError, VideoUnavailable

# Configuração do caminho do FFmpeg
FFMPEG_PATH = "ffmpeg"  # Usando o FFmpeg do sistema

class YouTubeVideo(BaseModel):
    id: str
    title: str
    channelTitle: str
    thumbnail: str
    duration: str  # duração em string para compatibilidade com frontend

# Create a thread pool for running operations
thread_pool = ThreadPoolExecutor(max_workers=4)

def get_appropriate_thumbnail(thumbnails: List[Dict], video_id: str) -> str:
    """
    Get the most appropriate thumbnail size.
    Try to get the best quality available, with fallbacks.
    """
    # First try direct YouTube URLs in different qualities
    quality_options = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default']
    for quality in quality_options:
        url = f"https://img.youtube.com/vi/{video_id}/{quality}.jpg"
        try:
            response = requests.head(url, timeout=2)
            if response.status_code == 200:
                return url
        except:
            continue

    # If direct URLs fail, try thumbnails from the API response
    if thumbnails:
        # Sort thumbnails by resolution (width * height) in descending order
        sorted_thumbnails = sorted(
            [t for t in thumbnails if t.get('width') and t.get('height')],
            key=lambda x: (x.get('width', 0) * x.get('height', 0)),
            reverse=True
        )

        # Try to find the best quality thumbnail
        for thumb in sorted_thumbnails:
            url = thumb.get('url', '')
            if url:
                try:
                    response = requests.head(url, timeout=2)
                    if response.status_code == 200:
                        return url
                except:
                    continue

    # Ultimate fallback
    return f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"

@lru_cache(maxsize=100)
def _cached_search(query: str) -> List[Dict]:
    """
    Cached version of YouTube search to improve performance.
    """
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'default_search': 'ytsearch',
            'skip_download': True,
            'max_downloads': 10,
            'socket_timeout': 10,  # Add timeout to prevent hanging
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(f"ytsearch10:{query}", download=False)
    except Exception as e:
        print(f"Error in _cached_search: {str(e)}")
        # Return empty result instead of raising exception
        return {"entries": []}

async def search_youtube(query: str) -> List[YouTubeVideo]:
    """
    Search YouTube videos using yt-dlp with async support and caching.
    """
    try:
        # Run yt-dlp search in thread pool to not block the event loop
        loop = asyncio.get_event_loop()

        # Add timeout to prevent hanging
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(thread_pool, _cached_search, query),
                timeout=15.0  # 15 second timeout
            )
        except asyncio.TimeoutError:
            print(f"Search timed out for query: {query}")
            result = {"entries": []}
        except asyncio.CancelledError:
            print(f"Search was cancelled for query: {query}")
            result = {"entries": []}

        if not result or 'entries' not in result:
            return []

        videos = []
        for entry in result['entries']:
            if not entry:
                continue

            try:
                video_id = entry.get('id', '')
                if not video_id:
                    continue

                # Get best thumbnail with a short timeout
                thumbnail_url = get_appropriate_thumbnail(
                    entry.get('thumbnails', []),
                    video_id
                )

                # Get duration in seconds (with default of 0)
                duration = int(entry.get('duration', 0))

                # Get channel name with fallback
                channel = entry.get('channel', '') or entry.get('uploader', '') or "Unknown channel"

                video = YouTubeVideo(
                    id=video_id,
                    title=entry.get('title', 'Unknown title'),
                    channelTitle=channel,
                    thumbnail=thumbnail_url,
                    duration=str(duration)
                )
                videos.append(video)
            except Exception as e:
                print(f"Error processing video entry: {str(e)}")
                continue

        return videos

    except Exception as e:
        print(f"Error in search_youtube: {str(e)}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Error searching YouTube")

def _download_audio(video_id: str) -> tuple[str, int]:
    """
    Download YouTube audio using yt-dlp CLI via subprocess and FFmpeg.
    Returns a tuple of (file_path, file_size).
    """
    temp_dir = None
    try:
        print(f"Starting download for video ID: {video_id}")
        temp_dir = tempfile.mkdtemp()
        print(f"Created temporary directory: {temp_dir}")
        url = f"https://www.youtube.com/watch?v={video_id}"

        # --- FFmpeg Check (remains the same) ---
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True, text=True, encoding='utf-8')
            print("FFmpeg is available in the system")
        except FileNotFoundError:
             print("FFmpeg command not found. Please ensure FFmpeg is installed and in PATH.")
             raise Exception("FFmpeg não está disponível no sistema. Por favor, instale o FFmpeg.")
        except subprocess.CalledProcessError as e:
            print(f"FFmpeg check failed: {e}")
            raise Exception(f"Erro ao verificar FFmpeg: {e}")
        except Exception as e:
            print(f"FFmpeg check failed unexpectedly: {str(e)}")
            raise Exception(f"Erro inesperado ao verificar FFmpeg: {str(e)}")
        # --- End FFmpeg Check ---

        print(f"Attempting download with yt-dlp CLI via subprocess...")
        output_template = os.path.join(temp_dir, f"{video_id}.%(ext)s")
        expected_mp3_path = os.path.join(temp_dir, f"{video_id}.mp3")

        # Build the yt-dlp command
        # Using 'bestaudio/best' and letting FFmpeg handle the conversion might be more reliable
        cmd = [
            'python', '-m', 'yt_dlp',
            '-f', 'bestaudio/best',  # Select best audio format
            '-x',  # Extract audio
            '--audio-format', 'mp3',  # Specify desired audio format
            '--audio-quality', '192K',  # Specify audio quality
            '-o', output_template,  # Output template
            '--no-check-certificate',
            '--geo-bypass',
            '--quiet', # Suppress normal output, show only errors
            '--progress', # Show progress bar
            '--verbose', # Show more detailed logs for debugging
            url
        ]

        print(f"Running command: {' '.join(cmd)}")
        try:
            # Use capture_output=True to get stdout/stderr for better debugging
            result = subprocess.run(cmd, check=True, capture_output=True, text=True, encoding='utf-8')
            print("yt-dlp command finished successfully.")
            print("yt-dlp stdout:")
            print(result.stdout)
            print("yt-dlp stderr:") # Stderr might contain warnings or progress
            print(result.stderr)
        except subprocess.CalledProcessError as e:
            print(f"yt-dlp command failed with exit code {e.returncode}")
            print("yt-dlp stdout:")
            print(e.stdout)
            print("yt-dlp stderr:")
            print(e.stderr)
            raise Exception(f"Erro ao executar yt-dlp: {e.stderr}")
        except FileNotFoundError:
             print("Error: 'python -m yt_dlp' command not found. Is yt-dlp installed correctly in this Python environment?")
             raise Exception("Comando yt-dlp não encontrado. Verifique a instalação.")
        except Exception as e:
            print(f"An unexpected error occurred running yt-dlp: {type(e).__name__}: {e}")
            raise

        # Check if the expected MP3 file exists
        if not os.path.exists(expected_mp3_path):
            # Check for other potential audio files if mp3 wasn't created directly
            found_files = os.listdir(temp_dir)
            print(f"Expected MP3 not found. Files in temp dir: {found_files}")
            # Try to find any audio file yt-dlp might have created
            audio_files = [f for f in found_files if f.startswith(video_id) and f.split('.')[-1] in ['m4a', 'webm', 'opus', 'aac', 'ogg']]
            if audio_files:
                # This part should ideally not be needed if -x --audio-format mp3 works
                print(f"Found alternative audio file: {audio_files[0]}. Conversion might be needed (but FFmpeg should handle it).")
                # Force renaming if necessary, though yt-dlp should output mp3
                os.rename(os.path.join(temp_dir, audio_files[0]), expected_mp3_path)
            else:
                 raise Exception(f"Nenhum arquivo MP3 ({expected_mp3_path}) encontrado após a execução do yt-dlp.")

        file_size = os.path.getsize(expected_mp3_path)
        print(f"Download completed successfully. File path: {expected_mp3_path}, File size: {file_size} bytes")
        return expected_mp3_path, file_size

    except Exception as e:
        print(f"Error in _download_audio: {type(e).__name__}: {str(e)}")
        if temp_dir:
            try:
                shutil.rmtree(temp_dir)
                print(f"Cleaned up temporary directory: {temp_dir}")
            except Exception as cleanup_error:
                print(f"Error cleaning up temporary directory: {str(cleanup_error)}")
        # Re-raise the original exception for the caller to handle
        raise Exception(f"Falha no download do áudio: {str(e)}") from e

async def download_youtube_audio(video_id: str) -> tuple[str, int]:
    """
    Download YouTube video audio with async support and error handling.
    Returns a tuple of (file_path, file_size).
    """
    try:
        print(f"\n=== Starting download process for video {video_id} ===")
        # Validate video ID
        if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
            print(f"Invalid video ID format: {video_id}")
            raise HTTPException(
                status_code=400,
                detail="ID do vídeo inválido"
            )

        # Check if video exists before attempting download
        check_url = f"https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v={video_id}&format=json"
        print(f"Checking video availability at: {check_url}")
        response = requests.head(check_url)
        if response.status_code != 200:
            print(f"Video not found. Status code: {response.status_code}")
            raise HTTPException(
                status_code=404,
                detail="Vídeo não encontrado ou não disponível"
            )
        print("Video exists and is available")

        # Run download in thread pool
        print("Starting download in thread pool")
        loop = asyncio.get_event_loop()
        file_path, file_size = await loop.run_in_executor(
            thread_pool,
            _download_audio,
            video_id
        )
        print(f"Download completed. File path: {file_path}, size: {file_size}")
        return file_path, file_size

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error downloading YouTube audio: {str(e)}")
        print(f"Full error details: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Não foi possível baixar o áudio. Por favor, tente novamente ou escolha outro vídeo."
        )

def format_duration(seconds: int) -> str:
    """
    Formata a duração do vídeo em um formato legível.
    """
    if not seconds:
        return "0:00"

    minutes = seconds // 60
    remaining_seconds = seconds % 60

    if minutes >= 60:
        hours = minutes // 60
        minutes = minutes % 60
        return f"{hours}:{minutes:02d}:{remaining_seconds:02d}"

    return f"{minutes}:{remaining_seconds:02d}"

@lru_cache(maxsize=100)
def _cached_autocomplete(query: str) -> List[Dict[str, Any]]:
    """
    Get autocomplete suggestions for a query using yt-dlp with complete video information.
    """
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'default_search': 'ytsearch',
            'skip_download': True,
            'max_downloads': 6,  # Limitado a 6 resultados para melhor performance
        }

        # Usar yt-dlp para obter informações completas dos vídeos
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            search_results = ydl.extract_info(f"ytsearch6:{query}", download=False)
            if search_results and 'entries' in search_results:
                suggestions = []
                for entry in search_results['entries']:
                    if entry and 'title' in entry:
                        duration = int(entry.get('duration', 0))
                        video_info = YouTubeVideo(
                            id=entry.get('id', ''),
                            title=entry.get('title', 'Título desconhecido'),
                            channelTitle=entry.get('channel', entry.get('uploader', 'Canal desconhecido')),
                            thumbnail=get_appropriate_thumbnail(entry.get('thumbnails', []), entry.get('id', '')),
                            duration=format_duration(duration)
                        )
                        suggestions.append(video_info)
                return suggestions

        return []
    except Exception as e:
        print(f"Error in autocomplete: {str(e)}")
        return []

async def get_autocomplete_suggestions(query: str) -> List[Dict[str, Any]]:
    """
    Get autocomplete suggestions for YouTube searches with complete video information.
    """
    if not query or len(query) < 2:
        return []

    try:
        loop = asyncio.get_event_loop()
        try:
            suggestions = await loop.run_in_executor(thread_pool, _cached_autocomplete, query)
            print(f"Autocomplete suggestions for '{query}': {len(suggestions)} results")
            return suggestions
        except Exception as e:
            print(f"Error in executor: {str(e)}")
            return _cached_autocomplete(query)

    except Exception as e:
        print(f"Error in get_autocomplete_suggestions: {str(e)}")
        try:
            return _cached_autocomplete(query)
        except:
            return []
