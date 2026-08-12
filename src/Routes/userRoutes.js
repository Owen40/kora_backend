const express = require('express');

const {
    getMyAllergens,
    addMyAllergen,
    replaceMyAllergens,
    removeMyAllergen,
} = require('../Controllers/userAllergens');

const {
    getAllUsers,
    updateUserRole
 } = require('../Controllers/userController');

 const { protect, authorizeRoles} = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, authorizeRoles('admin'), getAllUsers);
router.put('/:id/role', protect, authorizeRoles('admin'), updateUserRole);

router.get('/me/allergens', getMyAllergens);
router.post('/me/allergens', addMyAllergen);
router.put('/me/allergens', replaceMyAllergens);
router.delete('/me/allergens/:allergenId', removeMyAllergen);

module.exports = router;