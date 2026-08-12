const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
    getAddress,
    getAddresses,
    createAddress,
    updateAddress,
    setDefaultAddress,
    deleteAddress,
} = require('../Controllers/addressesController');

const { protect } = require('../middleware/authMiddleware');
const upload = multer();

router.get('/', protect, getAddresses);
router.get('/:id', protect, getAddress);
router.post('/', protect, upload.none(), createAddress);
router.patch('/:id', protect, updateAddress);
router.patch('/:id/default', protect, setDefaultAddress);
router.delete('/:id', protect, deleteAddress);

module.exports = router;