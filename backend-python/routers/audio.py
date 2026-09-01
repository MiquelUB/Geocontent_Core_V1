import os
import tempfile
import edge_tts
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict
import boto3

router = APIRouter(prefix="/audio", tags=["Audio (TTS)"])

class AudioGenerationRequest(BaseModel):
    poi_id: str
    texts: Dict[str, str]  # { "ca": "Text...", "es": "Texto..." }

class AudioGenerationResponse(BaseModel):
    success: bool
    urls: Dict[str, str]

def upload_to_s3(file_path: str, bucket: str, key: str, region: str, content_type: str = None, tenant_id: str = "default") -> str:
    # Depenent de l'endpoint configurat al .env (AWS, Cloudflare R2, Scaleway, etc.)
    s3_endpoint = os.getenv("S3_ENDPOINT")
    if s3_endpoint and not s3_endpoint.startswith("http"):
        s3_endpoint = f"https://{s3_endpoint}"
    
    # CRÍTIC: No passar endpoint_url per a AWS S3 estàndard.
    # Boto3 amb endpoint_url explícit força path-style addressing,
    # trencant la signatura SigV4 i generant AccessDenied.
    use_endpoint = None
    if s3_endpoint and "amazonaws.com" not in s3_endpoint:
        use_endpoint = s3_endpoint
        
    s3_client = boto3.client(
        's3',
        region_name=region,
        aws_access_key_id=os.getenv("S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY"),
        endpoint_url=use_endpoint
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
            
    import urllib.parse
    encoded_type = urllib.parse.quote_plus(content_type)
    tagging = f"TenantID={tenant_id}&Type={encoded_type}"

    uploaded = False
    last_err = None

    # Strategy 1: Plain PutObject
    try:
        with open(file_path, 'rb') as f:
            s3_client.put_object(
                Bucket=bucket,
                Key=key,
                Body=f,
                ContentType=content_type,
                CacheControl="max-age=0, no-cache, no-store, must-revalidate",
            )
        uploaded = True
    except Exception as e:
        last_err = e
        print(f"[S3 Upload] Plain PutObject failed for {key}: {e}. Retrying with Tagging...")

    # Strategy 2: PutObject with Tagging
    if not uploaded:
        try:
            with open(file_path, 'rb') as f:
                s3_client.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=f,
                    ContentType=content_type,
                    CacheControl="max-age=0, no-cache, no-store, must-revalidate",
                    Tagging=tagging,
                )
            uploaded = True
        except Exception as e:
            last_err = e
            print(f"[S3 Upload] PutObject with Tagging failed for {key}: {e}.")

    if not uploaded:
        raise last_err
    
    # Construïm la URL pública
    public_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    
    # Si estem fent servir CloudFront / CDN Custom
    cdn_url = os.getenv("NEXT_PUBLIC_CDN_URL")
    if cdn_url:
        return f"{cdn_url}/{key}"
        
    return public_url

async def generate_and_upload(poi_id: str, locale: str, text: str) -> str:
    # Assignem una veu segons l'idioma per a edge-tts
    voice_map = {
        "ca": "ca-ES-JoanaNeural",
        "es": "es-ES-ElviraNeural",
        "en": "en-US-AriaNeural",
        "fr": "fr-FR-DeniseNeural"
    }
    voice = voice_map.get(locale, "es-ES-ElviraNeural")
    
    communicate = edge_tts.Communicate(text, voice)
    
    fd, temp_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    
    try:
        await communicate.save(temp_path)
        
        # Upload to S3
        bucket = os.getenv("S3_BUCKET", "pxx-core-v1")
        region = os.getenv("S3_REGION", "eu-north-1")
        key = f"media/pois/{poi_id}/audio/{locale}.mp3"
        
        url = upload_to_s3(temp_path, bucket, key, region)
        return url
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/generate", response_model=AudioGenerationResponse)
async def generate_poi_audios(req: AudioGenerationRequest):
    """
    Endpoint Síncron.
    Genera les audioguies usant edge-tts (offline, gratuït, d'alta qualitat).
    Penja a S3 i retorna les URLs immeditament (temps procés < 10 segons).
    """
    results = {}
    
    # Generem tots els idiomes en paral·lel per reduir el temps d'espera al Next.js
    async def process_locale(locale: str, text: str):
        try:
            print(f"[TTS] Generant àudio per a POI {req.poi_id} en idioma {locale}...")
            url = await generate_and_upload(req.poi_id, locale, text)
            results[locale] = url
        except Exception as e:
            print(f"[TTS] Error generant {locale} per {req.poi_id}: {e}")
    
    tasks = [process_locale(locale, text) for locale, text in req.texts.items() if text.strip()]
    
    if tasks:
        await asyncio.gather(*tasks)
        
    return AudioGenerationResponse(success=True, urls=results)
