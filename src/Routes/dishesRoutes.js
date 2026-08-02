const express = require('express');

const {
    createDish,
    getDishes,
    getDishById,
    updateDish,
    deleteDish
} = require('../Controllers/dishesController');

const {
    getDishAllergens,
    addDishAllergen,
    replaceDishAllergens,
    removeDishAllergen,
} = require('../Controllers/dishAllergenController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/', protect, getDishes);
router.get('/:id', protect, getDishById);
router.get('/:dishId/allergens', getDishAllergens);

router.post('/', protect, authorizeRoles('admin'), upload.single('image'), createDish);
router.put('/:id', protect, authorizeRoles('admin'), upload.single('image'), updateDish);
router.delete('/:id', protect, authorizeRoles('admin'), deleteDish);

router.post('/:dishId/allergens', protect, authorizeRoles('admin'), addDishAllergen);
router.put('/:dishId/allergens', protect, authorizeRoles('admin'), replaceDishAllergens);
router.delete('/:dishId/allergens/:allergenId', protect, authorizeRoles('admin'), removeDishAllergen);

module.exports = router;