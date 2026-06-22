const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const spacesClient = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: process.env.DO_SPACES_REGION,
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});

const uploadToSpaces = async ({ file, key }) => {
    if (!file) return null;

    await spacesClient.send(
        new PutObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: key,
            Body: file.buffer,
            ACL: 'public-read',
            ContentType: file.mimetype,
        })
    );

    return `${process.env.DO_SPACES_PUBLIC_URL}/${key}`;
};

const deleteFromSpaces = async ({ key }) => {
    if (!key) return;

    await spacesClient.send(
        new DeleteObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: key,
        })
    );
};

module.exports = {
    uploadToSpaces,
    deleteFromSpaces
}