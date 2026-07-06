variable "aws_region" {
  description = "La regió d'AWS on es deplegarà l'S3"
  type        = string
  default     = "eu-north-1"
}

variable "bucket_name" {
  description = "El nom del bucket per als arxius de PXX"
  type        = string
  default     = "pxx-core-v1"
}


