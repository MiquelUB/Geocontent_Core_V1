# Usuari IAM per al Worker extern d'FFmpeg (Least Privilege)
resource "aws_iam_user" "pxx_worker_media" {
  name = "pxx-worker-media"
  tags = {
    Projecte = "PXX_Clean_Slate"
    Entorn   = "Produccio"
  }
}

# Política JSON específica per al Worker i Manteniment (pujar, llegir i purgar orfes)
resource "aws_iam_user_policy" "pxx_worker_media_policy" {
  name = "pxx-worker-media-s3-policy"
  user = aws_iam_user.pxx_worker_media.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectTagging",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${aws_s3_bucket.pxx_media.id}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${aws_s3_bucket.pxx_media.id}"
      }
    ]
  })
}

# Generació de les credencials d'accés (Access Key / Secret Key)
resource "aws_iam_access_key" "pxx_worker_media_key" {
  user = aws_iam_user.pxx_worker_media.name
}

# Outputs per obtenir les credencials per configurar el servidor extern
output "worker_access_key_id" {
  description = "Access Key ID per a pxx-worker-media (Configura-ho al servidor extern)"
  value       = aws_iam_access_key.pxx_worker_media_key.id
}

output "worker_secret_access_key" {
  description = "Secret Access Key per a pxx-worker-media (Configura-ho al servidor extern)"
  value       = aws_iam_access_key.pxx_worker_media_key.secret
  sensitive   = true
}
