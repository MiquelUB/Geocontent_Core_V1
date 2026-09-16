import os
import tempfile
import subprocess
import httpx
import json
import edge_tts
import asyncio
from routers.audio import upload_to_s3
from routers.s3 import get_s3_client

async def transcribe_audio_openrouter(audio_path: str):
    """Uses OpenRouter's /api/v1/audio/transcriptions endpoint (OpenAI Whisper compatible). Returns list of segments."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not set.")

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
        
        segments = []
        if hasattr(transcription, 'segments') and transcription.segments:
            for seg in transcription.segments:
                no_speech = getattr(seg, 'no_speech_prob', 0.0)
                if no_speech < 0.6 and seg.text.strip():
                    segments.append({
                        "start": seg.start * 1000,
                        "end": seg.end * 1000,
                        "text": seg.text.strip()
                    })
        else:
            # Fallback if segments aren't supported
            text = transcription.text if hasattr(transcription, 'text') else str(transcription)
            if text.strip():
                segments.append({"start": 0.0, "end": 10000.0, "text": text.strip()})
                
        return segments

async def translate_text_openrouter(segments: list, target_lang: str = "en") -> list:
    """Translates a list of segment dictionaries using OpenRouter Chat Completions, keeping JSON array structure."""
    if not segments:
        return []
        
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("AI_MODEL_TRANSLATE_ID", "openai/gpt-4o-mini")
    
    # Fix invalid gemini model IDs for OpenRouter
    if "gemini-flash-1.5" in model or "gemini-1.5-flash" in model or "gemini-2.0-flash" in model:
        model = "google/gemini-2.5-flash"
        
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    texts = [seg['text'] for seg in segments]
    
    prompt = f"Translate the following JSON array of strings to {target_lang}. Return ONLY a valid JSON array of translated strings with the exact same number of elements, without any additional markdown or comments.\n\nInput: {json.dumps(texts)}"

    data = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }

    print(f"[Video Translator] Translating {len(texts)} segments to {target_lang} using {model}...")
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=data, timeout=60.0)
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content'].strip()
        
        # Robust JSON extraction
        import re
        match = re.search(r'\[.*\]', content.replace('\n', ' '))
        if match:
            content = match.group(0)
            
        try:
            translated_texts = json.loads(content.strip())
            if not isinstance(translated_texts, list):
                if isinstance(translated_texts, str):
                    translated_texts = [translated_texts]
                else:
                    translated_texts = texts
        except json.JSONDecodeError:
            print(f"[Video Translator] JSON parse error on translation: {content}")
            translated_texts = texts # Fallback to original text if JSON parsing fails
            
        # If the model didn't return exactly the same number of elements, we just map what we can
        translated_segments = []
        for i, seg in enumerate(segments):
            t_text = translated_texts[i] if i < len(translated_texts) else seg['text']
            translated_segments.append({
                "start": seg['start'],
                "end": seg['end'],
                "text": t_text
            })
            
        return translated_segments

async def generate_local_tts(text: str, locale: str, voice_id: str = "nova") -> str:
    print(f"[Video Translator] Generating TTS for locale {locale} with voice {voice_id}...")
    
    # Mapeig de veus segons la selecció de l'usuari
    if voice_id in ["echo", "alloy", "onyx", "fable"]:
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
        
    voice = voice_map.get(locale, "en-US-AriaNeural" if voice_id not in ["echo", "alloy", "onyx", "fable"] else "en-US-GuyNeural")
    communicate = edge_tts.Communicate(text, voice)
    
    fd, temp_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    
    await communicate.save(temp_path)
    return temp_path

async def generate_dubbed_audio(segments: list, temp_dir: str, locale: str, voice_id: str) -> str:
    """Generates a single synchronized audio track from multiple segments."""
    from pydub import AudioSegment
    
    print(f"[Video Translator] Generating {len(segments)} TTS segments for {locale}...")
    
    # Calculate total duration needed
    total_duration_ms = 0
    if segments:
        total_duration_ms = segments[-1]['end'] + 10000 # Add 10 seconds buffer
        
    final_audio = AudioSegment.silent(duration=total_duration_ms)
    
    current_pos_ms = 0
    
    for seg in segments:
        if not seg['text'].strip():
            continue
            
        tts_path = await generate_local_tts(seg['text'], locale, voice_id)
        try:
            seg_audio = AudioSegment.from_file(tts_path)
            
            # Sync algorithm: speed up if TTS is significantly longer than original slot
            target_duration = int(seg['end'] - seg['start'])
            actual_duration = len(seg_audio)
            
            if target_duration > 0 and actual_duration > target_duration * 1.1:
                speed_factor = actual_duration / target_duration
                # Cap speedup at 1.75x to preserve intelligibility (prevents chipmunk voices)
                if speed_factor > 1.75:
                    speed_factor = 1.75
                
                print(f"[Video Translator] Speeding up segment by {speed_factor:.2f}x to fit sync...")
                
                sped_up_path = tts_path.replace(".mp3", "_speed.mp3")
                ext_cmd = [
                    "ffmpeg", "-y", "-i", tts_path, 
                    "-filter:a", f"atempo={speed_factor}", 
                    "-vn", sped_up_path
                ]
                proc = await asyncio.create_subprocess_exec(*ext_cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
                await proc.wait()
                
                if proc.returncode == 0:
                    seg_audio = AudioSegment.from_file(sped_up_path)
                    os.remove(sped_up_path)
            
            # Place audio at start time, but ensure it doesn't overlap with previous segment
            start_pos = max(int(seg['start']), current_pos_ms)
            
            # If start_pos exceeds the pre-calculated silent canvas, we need to extend it
            if start_pos + len(seg_audio) > len(final_audio):
                extra_silence = AudioSegment.silent(duration=(start_pos + len(seg_audio) - len(final_audio) + 5000))
                final_audio = final_audio + extra_silence
                
            final_audio = final_audio.overlay(seg_audio, position=start_pos)
            
            # Update current position for next segment to prevent overlap (+100ms gap)
            current_pos_ms = start_pos + len(seg_audio) + 100
        except Exception as e:
            print(f"[Video Translator] Failed to overlay TTS segment: {e}")
        finally:
            if os.path.exists(tts_path):
                os.remove(tts_path)
                
    out_path = os.path.join(temp_dir, f"dubbed_{locale}.mp3")
    final_audio.export(out_path, format="mp3")
    return out_path

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
        import uuid
        video_hash = str(uuid.uuid4())[:8]
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
        segments = await transcribe_audio_openrouter(orig_audio_path)
        print(f"[Video Translator] Transcribed {len(segments)} segments.")

        # Process each locale
        locales = ['es', 'en', 'fr']
        results = {}
        
        for loc in locales:
            final_video_path = os.path.join(temp_dir, f"final_{loc}.mp4")
            tts_audio_path = None
            
            try:
                # 4. Translate
                if not segments:
                    print(f"[Video Translator] No text transcribed. Skipping translation for {loc}.")
                    continue
                else:
                    translated_segments = await translate_text_openrouter(segments, target_lang=loc)
                    print(f"[Video Translator] Translated {len(translated_segments)} segments to {loc}.")

                # 5. Generate Synchronized Dubbed Audio
                tts_audio_path = await generate_dubbed_audio(translated_segments, temp_dir, locale=loc, voice_id=voice_id)

                # 6. Merge with 0 delay (pydub already placed audio at correct absolute time)
                await merge_audio_video(orig_video_path, tts_audio_path, final_video_path, start_delay_ms=0)
                
                # 7. Upload to S3 (usa el bucket configurat a l'entorn d'Easypanel)
                bucket = os.getenv("S3_BUCKET", "pxx-core-v1")
                region = os.getenv("S3_REGION", "eu-north-1")
                key = f"media/pois/{poi_id}/video/{video_hash}_{loc}.mp4"
                
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
import os
import tempfile
import subprocess
import httpx
import uuid
from routers.audio import upload_to_s3
from routers.s3 import get_s3_client
from urllib.parse import urlparse

async def optimize_video_job(ctx, poi_id: str, public_url: str):
    print(f"[Worker] Iniciant optimització de vídeo per al POI {poi_id}: {public_url}")
    temp_dir = tempfile.mkdtemp(prefix=f"opt_{poi_id}_")
    
    try:
        # Download the original video
        parsed_url = urlparse(public_url)
        ext = os.path.splitext(parsed_url.path)[1]
        if not ext:
            ext = ".mp4"
            
        input_path = os.path.join(temp_dir, f"input{ext}")
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(public_url, timeout=300)
            resp.raise_for_status()
            with open(input_path, 'wb') as f:
                f.write(resp.content)
                
        output_path = os.path.join(temp_dir, "optimized.mp4")
        
        # Optimize using ffmpeg
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "28",
            "-c:a", "aac",
            "-movflags", "+faststart",
            "-threads", "2",
            output_path
        ]
        
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode != 0:
            print(f"[Worker] Error optimitzant vídeo: {proc.stderr.decode()}")
            raise Exception("FFmpeg optimization failed")
            
        # Upload the optimized video
        s3_client = get_s3_client()
        bucket = os.getenv("S3_BUCKET", "pxx-core-v1")
        region = os.getenv("S3_REGION", "eu-north-1")
        
        unique_id = str(uuid.uuid4())[:8]
        key = f"media/pois/{poi_id}/video/optimized_{unique_id}.mp4"
        
        # Fetch real TenantID
        tenant_id = "default"
        pool = ctx['db_pool']
        try:
            async with pool.acquire() as conn:
                muni = await conn.fetchrow('SELECT id FROM municipalities ORDER BY created_at ASC LIMIT 1')
                if muni:
                    tenant_id = str(muni['id'])
        except Exception as e:
            print(f"[Worker] Error fetching TenantID: {e}")

        import urllib.parse
        encoded_type = urllib.parse.quote_plus("video/mp4")
        
        print(f"[Worker] Pujant vídeo optimitzat a {key} amb TenantID {tenant_id}...")
        try:
            with open(output_path, 'rb') as f:
                s3_client.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=f,
                    ContentType="video/mp4",
                    Tagging=f"TenantID={tenant_id}&Type={encoded_type}"
                )
        except Exception as e:
            print(f"[Worker] PutObject amb Tagging ha fallat per {key}: {e}. Reintentant sense tags...")
            with open(output_path, 'rb') as f:
                s3_client.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=f,
                    ContentType="video/mp4"
                )
            
        optimized_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        
        # Update PostgreSQL
        pool = ctx['db_pool']
        async with pool.acquire() as conn:
            # Get current videoUrls
            row = await conn.fetchrow("SELECT video_urls FROM pois WHERE id = $1", poi_id)
            if row and row['video_urls']:
                urls = row['video_urls']
                new_urls = [optimized_url if u == public_url else u for u in urls]
                await conn.execute("UPDATE pois SET video_urls = $1 WHERE id = $2", new_urls, poi_id)
                print(f"[Worker] POI {poi_id} actualitzat amb URL optimitzada: {optimized_url}")
                
        return True
        
    except Exception as e:
        print(f"[Worker] Error en optimize_video_job: {e}")
        raise e
    finally:
        import shutil
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
