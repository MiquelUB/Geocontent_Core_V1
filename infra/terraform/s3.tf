provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "pxx_media" {
  bucket = var.bucket_name

  tags = {
    Projecte = "PXX_Clean_Slate"
    Entorn   = "Produccio"
    Gestionat = "Codi"
  }
}

# Bloqueig ABSOLUT d'accés públic per complir "Privacitat Absoluta"
resource "aws_s3_bucket_public_access_block" "pxx_media_block" {
  bucket = aws_s3_bucket.pxx_media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Configuració de CORS restringida al domini real
resource "aws_s3_bucket_cors_configuration" "pxx_media_cors" {
  bucket = aws_s3_bucket.pxx_media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    allowed_origins = [
      "https://pxxv-pxx-frontend.80opze.easypanel.host",
      "https://demo.projectexinoxano.cat",
      "https://app.teudomini.com"   # Afegir el domini definitiu quan estigui disponible
    ]
    expose_headers  = ["ETag", "x-amz-checksum-crc32", "x-amz-server-side-encryption"]
    max_age_seconds = 3000
  }
}

# Bucket Policy que força el tagging i permet lectura NOMÉS des de CloudFront (OAC)
resource "aws_s3_bucket_policy" "pxx_media_policy" {
  bucket = aws_s3_bucket.pxx_media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOACRead"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.pxx_media.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn": aws_cloudfront_distribution.pxx_media_distribution.arn
          }
        }
      },
      {
        Sid       = "DenyPutWithoutTenantIDTag"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.pxx_media.arn}/*"
        Condition = {
          Null = {
            "s3:RequestObjectTag/TenantID": "true"
          }
        }
      }
    ]
  })
}
