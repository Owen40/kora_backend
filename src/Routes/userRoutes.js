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

 const authMiddleware = require('../Middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, getAllUsers);
router.put('/:id/role', authMiddleware, updateUserRole);

router.get('/me/allergens', getMyAllergens);
router.post('/me/allergens', addMyAllergen);
router.put('/me/allergens', replaceMyAllergens);
router.delete('/me/allergens/:allergenId', removeMyAllergen);

module.exports = router;