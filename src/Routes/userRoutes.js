const express = require('express');

const {
    getMyAllergens,
    addMyAllergen,
    replaceMyAllergens,
    removeMyAllergen,
} = require('../Controllers/userAllergens')

const router = express.Router();

router.get('/me/allergens', getMyAllergens);
router.post('/me/allergens', addMyAllergen);
router.put('/me/allergens', replaceMyAllergens);
router.delete('/me/allergens/:allergenId', removeMyAllergen);

module.exports = router;