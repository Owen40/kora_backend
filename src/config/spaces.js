const {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const requiredEnvVariables = [
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
];

for (const variable of requiredEnvVariables) {
    if (!process.env[variable]) {
        throw new Error(`Missing required environment variable: ${variable}`);
    }
}

const r2Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: "auto",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const encodeObjectKey = (key) => {
    return key
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
};

const uploadToR2 = async ({ file, key }) => {
    if (!file) {
        return null;
    }

    if (!key) {
        throw new Error("An R2 object key is required.");
    }

    if (!file.buffer) {
        throw new Error(
            "The uploaded file does not contain a buffer. Ensure Multer is using memoryStorage."
        );
    }

    const normalizedKey = key.replace(/^\/+/, "");

    await r2Client.send(
        new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: normalizedKey,
            Body: file.buffer,
            ContentType: file.mimetype || "application/octet-stream",
        })
    );

    const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/+$/, "");
    const encodedKey = encodeObjectKey(normalizedKey);

    return `${publicUrl}/${encodedKey}`;
};

const deleteFromR2 = async ({ key }) => {
    if (!key) {
        return;
    }
    const normalizedKey = key.replace(/^\/+/, "");
    await r2Client.send(
        new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: normalizedKey,
        })
    );
};

module.exports = {
    uploadToR2,
    deleteFromR2,
};