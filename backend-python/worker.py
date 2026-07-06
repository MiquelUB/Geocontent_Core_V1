import os
import asyncio
import httpx
import tempfile
import shutil
from arq.connections import RedisSettings
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

load_dotenv()

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def notify_fastapi(poi_id: str, status: str, url: str = None):
    async with httpx.AsyncClient() as client:
        payload = {"poi_id": poi_id, "status": status, "video_url": url or ""}
        headers = {"x-internal-webhook-token": os.getenv("WEBHOOK_SECRET", "")}
        
        # Corregit: L'URL ha de ser accessible des de la màquina externa (domini públic o IP Tailscale)
        api_url = os.getenv('FASTAPI_PUBLIC_URL_OR_TAILSCALE_IP', 'http://127.0.0.1:8000')
        
        response = await client.post(
            f"{api_url}/webhooks/video-completed",
            json=payload,
            headers=headers,
            timeout=10.0
        )
        response.raise_for_status()

async def process_hls_video(ctx, poi_id: str, video_path: str):
    print(f"[Worker] Transcodificant vídeo per al POI {poi_id} des de {video_path}...")
    
    # Crea un directori temporal efímer per a aquesta tasca concreta
    temp_dir = tempfile.mkdtemp(prefix=f"hls_{poi_id}_")
    
    try:
        # Simulem que FFmpeg triga uns segons...
        await asyncio.sleep(5)
        
        # ---------------------------------------------------------
        # ESTRUCTURA DEL PIPELINE FFMPEG (HLS):
        # 1. Descàrrega S3 -> temp_dir
        # 2. Execució de subprocess amb ffmpeg -> guarda a temp_dir
        #    ffmpeg -i input.mp4 -profile:v baseline -level 3.0 -s 1280x720 -start_number 0 \
        #      -hls_time 10 -hls_list_size 0 -f hls output.m3u8
        # 3. Pujada concurrent (ThreadPoolExecutor) a S3 des de temp_dir
        #    - Boto3 injecta 'Cache-Control: max-age=31536000, immutable' per als .ts
        #    - Primer pugen els .ts, un cop finalitzats, puja el .m3u8
        # ---------------------------------------------------------
        
        # URL simulada final del manifest m3u8
        bucket = os.getenv("S3_BUCKET", "pxx-core-v1")
        region = os.getenv("S3_REGION", "eu-north-1")
        video_url = f"https://{bucket}.s3.{region}.amazonaws.com/media/pois/{poi_id}/video/playlist.m3u8"
        
        print(f"[Worker] Finalitzat HLS per a {poi_id}. Notificant a FastAPI...")
        await notify_fastapi(poi_id, "COMPLETED", video_url)
        return True
    
    except Exception as e:
        print(f"[Worker] Error en el processament: {e}")
        raise e
    
    finally:
        # Aquest bloc s'executa SEMPRE. Prevenció total de fuites de disc.
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


async def startup(ctx):
    print("[Worker] Iniciant ARQ Worker...")

async def shutdown(ctx):
    print("[Worker] Apagant ARQ Worker...")

class WorkerSettings:
    """Configuració de l'ARQ Worker amb Resiliència i ACKs"""
    redis_settings = RedisSettings(
        host=os.getenv("REDIS_HOST", "127.0.0.1"),  # Apuntar a Tailscale IP de l'Hetzner
        port=int(os.getenv("REDIS_PORT", 6379)),
        password=os.getenv("REDIS_PASSWORD", None),
        # Resiliència de connexió amb el Broker extern via VPN
        conn_timeout=5,
        conn_retries=5,
        conn_retry_delay=2,
    )
    
    functions = [process_hls_video]
    on_startup = startup
    on_shutdown = shutdown
    
    # 🚨 Prevenció de Tasques Zombi i ACKs 🚨
    # job_timeout: Si FFmpeg penja més d'1 hora, s'aborta i retorna a la cua.
    job_timeout = 3600  
    # max_jobs: Només 2 vídeos concurrents per no saturar la CPU/Memòria de la GPU externa.
    max_jobs = 2        
    # max_tries: Si hi ha microtalls de xarxa, es reintenta la tasca sencera (ex: fallada pujant a S3).
    max_tries = 3       
