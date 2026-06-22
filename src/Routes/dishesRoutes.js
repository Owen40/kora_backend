const express = require('express');

const {
    createDish,
    getDishes,
    getDishById,
    updateDish,
    deleteDish
} = require('../Controllers/dishesController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/', protect, getDishes);
router.get('/:id', protect, getDishById);

router.post('/', protect, authorizeRoles('admin'), upload.single('image'), createDish);
router.put('/:id', protect, authorizeRoles('admin'), upload.single('image'), updateDish);
router.delete('/:id', protect, authorizeRoles('admin'), deleteDish);

module.exports = router;