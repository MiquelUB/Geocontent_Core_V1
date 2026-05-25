/**
 * Compresses an image file to be under a certain size limit.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new (window as any).Image();
      img.src = event.target?.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if necessary
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Recursive compression to hit target size if possible
        const attemptCompression = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Compression failed'));
              
              // If still too big and we can lower quality, try again
              if (blob.size > 200 * 1024 && q > 0.1) {
                attemptCompression(q - 0.1);
              } else {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              }
            },
            'image/jpeg',
            q
          );
        };

        attemptCompression(quality);
      };
    };
    reader.onerror = (error) => reject(error);
  });
}
