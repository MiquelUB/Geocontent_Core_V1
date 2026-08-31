import os
import uuid
import boto3
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from botocore.config import Config

router = APIRouter(prefix="/s3", tags=["S3 Storage"])

S3_REGION = os.getenv("S3_REGION", "eu-north-1")
S3_BUCKET = os.getenv("S3_BUCKET", "pxx-core-v1")
S3_ENDPOINT = os.getenv("S3_ENDPOINT")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")

def get_s3_client():
    client_kwargs = {
        "region_name": S3_REGION,
        "aws_access_key_id": S3_ACCESS_KEY,
        "aws_secret_access_key": S3_SECRET_KEY,
    }
    if S3_ENDPOINT and "amazonaws.com" not in S3_ENDPOINT:
        client_kwargs["endpoint_url"] = S3_ENDPOINT
        
    # Security/Resilience: Prevents FastAPI memory exhaustion if S3 is slow
    client_kwargs["config"] = Config(connect_timeout=2, read_timeout=3)
    
    return boto3.client("s3", **client_kwargs)

class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str

@router.post("/presigned-url")
def generate_presigned_url(
    req: PresignedUrlRequest,
    x_internal_tenant_id: str = Header(None)
):
    """
    Genera una URL pre-signada per a pujades directes des del client (VideoUploader).
    Força de manera estricta el Tagging del fitxer.
    """
    if not x_internal_tenant_id:
        raise HTTPException(status_code=403, detail="TenantID required for cost allocation")
    
    s3 = get_s3_client()
    tagging_string = f"TenantID={x_internal_tenant_id}&Type={req.content_type}"
    
    try:
        url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": req.filename,
                "ContentType": req.content_type,
                "Tagging": tagging_string
            },
            ExpiresIn=900
        )
        return {"signedUrl": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_direct(
    file: UploadFile = File(...),
    folder: str = Form("geocontent"),
    x_internal_tenant_id: str = Header(None)
):
    """
    Endpoint intern perquè Next.js proxifiqui les pujades directes d'imatges i àudios.
    """
    if not x_internal_tenant_id:
        raise HTTPException(status_code=403, detail="TenantID required for cost allocation")
        
    s3 = get_s3_client()
    # Pydantic/FastAPI files use file.content_type
    content_type = file.content_type or "application/octet-stream"
    tagging_string = f"TenantID={x_internal_tenant_id}&Type={content_type}"
    
    # Sanitize
    import re
    safe_name = re.sub(r'[^\x00-\x7F]', '', file.filename)
    safe_name = re.sub(r'\s+', '_', safe_name)
    safe_name = re.sub(r'[^a-zA-Z0-9._-]', '', safe_name)
    
    key = f"{folder}/{uuid.uuid4()}_{safe_name}"
    
    try:
        s3.upload_fileobj(
            file.file,
            S3_BUCKET,
            key,
            ExtraArgs={
                "ContentType": content_type,
                "Tagging": tagging_string
            }
        )
        return {"key": key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug-list")
def debug_list_s3(bucket: str = "pxx-core-v1", prefix: str = ""):
    client = get_s3_client()
    try:
        res = client.list_objects_v2(Bucket=bucket, Prefix=prefix)
        files = [item["Key"] for item in res.get("Contents", [])]
        return {"bucket": bucket, "count": len(files), "files": files}
    except Exception as e:
        return {"error": str(e)}
