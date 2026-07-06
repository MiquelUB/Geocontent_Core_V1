import os
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
# from models.base import Poi, OutboxEvent, get_session # To be uncommented when DB layer is fully setup

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

class VideoCompletionPayload(BaseModel):
    poi_id: str
    status: str
    video_url: str

@router.post("/video-completed")
async def video_completed_webhook(
    payload: VideoCompletionPayload, 
    x_internal_webhook_token: str = Header(...)
):
    # Seguretat Zero-Trust
    expected_token = os.getenv("WEBHOOK_SECRET")
    if not expected_token or x_internal_webhook_token != expected_token:
        raise HTTPException(status_code=403, detail="Accés denegat: Invalid Webhook Token")
    
    print(f"[Webhook] Rebuda confirmació de finalització de vídeo per al POI {payload.poi_id} amb estat {payload.status}")
    
    # MOCK d'Idempotència i actualització de DB fins que s'estableixi la sessió
    # async with get_session() as session:
    #     # 1. Obtenir el POI
    #     poi = await session.get(Poi, payload.poi_id)
    #     if not poi:
    #         raise HTTPException(status_code=404, detail="POI not found")
    #
    #     # Idempotència: comprovar si la URL ja existeix a l'array de vídeos
    #     if payload.video_url in poi.video_urls:
    #         return {"status": "acknowledged", "detail": "Already processed"}
    #
    #     # Afegir el nou vídeo HLS a l'array (només guardem el master playlist .m3u8)
    #     poi.video_urls.append(payload.video_url)
    #     
    #     # 2. Actualitzar OutboxEvent si calgués traçabilitat bidireccional
    #     # db.mark_outbox_completed(payload.poi_id)
    #
    #     await session.commit()
    
    return {"status": "acknowledged"}
