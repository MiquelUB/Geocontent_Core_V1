/**
 * PAS 1.5: S3 Direct Upload (Client-side)
 * Demana una URL signada a l'API i puja el fitxer directament a S3.
 */
export async function uploadFileClient(file: File, _bucket: string = 'geocontent') {
    // Normalize non-standard MIME types
    const MIME_NORMALIZATION: Record<string, string> = {
        'audio/x-m4a': 'audio/mp4',
        'audio/m4a': 'audio/mp4',
        'audio/x-aac': 'audio/aac',
        'video/x-m4v': 'video/mp4',
        'image/jpg': 'image/jpeg',
    };
    const contentType = MIME_NORMALIZATION[file.type] ?? file.type ?? 'application/octet-stream';

    // 1. Demanem la URL signada a la nostra API
    const response = await fetch(`/api/upload/signed-url?fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(contentType)}`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No s'ha pogut obtenir la URL de pujada");
    }

    const { signedUrl, publicUrl } = await response.json();

    // 2. Pugem el fitxer directament a S3 mitjançant un PUT
    const headers: Record<string, string> = {
        'Content-Type': contentType,
    };

    const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers,
    });

    if (!uploadResponse.ok) {
        throw new Error("Error en la pujada directa a S3");
    }

    return publicUrl;
}

