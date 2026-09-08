const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const router = express.Router();

const {
    createModifierGroup,
    getModifierGroupsByDish,
    updateModifierGroup,
    deleteModifierGroup,
    createModifier,
    updateModifier,
    deleteModifier,
    getModifierGroupById
} = require('../Controllers/modifierController');

router.post( '/dishes/:dish_id/modifier-groups', createModifierGroup);
router.get('/dishes/:dish_id/modifier-groups',getModifierGroupsByDish);

router.get('/modifier-groups/:id',getModifierGroupById);
router.put('/modifier-groups/:id',updateModifierGroup);
router.delete('/modifier-groups/:id',deleteModifierGroup);

router.post('/modifier-groups/:modifier_group_id/modifiers',createModifier);
router.put('/modifiers/:id',updateModifier);
router.delete('/modifiers/:id',deleteModifier);

module.exports = router;