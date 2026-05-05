'use server'

import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { prisma } from "../database/prisma";
import { videoQueue } from "../queue/client";
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { uploadToS3 } from "../services/s3";
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';

/**
 * Puja un fitxer a S3/MinIO
 */
export async function uploadFile(file: File, folder: string = 'geocontent') {
  // Sanitize filename
  const safeName = file.name.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const fileName = `${folder}/${uuidv4()}_${safeName}`;
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Pugem directament a S3/MinIO
    const publicUrl = await uploadToS3(buffer, fileName, file.type);
    
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
 * Processament de vídeo HLS (Usa S3 per al resultat final si cal, 
 * però el worker BullMQ és qui realment ho farà. Aquí només posem en cua).
 */
export async function addVideoToPoi(poiId: string, formData: FormData) {
  const videoFile = formData.get('video') as File;
  if (!videoFile) return { success: false, error: "No s'ha pujat cap vídeo." };

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
