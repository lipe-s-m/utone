from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from typing import List, Dict, Any
import os
from ..services.youtube_service import search_youtube, download_youtube_audio, YouTubeVideo, get_autocomplete_suggestions, _cached_autocomplete

router = APIRouter()

@router.get("/search", response_model=List[YouTubeVideo])
async def search_videos(q: str):
    """
    Search YouTube videos by query.
    """
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter is required")

    # Now using await since search_youtube is async
    return await search_youtube(q)

@router.get("/autocomplete", response_model=List[YouTubeVideo])
async def autocomplete(q: str):
    """
    Get autocomplete suggestions for YouTube searches.
    """
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter is required")

    try:
        results = await get_autocomplete_suggestions(q)
        return results
    except Exception as e:
        print(f"Erro no endpoint autocomplete: {str(e)}")
        return []

@router.get("/debug/autocomplete")
async def debug_autocomplete(q: str) -> Dict[str, Any]:
    """
    Debug endpoint para verificar problemas de autocomplete.
    """
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter is required")

    # Tentar obter sugestões diretamente
    direct_result = _cached_autocomplete(q)

    # Tentar obter sugestões via função async
    async_result = await get_autocomplete_suggestions(q)

    return {
        "query": q,
        "direct_result": direct_result,
        "async_result": async_result,
        "direct_count": len(direct_result),
        "async_count": len(async_result)
    }

@router.get("/download/{video_id}")
async def download_video(video_id: str, background_tasks: BackgroundTasks):
    """
    Download YouTube video audio.
    """
    try:
        file_path, file_size = await download_youtube_audio(video_id)

        def cleanup():
            try:
                os.unlink(file_path)
            except Exception as e:
                print(f"Error cleaning up file {file_path}: {str(e)}")

        def iterfile():
            try:
                with open(file_path, 'rb') as f:
                    while chunk := f.read(8192):
                        yield chunk
            finally:
                cleanup()

        background_tasks.add_task(cleanup)

        return StreamingResponse(
            iterfile(),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f'attachment; filename="{video_id}.mp3"',
                "Content-Length": str(file_size)
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
