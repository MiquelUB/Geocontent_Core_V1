import os
import asyncio
import json
import httpx
import tempfile
import shutil
import asyncpg
import edge_tts
import boto3
from arq.connections import RedisSettings
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def notify_fastapi(poi_id: str, status: str, url: str = None):
    async with httpx.AsyncClient() as client:
        payload = {"poi_id": poi_id, "status": status, "video_url": url or ""}
        headers = {"x-internal-webhook-token": os.getenv("WEBHOOK_SECRET", "")}
        api_url = os.getenv('FASTAPI_PUBLIC_URL_OR_TAILSCALE_IP', 'http://127.0.0.1:8000')
        response = await client.post(
            f"{api_url}/webhooks/video-completed",
            json=payload,
            headers=headers,
            timeout=10.0
        )
        response.raise_for_status()

def upload_to_s3(file_path: str, bucket: str, key: str, region: str, content_type: str = None, tenant_id: str = "default") -> str:
    s3_endpoint = os.getenv("S3_ENDPOINT")
    if s3_endpoint and not s3_endpoint.startswith("http"):
        s3_endpoint = f"https://{s3_endpoint}"
        
    s3_client = boto3.client(
        's3',
        region_name=region,
        aws_access_key_id=os.getenv("S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY"),
        endpoint_url=s3_endpoint if s3_endpoint else None
    )
    
    if not content_type:
        if key.endswith(".mp4"):
            content_type = "video/mp4"
        elif key.endswith(".mp3"):
            content_type = "audio/mpeg"
        elif key.endswith(".wav"):
            content_type = "audio/wav"
        elif key.endswith(".m3u8"):
            content_type = "application/vnd.apple.mpegurl"
        else:
            content_type = "application/octet-stream"
            
    extra_args = {
        'ContentType': content_type,
        'CacheControl': 'max-age=31536000, immutable',
        'Tagging': f'TenantID={tenant_id}&Type={content_type}'
    }
    s3_client.upload_file(file_path, bucket, key, ExtraArgs=extra_args)
    public_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    cdn_url = os.getenv("NEXT_PUBLIC_CDN_URL")
    if cdn_url:
        return f"{cdn_url}/{key}"
    return public_url

async def generate_and_upload(poi_id: str, locale: str, text: str, voice_id: str) -> str:
    # Map voice_id to edge-tts neural voices based on locale
    # For now, default mappings if voice_id doesn't perfectly match edge-tts
    voice_map = {
        "ca": "ca-ES-JoanaNeural",
        "es": "es-ES-ElviraNeural",
        "en": "en-US-AriaNeural",
        "fr": "fr-FR-DeniseNeural"
    }
    
    if voice_id == "alloy" or voice_id == "echo" or voice_id == "onyx":
        # Male alternatives
        voice_map = {
            "ca": "ca-ES-EnricNeural",
            "es": "es-ES-AlvaroNeural",
            "en": "en-US-GuyNeural",
            "fr": "fr-FR-HenriNeural"
        }
    
    voice = voice_map.get(locale, "es-ES-ElviraNeural")
    communicate = edge_tts.Communicate(text, voice)
    fd, temp_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    
    try:
        await communicate.save(temp_path)
        bucket = os.getenv("S3_BUCKET", "pxx-core-v2-temporal")
        region = os.getenv("S3_REGION", "eu-north-1")
        key = f"media/pois/{poi_id}/audio/{locale}.mp3"
        url = upload_to_s3(temp_path, bucket, key, region)
        return url
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

async def process_tts_job(ctx, poi_id: str, voice_id: str):
    print(f"[Worker] Generant TTS per al POI {poi_id} amb veu {voice_id}...")
    try:
        pool = ctx['db_pool']
        async with pool.acquire() as conn:
            poi = await conn.fetchrow('SELECT * FROM pois WHERE id = $1', poi_id)
            if not poi:
                print(f"[Worker] POI {poi_id} no trobat a la BD.")
                return

            texts = {}
            for loc in ['ca', 'es', 'en', 'fr']:
                text = ""
                if loc == 'ca' and poi['voice_script']:
                    text = poi['voice_script']
                else:
                    # Helper per extreure del jsonb
                    def get_loc(field):
                        val = poi[field]
                        if isinstance(val, str):
                            try:
                                val = json.loads(val)
                            except:
                                pass
                        if isinstance(val, dict):
                            return val.get(loc, "")
                        return ""

                    text = get_loc('text_content_translations') or get_loc('description_translations') or get_loc('title_translations')

                if text and text.strip():
                    texts[loc] = text.strip()

            if not texts:
                print(f"[Worker] No hi ha textos per al POI {poi_id}.")
                return

            results = {}
            tasks = []
            
            async def process_locale(locale: str, text: str):
                try:
                    url = await generate_and_upload(poi_id, locale, text, voice_id)
                    results[locale] = url
                except Exception as e:
                    print(f"[TTS Worker] Error generant {locale}: {e}")

            for locale, text in texts.items():
                tasks.append(process_locale(locale, text))
                
            await asyncio.gather(*tasks)

            if results:
                # Update the pois table with the generated audio URLs
                current_audio = poi['audio_translations']
                if isinstance(current_audio, str):
                    try:
                        current_audio = json.loads(current_audio)
                    except:
                        current_audio = {}
                if not current_audio:
                    current_audio = {}
                    
                current_audio.update(results)
                default_url = results.get('ca') or list(results.values())[0]

                await conn.execute(
                    "UPDATE pois SET audio_translations = $1::jsonb, audio_url = $2 WHERE id = $3",
                    json.dumps(current_audio),
                    default_url,
                    poi_id
                )
                print(f"[Worker] TTS guardat correctament per {poi_id}")
                
                # Pub/Sub SSE Notification
                redis = ctx['redis']
                await redis.publish(f"poi_updates:{poi_id}", json.dumps({
                    "status": "SUCCESS",
                    "type": "AUDIO_GENERATION"
                }))
    except Exception as e:
        print(f"[Worker] Error processant TTS per {poi_id}: {e}")
        redis = ctx['redis']
        await redis.publish(f"poi_updates:{poi_id}", json.dumps({
            "status": "FAILED",
            "type": "AUDIO_GENERATION"
        }))

async def process_video_translation_job(ctx, poi_id: str, video_url: str, voice_id: str = None):
    print(f"[Worker] Traduint vídeo per al POI {poi_id} ({video_url}) amb veu {voice_id}...")
    try:
        from video_translation import translate_video_pipeline
        translated_urls = await translate_video_pipeline(video_url, poi_id, voice_id)
        
        pool = ctx['db_pool']
        async with pool.acquire() as conn:
            poi = await conn.fetchrow('SELECT video_translations FROM pois WHERE id = $1', poi_id)
            if poi:
                current_video = poi['video_translations']
                if isinstance(current_video, str):
                    try:
                        current_video = json.loads(current_video)
                    except:
                        current_video = {}
                if not current_video:
                    current_video = {}
                    
                if video_url not in current_video or not isinstance(current_video[video_url], dict):
                    current_video[video_url] = {}
                    
                # Ensure we don't wipe out existing translations if they exist and are valid
                for loc, url in translated_urls.items():
                    current_video[video_url][loc] = url
                    
                await conn.execute(
                    "UPDATE pois SET video_translations = $1::jsonb WHERE id = $2",
                    json.dumps(current_video),
                    poi_id
                )
        print(f"[Worker] Traducció de vídeo guardada per {poi_id}")
        
        # Pub/Sub SSE Notification
        redis = ctx['redis']
        await redis.publish(f"poi_updates:{poi_id}", json.dumps({
            "status": "SUCCESS",
            "type": "VIDEO_TRANSLATION",
            "url": video_url
        }))
    except Exception as e:
        print(f"[Worker] Error traduint vídeo per {poi_id}: {e}")
        try:
            pool = ctx['db_pool']
            async with pool.acquire() as conn:
                poi = await conn.fetchrow('SELECT video_translations FROM pois WHERE id = $1', poi_id)
                if poi:
                    current_video = poi['video_translations']
                    if isinstance(current_video, str):
                        try:
                            current_video = json.loads(current_video)
                        except:
                            current_video = {}
                    if not current_video:
                        current_video = {}
                    if video_url not in current_video or not isinstance(current_video[video_url], dict):
                        current_video[video_url] = {}
                    
                    for loc in ['es', 'en', 'fr']:
                        current_video[video_url][loc] = "ERROR"
                        
                    await conn.execute(
                        "UPDATE pois SET video_translations = $1::jsonb WHERE id = $2",
                        json.dumps(current_video),
                        poi_id
                    )
        except Exception as db_e:
            print(f"[Worker] Failed to save ERROR status to DB: {db_e}")
            
        redis = ctx['redis']
        await redis.publish(f"poi_updates:{poi_id}", json.dumps({
            "status": "FAILED",
            "type": "VIDEO_TRANSLATION",
            "url": video_url
        }))

async def process_hls_video(ctx, poi_id: str, video_path: str):
    print(f"[Worker] Transcodificant vídeo per al POI {poi_id} des de {video_path}...")
    temp_dir = tempfile.mkdtemp(prefix=f"hls_{poi_id}_")
    try:
        await asyncio.sleep(5)
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
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


async def outbox_poller(ctx):
    """
    Poller that queries the PostgreSQL 'outbox_events' table every 5 seconds,
    enqueues tasks into ARQ, and marks them as PROCESSING.
    """
    print("[Worker] Iniciant Outbox Poller...")
    pool = ctx['db_pool']
    redis = ctx['redis']
    
    while True:
        try:
            async with pool.acquire() as conn:
                # Fetch pending events safely using SKIP LOCKED
                events = await conn.fetch(
                    "SELECT id, tipus_event, payload FROM outbox_events WHERE estat = 'PENDING' ORDER BY creat_el ASC LIMIT 10 FOR UPDATE SKIP LOCKED"
                )
                
                for event in events:
                    event_id = event['id']
                    topic = event['tipus_event']
                    
                    payload = event['payload']
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                        
                    # Mark as PROCESSING
                    await conn.execute("UPDATE outbox_events SET estat = 'PROCESSING' WHERE id = $1", event_id)
                    
                    # Enqueue to ARQ
                    if topic == 'GENERATE_TTS':
                        poi_id = payload.get('poiId')
                        voice_id = payload.get('voiceId', 'nova')
                        if poi_id:
                            await redis.enqueue_job('process_tts_job', poi_id, voice_id)
                    elif topic == 'TRANSLATE_VIDEO':
                        poi_id = payload.get('poiId')
                        video_url = payload.get('videoUrl')
                        if poi_id and video_url:
                            await redis.enqueue_job('process_video_translation_job', poi_id, video_url)
                    else:
                        print(f"[Worker] Topic desconegut: {topic}")
                        
                    # For simplicity, we mark COMPLETED immediately after enqueuing.
                    # In a robust system, the job itself should mark it COMPLETED via a callback or DB update.
                    await conn.execute("UPDATE outbox_events SET estat = 'COMPLETED' WHERE id = $1", event_id)
                    
        except Exception as e:
            print(f"[Outbox Poller] Error: {e}")
            
        await asyncio.sleep(5)


async def startup(ctx):
    print("[Worker] Iniciant ARQ Worker...")
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        # asyncpg does not support prisma-specific parameters like pgbouncer=true
        if "?pgbouncer=true" in db_url:
            db_url = db_url.replace("?pgbouncer=true", "")
        if "&pgbouncer=true" in db_url:
            db_url = db_url.replace("&pgbouncer=true", "")
            
        ctx['db_pool'] = await asyncpg.create_pool(db_url, statement_cache_size=0)
        # POLLEO DE POSTGRES ELIMINAT: 
        # La creació asíncrona de tasques ara es farà via Webhooks/FastAPI o Redis directament 
        # per evitar bloquejos (Efecte Forat Negre).
        # ctx['poller_task'] = asyncio.create_task(outbox_poller(ctx))
    else:
        print("[Worker] DATABASE_URL no definida. El Outbox Poller no s'iniciarà.")

async def shutdown(ctx):
    print("[Worker] Apagant ARQ Worker...")
    if 'poller_task' in ctx:
        ctx['poller_task'].cancel()
    if 'db_pool' in ctx:
        await ctx['db_pool'].close()

class WorkerSettings:
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        redis_settings = RedisSettings.from_dsn(redis_url)
    else:
        redis_settings = RedisSettings(
            host=os.getenv("REDIS_HOST", "127.0.0.1"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            password=os.getenv("REDIS_PASSWORD", None),
            conn_timeout=5,
            conn_retries=5,
            conn_retry_delay=2,
        )
    
    functions = [process_hls_video, process_tts_job, process_video_translation_job]
    on_startup = startup
    on_shutdown = shutdown
    
    job_timeout = 3600  
    max_jobs = 1        
    max_tries = 3       
