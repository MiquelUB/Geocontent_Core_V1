import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from "stream";

const s3Region = process.env.S3_REGION || 'eu-north-1';
const s3Endpoint = process.env.S3_ENDPOINT;

// Si l'endpoint és d'AWS (conté amazonaws.com), és millor no passar-lo explícitament 
// i deixar que the SDK calculi el regional endpoint correcte.
const clientConfig: any = {
  region: s3Region,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: false, // Recomanat per AWS S3
};

if (s3Endpoint && !s3Endpoint.includes('amazonaws.com')) {
  clientConfig.endpoint = s3Endpoint;
}

const s3Client = new S3Client(clientConfig);

const BUCKET = process.env.S3_BUCKET || "geocontent";

/**
 * Puja un fitxer complet (Buffer) a S3
 */
export async function uploadToS3(file: Buffer, key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  return await s3Client.send(command);
}

/**
 * PAS 1: Resoldre l'OOM mitjançant Streams
 * Puja un arxiu a S3 mitjançant un PassThrough stream per evitar carregar tot el fitxer a la memòria.
 */
export const uploadStreamToS3 = (key: string, contentType: string = "application/json") => {
  const passThrough = new PassThrough();
  const upload = new Upload({
    client: s3Client,
    params: { 
      Bucket: BUCKET, 
      Key: key, 
      Body: passThrough, 
      ContentType: contentType 
    },
  });
  
  // Gestionem el resultat de la pujada asíncronament
  const promise = upload.done().catch((err) => {
    console.error(`[S3 Stream Error] Fallada en pujar ${key}:`, err);
    throw err;
  });

  return { stream: passThrough, promise };
};

/**
 * Elimina un fitxer de S3
 */
export async function deleteFromS3(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return await s3Client.send(command);
}

/**
 * Genera una URL signada per a descàrrega (PUT upload)
 * Inclou el ContentType per obligar el client a respectar el format validat pel servidor.
 */
export async function getSignedUrl(key: string, expiresIn = 3600, contentType?: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType, // Crític: el client haurà d'enviar aquest header exactament
  });

  return await s3GetSignedUrl(s3Client, command, { expiresIn });
}
