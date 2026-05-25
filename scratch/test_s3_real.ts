import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";
dotenv.config();

async function testS3() {
  console.log("--- TEST S3 CONNECTION ---");
  console.log("Region:", process.env.S3_REGION);
  console.log("Bucket:", process.env.S3_BUCKET);
  console.log("Endpoint:", process.env.S3_ENDPOINT);

  const client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: false,
  });

  try {
    const data = await client.send(new ListBucketsCommand({}));
    console.log("SUCCESS! Buckets found:", data.Buckets?.map(b => b.Name));
  } catch (err: any) {
    console.error("FAILED! Error details:");
    console.error("Code:", err.code);
    console.error("Message:", err.message);
    if (err.$metadata) console.error("Metadata:", err.$metadata);
  }
}

testS3();
