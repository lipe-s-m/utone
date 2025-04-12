from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from ..services.audio_service import process_audio
import logging

router = APIRouter()

@router.post("/process")
async def process_audio_file(
    file: UploadFile = File(...),
    pitch: float = Form(0.0),
    tempo: float = Form(1.0)
):
    """
    Process audio file with pitch shifting and time stretching.
    """
    try:
        # Log received file info
        print(f"Received file: name={file.filename}, content_type={file.content_type}, size={file.size}")

        # Validate content type
        if not file.content_type or not file.content_type.startswith('audio/'):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Expected audio file."
            )

        # Read file content
        content = await file.read()
        print(f"Read {len(content)} bytes from file")

        # Process audio
        try:
            processed_audio = process_audio(content, pitch, tempo)
            print(f"Audio processed successfully, returning {len(processed_audio)} bytes")

            # Return processed audio
            return Response(
                content=processed_audio,
                media_type="audio/wav"
            )
        except Exception as e:
            print(f"Error in audio processing: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error processing audio: {str(e)}"
            )

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Unexpected error in process_audio_file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
