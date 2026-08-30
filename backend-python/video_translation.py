import os
import tempfile
import subprocess
import httpx
import json
import edge_tts
from routers.audio import upload_to_s3

async def transcribe_audio_openrouter(audio_path: str) -> str:
    """Uses OpenRouter's /api/v1/audio/transcriptions endpoint (OpenAI Whisper compatible)."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not set.")

    url = "https://openrouter.ai/api/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }

    # OpenRouter handles openai/whisper-1
    data = {
        "model": "openai/whisper-1",
        "response_format": "text"
    }

    print(f"[Video Translator] Transcribing audio with OpenRouter...")
    async with httpx.AsyncClient() as client:
        with open(audio_path, 'rb') as f:
            files = {'file': (os.path.basename(audio_path), f, 'audio/mpeg')}
            response = await client.post(url, headers=headers, data=data, files=files, timeout=60.0)

        response.raise_for_status()
        try:
            result = response.json()
            return result.get("text", "")
        except:
            return response.text

async def translate_text_openrouter(text: str, target_lang: str = "en") -> str:
    """Translates text using OpenRouter Chat Completions."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("AI_MODEL_ID", "google/gemini-2.0-flash-001")
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

async def generate_local_tts(text: str, locale: str) -> str:
    print(f"[Video Translator] Generating TTS for locale {locale}...")
    voice_map = {
        "ca": "ca-ES-JoanaNeural",
        "es": "es-ES-ElviraNeural",
        "en": "en-US-AriaNeural",
        "fr": "fr-FR-DeniseNeural"
    }
    voice = voice_map.get(locale, "en-US-AriaNeural")
    communicate = edge_tts.Communicate(text, voice)
    
    fd, temp_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    
    await communicate.save(temp_path)
    return temp_path

def merge_audio_video(video_path: str, audio_path: str, output_path: str):
    """Replaces the audio track of the video with the new audio track using FFmpeg."""
    print(f"[Video Translator] Merging new audio with original video...")
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        output_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

async def translate_video_pipeline(video_url: str, poi_id: str, voice_id: str = "en") -> str:
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
        orig_audio_path = os.path.join(temp_dir, "orig.mp3")
        final_video_path = os.path.join(temp_dir, "final.mp4")
        
        # 1. Download Video
        print(f"[Video Translator] Downloading video {video_url}...")
        async with httpx.AsyncClient() as client:
            response = await client.get(video_url, follow_redirects=True)
            response.raise_for_status()
            with open(orig_video_path, 'wb') as f:
                f.write(response.content)

        # 2. Extract Audio
        print(f"[Video Translator] Extracting audio...")
        subprocess.run(["ffmpeg", "-y", "-i", orig_video_path, "-q:a", "0", "-map", "a", orig_audio_path], 
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 3. Transcribe
        transcribed_text = await transcribe_audio_openrouter(orig_audio_path)
        print(f"[Video Translator] Transcription: {transcribed_text[:50]}...")

        # 4. Translate
        if not transcribed_text.strip():
            print("[Video Translator] No text transcribed. Skipping translation.")
            translated_text = "No audio detected."
        else:
            translated_text = await translate_text_openrouter(transcribed_text, target_lang=voice_id)
            print(f"[Video Translator] Translation: {translated_text[:50]}...")

        # 5. Generate TTS
        tts_audio_path = await generate_local_tts(translated_text, voice_id)

        try:
            # 6. Merge
            merge_audio_video(orig_video_path, tts_audio_path, final_video_path)
            
            # 7. Upload to S3
            bucket = os.getenv("S3_BUCKET", "pxx-core-v1")
            region = os.getenv("S3_REGION", "eu-north-1")
            key = f"media/pois/{poi_id}/video/{voice_id}.mp4"
            
            print(f"[Video Translator] Uploading to S3...")
            url = upload_to_s3(final_video_path, bucket, key, region)
            return url
        finally:
            if os.path.exists(tts_audio_path):
                os.remove(tts_audio_path)

    finally:
        for f in os.listdir(temp_dir):
            os.remove(os.path.join(temp_dir, f))
        os.rmdir(temp_dir)
