from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn
from app.routes import youtube_router, audio_router

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(title="UTone API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(youtube_router.router, prefix="/api/youtube", tags=["youtube"])
app.include_router(audio_router.router, prefix="/api/audio", tags=["audio"])

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=3000, reload=True)
