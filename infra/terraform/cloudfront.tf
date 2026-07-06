# Distribució CloudFront per a lectura via OAC (Origin Access Control)

resource "aws_cloudfront_origin_access_control" "pxx_media_oac" {
  name                              = "pxx_media_oac_${var.bucket_name}"
  description                       = "OAC Policy per accedir al bucket privat PXX Media"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "pxx_media_distribution" {
  origin {
    domain_name              = aws_s3_bucket.pxx_media.bucket_regional_domain_name
    origin_id                = aws_s3_bucket.pxx_media.id
    origin_access_control_id = aws_cloudfront_origin_access_control.pxx_media_oac.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN per al lliurament dels vídeos HLS i imatges (PXX)"
  default_root_object = ""

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = aws_s3_bucket.pxx_media.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Projecte = "PXX_Clean_Slate"
    Entorn   = "Produccio"
  }
}

# Outputs d'infraestructura
output "cloudfront_domain_name" {
  description = "Domini de la distribució CloudFront per a la CDN"
  value       = aws_cloudfront_distribution.pxx_media_distribution.domain_name
}

output "s3_bucket_name" {
  description = "Nom del bucket S3"
  value       = aws_s3_bucket.pxx_media.id
}
