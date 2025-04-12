from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import youtube_router, audio_router

app = FastAPI()

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Frontend Angular
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas
app.include_router(youtube_router.router, prefix="/api/youtube")
app.include_router(audio_router.router, prefix="/api/audio")
