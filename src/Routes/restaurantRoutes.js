const express = require('express');
const router = express.Router();

const {
    createRestaurant,
    getRestaurants,
    getRestaurantById,
    updateRestaurant,
    deleteRestaurant,
} = require('../Controllers/restaurantController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/',protect, getRestaurants);
router.get('/:id',protect, getRestaurantById);

router.post('/', protect, authorizeRoles('admin'), upload.single('image'), createRestaurant);

router.put('/:id', protect, authorizeRoles('admin'), upload.single('image'), updateRestaurant);
router.delete('/:id', protect, authorizeRoles('admin'), deleteRestaurant);

module.exports = router;