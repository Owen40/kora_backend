const multer = require('multer');

const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

    if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('Only JPEG, PNG, and WEBP images are allowed'), false);
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

module.exports = upload;