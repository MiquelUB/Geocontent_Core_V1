'use server';


import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { prisma } from "../database/prisma";
import { videoQueue } from "../queue/client";
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { SECURITY_CONFIG } from '@/lib/config/constants';
import { getDefaultMunicipalityId } from './queries';

/**
 * Puja un fitxer a S3 via l'API Core (FastAPI)
 */
export async function uploadFile(file: File, folder: string = 'geocontent') {
  // SEC-08: Límit de mida
  if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
    throw new Error(`Fitxer massa gran. Màxim ${SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB.`);
  }

  const municipalityId = await getDefaultMunicipalityId();
  if (!municipalityId) {
    throw new Error("TenantID required for cost allocation");
  }

  const fastApiUrl = process.env.INTERNAL_API_URL || 'http://fastapi-core:8000';
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  
  try {
    const response = await fetch(`${fastApiUrl}/s3/upload`, {
      method: 'POST',
      headers: {
        'x-internal-tenant-id': municipalityId,
      },
      body: formData,
    });
    
    if (!response.ok) {
        console.error('FastAPI upload error:', await response.text());
        throw new Error("Error de l'API Core al pujar el fitxer");
    }
    
    const { key } = await response.json();
    
    // Construct and return the public URL
    const bucket = process.env.S3_BUCKET || "pxx-core-v1";
    const region = process.env.S3_REGION || "eu-north-1";
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    
    return publicUrl;
  } catch (err: any) {
    console.error('uploadFile error:', err);
    throw new Error("Error al pujar el fitxer a l'emmagatzematge d'objectes");
  }
}

/**
 * Actualitza l'avatar de l'usuari a la taula 'users'
 */
export async function updateProfileAvatar(userId: string, avatarUrl: string) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: avatarUrl }
    });

    revalidatePath('/profile');
    return { success: true, user: updatedUser };
  } catch (err) {
    console.error('Error updating avatar:', err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function handleAvatarUploadAction(formData: FormData, userId: string) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file found");

    const avatarUrl = await uploadFile(file, 'avatars');
    const result = await updateProfileAvatar(userId, avatarUrl);
    return result;
  } catch (err) {
    console.error('handleAvatarUploadAction error:', err);
    return { success: false, error: "Error al carregar l'avatar" };
  }
}

/**
 * Processament de vídeo HLS
 * Puja el raw a S3 i escriu un OutboxEvent per al worker Python (ARQ/FFmpeg).
 */
export async function addVideoToPoi(poiId: string, formData: FormData) {
  const videoFile = formData.get('video') as File;
  if (!videoFile) return { success: false, error: "No s'ha pujat cap vídeo." };

  // SEC-08: Límit de mida
  if (videoFile.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
    return { success: false, error: `Vídeo massa gran. Màxim ${SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB.` };
  }

  const validMimes = ['video/mp4', 'video/quicktime', 'video/webm'];
  if (!validMimes.includes(videoFile.type)) {
    return { success: false, error: "Format no suportat. Usa MP4, MOV o WebM." };
  }

  try {
    const poi = await prisma.poi.findUnique({
      where: { id: poiId }
    });

    if (!poi) return { success: false, error: "POI no trobat." };
    
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Per al processament HLS encara necessitem un fitxer temporal perquè FFmpeg el llegeixi,
    // però el resultat final l'haurem de pujar a S3 des del Worker.
    const tempDir = os.tmpdir();
    const fileName = `${uuidv4()}_${videoFile.name}`;
    const inputPath = path.join(tempDir, fileName);
    fs.writeFileSync(inputPath, buffer);

    const outputDir = `videos/${poiId}`; // Ruta relativa a S3

    await videoQueue.add('process-hls', {
      inputPath,
      outputDir, // El worker haurà de saber que ara ha de pujar a S3
      fileName: path.parse(fileName).name,
      poiId
    });

    return { success: true, message: "Vídeo enviat a processament HLS." };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}
