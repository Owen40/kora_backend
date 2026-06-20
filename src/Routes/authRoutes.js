const exporess = require('express');
const multer = require('multer');

const { register, login, verifyOtp, requestPasswordReset, resetPassword, getMe } = require('../Controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = exporess.Router();
const upload = multer();

router.post('/register', upload.none(), register);
router.post('/login', upload.none(), login);

// router.post('/send-otp', upload.none(), sendOtp);
router.post('/verify-otp', upload.none(), verifyOtp);

router.post('/forgot-password', upload.none(), requestPasswordReset);
router.post('/reset-password', upload.none(), resetPassword);

router.get('/me', protect, getMe);

module.exports = router;