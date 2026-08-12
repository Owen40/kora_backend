const express = require('express');

const {
    getAllergens,
    getAllergenById,
    createAllergen,
    updateAllergen,
    deleteAllergen
} = require('../Controllers/allergenController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getAllergens);
router.get('/:id', getAllergenById);

router.post('/', protect, authorizeRoles('admin'), createAllergen);
router.put('/:id', protect, authorizeRoles('admin'), updateAllergen);
router.delete('/:id', protect, authorizeRoles('admin'), deleteAllergen);

module.exports = router;