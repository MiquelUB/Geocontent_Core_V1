import os
import tempfile
import subprocess
import httpx
import json
import edge_tts
import asyncio
from routers.audio import upload_to_s3
from routers.s3 import get_s3_client

async def transcribe_audio_openrouter(audio_path: str) -> tuple[str, float]:
    """Uses OpenRouter's /api/v1/audio/transcriptions endpoint (OpenAI Whisper compatible). Returns (text, start_time_ms)"""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not set.")

    url = "https://openrouter.ai/api/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }

    from openai import AsyncOpenAI

    print(f"[Video Translator] Transcribing audio with OpenRouter using OpenAI library...")
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    
    with open(audio_path, 'rb') as audio_file:
        transcription = await client.audio.transcriptions.create(
            model="openai/whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["segment"]
        )
        
        start_time_ms = 0.0
        text = ""
        
        if hasattr(transcription, 'segments') and transcription.segments:
            # Trobar el primer segment que probablement conté veu (per evitar al·lucinacions inicials)
            for seg in transcription.segments:
                # no_speech_prob pot no venir sempre depenent de l'API, per defecte 0
                no_speech = getattr(seg, 'no_speech_prob', 0.0)
                if no_speech < 0.6:
                    start_time_ms = seg.start * 1000
                    break
        
        if isinstance(transcription, str):
            text = transcription
        elif hasattr(transcription, 'text'):
            text = transcription.text
        else:
            text = str(transcription)
            
        return text, start_time_ms

async def translate_text_openrouter(text: str, target_lang: str = "en") -> str:
    """Translates text using OpenRouter Chat Completions."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    
    # Use the dedicated translation model ID if provided, otherwise fallback to gpt-4o-mini
    model = os.getenv("AI_MODEL_TRANSLATE_ID", "openai/gpt-4o-mini")
    if model == "google/gemini-2.0-flash-001" or "gemini-2.0-flash-001" in model:
        model = "openai/gpt-4o-mini"
        
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    prompt = f"Translate the following text to {target_lang}. Return ONLY the translated text, without any additional comments, markdown, or quotes.\n\nText: {text}"

    data = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3
    }

    print(f"[Video Translator] Translating text to {target_lang} using {model}...")
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=data, timeout=30.0)
        response.raise_for_status()
        result = response.json()
        return result['choices'][0]['message']['content'].strip()

async def generate_local_tts(text: str, locale: str, voice_id: str = "nova") -> str:
    print(f"[Video Translator] Generating TTS for locale {locale} with voice {voice_id}...")
    
    # Mapeig de veus segons la selecció de l'usuari (nova = dona, echo/alloy = home)
    if voice_id in ["echo", "alloy"]:
        voice_map = {
            "ca": "ca-ES-EnricNeural",
            "es": "es-ES-AlvaroNeural",
            "en": "en-US-GuyNeural",
            "fr": "fr-FR-HenriNeural"
        }
    else:
        voice_map = {
            "ca": "ca-ES-JoanaNeural",
            "es": "es-ES-ElviraNeural",
            "en": "en-US-AriaNeural",
            "fr": "fr-FR-DeniseNeural"
        }
        
    voice = voice_map.get(locale, "en-US-AriaNeural" if voice_id not in ["echo", "alloy"] else "en-US-GuyNeural")
    communicate = edge_tts.Communicate(text, voice)
    
    fd, temp_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    
    await communicate.save(temp_path)
    return temp_path

async def merge_audio_video(video_path: str, audio_path: str, output_path: str, start_delay_ms: float = 0):
    """Replaces the audio track of the video with the new audio track using FFmpeg, delaying audio if needed."""
    print(f"[Video Translator] Merging new audio with original video (delay: {start_delay_ms}ms)...")
    delay = int(start_delay_ms)
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-filter_complex", f"[1:a]adelay={delay}|{delay}[a]",
        "-map", "0:v:0",
        "-map", "[a]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "28",
        "-c:a", "aac",
        "-movflags", "+faststart",
        "-threads", "2",
        output_path
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
    )
    await process.wait()
    if process.returncode != 0:
        raise Exception(f"FFmpeg failed with return code {process.returncode}")

async def translate_video_pipeline(video_url: str, poi_id: str, voice_id: str = "nova") -> str:
    """
    1. Downloads video
    2. Extracts audio
    3. Transcribes to text
    4. Translates text
    5. Generates TTS
    6. Merges TTS with video
    7. Uploads to S3 and returns URL
    """
    temp_dir = tempfile.mkdtemp(prefix=f"vid_trans_{poi_id}_")
    
    try:
        orig_video_path = os.path.join(temp_dir, "orig.mp4")
        orig_audio_path = os.path.join(temp_dir, "orig.wav")
        
        # 1. Download Video
        print(f"[Video Translator] Downloading video {video_url}...")
        if "amazonaws.com" in video_url:
            import urllib.parse
            s3 = get_s3_client()
            parsed_url = urllib.parse.urlparse(video_url)
            if ".s3." in parsed_url.hostname:
                bucket = parsed_url.hostname.split(".s3.")[0]
                key = urllib.parse.unquote(parsed_url.path.lstrip('/'))
            else:
                parts = parsed_url.path.lstrip('/').split('/')
                bucket = parts[0]
                key = urllib.parse.unquote('/'.join(parts[1:]))
            # Descarreguem de forma segura usant les credencials
            s3.download_file(bucket, key, orig_video_path)
        else:
            async with httpx.AsyncClient() as client:
                async with client.stream("GET", video_url, follow_redirects=True) as response:
                    response.raise_for_status()
                    with open(orig_video_path, 'wb') as f:
                        async for chunk in response.aiter_bytes():
                            f.write(chunk)

        # 2. Extract Audio
        print(f"[Video Translator] Extracting audio...")
        ext_cmd = ["ffmpeg", "-y", "-i", orig_video_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", orig_audio_path]
        ext_proc = await asyncio.create_subprocess_exec(
            *ext_cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
        )
        await ext_proc.wait()
        if ext_proc.returncode != 0:
            raise Exception(f"FFmpeg audio extraction failed with code {ext_proc.returncode}")

        # 3. Transcribe
        transcribed_text, start_time_ms = await transcribe_audio_openrouter(orig_audio_path)
        print(f"[Video Translator] Transcription: {transcribed_text[:50]}... (starts at {start_time_ms}ms)")

        # Process each locale
        locales = ['es', 'en', 'fr']
        results = {}
        
        for loc in locales:
            final_video_path = os.path.join(temp_dir, f"final_{loc}.mp4")
            tts_audio_path = None
            
            try:
                # 4. Translate
                if not transcribed_text.strip():
                    print(f"[Video Translator] No text transcribed. Skipping translation for {loc}.")
                    translated_text = "No audio detected."
                else:
                    translated_text = await translate_text_openrouter(transcribed_text, target_lang=loc)
                    print(f"[Video Translator] Translation to {loc}: {translated_text[:50]}...")

                # 5. Generate TTS
                tts_audio_path = await generate_local_tts(translated_text, locale=loc, voice_id=voice_id)

                # 6. Merge
                await merge_audio_video(orig_video_path, tts_audio_path, final_video_path, start_time_ms)
                
                # 7. Upload to S3 (usa el bucket configurat a l'entorn d'Easypanel)
                bucket = os.getenv("S3_BUCKET", "pxx-core-v2-temporal")
                region = os.getenv("S3_REGION", "eu-north-1")
                key = f"media/pois/{poi_id}/video/{loc}.mp4"
                
                print(f"[Video Translator] Uploading {loc} to S3 bucket '{bucket}'...")
                url = upload_to_s3(final_video_path, bucket, key, region)
                results[loc] = url
            except Exception as e:
                print(f"[Video Translator] Failed processing {loc}: {e}")
                results[loc] = "ERROR"
            finally:
                if tts_audio_path and os.path.exists(tts_audio_path):
                    os.remove(tts_audio_path)
                    
        return results

    finally:
        for f in os.listdir(temp_dir):
            os.remove(os.path.join(temp_dir, f))
        os.rmdir(temp_dir)
