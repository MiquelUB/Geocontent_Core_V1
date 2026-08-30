import os
from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(prefix="/omnivoice", tags=["OmniVoice Tasks"])

class TTSRequest(BaseModel):
    poi_id: str
    voice_id: str

class VideoTranslationRequest(BaseModel):
    poi_id: str
    video_url: str
    voice_id: str

@router.post("/tts")
async def trigger_tts(req: Request, payload: TTSRequest):
    """
    Encua una tasca de generació de TTS directament a ARQ.
    Això substitueix l'Outbox pattern (Efecte Forat Negre).
    """
    arq_pool = req.app.state.arq_pool
    await arq_pool.enqueue_job('process_tts_job', payload.poi_id, payload.voice_id)
    return {"success": True, "message": "TTS job enqueued"}

@router.post("/video-translate")
async def trigger_video_translate(req: Request, payload: VideoTranslationRequest):
    """
    Encua una tasca de traducció de vídeo directament a ARQ.
    """
    arq_pool = req.app.state.arq_pool
    await arq_pool.enqueue_job('process_video_translation_job', payload.poi_id, payload.video_url, payload.voice_id)
    return {"success": True, "message": "Video translation job enqueued"}
