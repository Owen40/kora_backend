const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
} = require('../Controllers/categoryController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', protect, getCategories);
router.get('/:id', protect, getCategoryById);

router.post('/', protect, authorizeRoles('admin'), createCategory);
router.put('/:id', protect, authorizeRoles('admin'), updateCategory);
router.delete('/:id', protect, authorizeRoles('admin'), deleteCategory);

module.exports = router;