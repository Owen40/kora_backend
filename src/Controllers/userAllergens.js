const { query } = require('../db');

const handleDatabaseError = (error, res) => {
    console.error('User allergen database error:', error);

    if (error.code === '22P02') {
        return res.status(400).json({
            success: false,
            message: 'One or more allergen IDs are invalid.',
        });
    }

    if (error.code === '23503') {
        return res.status(404).json({
            success: false,
            message: 'One or more allergens do not exist.',
        });
    }

    return res.status(500).json({
        success: false,
        message: 'An unexpected database error occurred.',
    });
};

exports.getMyAllergens = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await query(
            `
            SELECT
                ua.id AS user_allergen_id,
                a.id AS allergen_id,
                a.name,
                a.description,
                a.created_at
            FROM user_allergens ua
            INNER JOIN allergens a
                ON a.id = ua.allergen_id
            WHERE ua.user_id = $1
            ORDER BY a.name ASC
            `,
            [userId]
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            allergens: result.rows,
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.addMyAllergen = async (req, res) => {
    try {
        const userId = req.user.id;
        const { allergen_id } = req.body;

        if (!allergen_id) {
            return res.status(400).json({
                success: false,
                message: 'Allergen ID is required.',
            });
        }

        const result = await query(
            `
            WITH inserted AS (
                INSERT INTO user_allergens (
                    user_id,
                    allergen_id
                )
                VALUES ($1, $2)
                ON CONFLICT (user_id, allergen_id) DO NOTHING
                RETURNING
                    id,
                    user_id,
                    allergen_id
            )
            SELECT
                inserted.id AS user_allergen_id,
                a.id AS allergen_id,
                a.name,
                a.description,
                a.created_at
            FROM inserted
            INNER JOIN allergens a
                ON a.id = inserted.allergen_id
            `,
            [userId, allergen_id]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({
                success: false,
                message: 'This allergen is already assigned to your account.',
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Allergen added to your account successfully.',
            allergen: result.rows[0],
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.replaceMyAllergens = async (req, res) => {
    try {
        const userId = req.user.id;
        const { allergen_ids } = req.body;

        if (!Array.isArray(allergen_ids)) {
            return res.status(400).json({
                success: false,
                message: 'allergen_ids must be an array.',
            });
        }

        const uniqueAllergenIds = [...new Set(allergen_ids)];

        const result = await query(
            `
            WITH deleted AS (
                DELETE FROM user_allergens
                WHERE user_id = $1
            ),
            inserted AS (
                INSERT INTO user_allergens (
                    user_id,
                    allergen_id
                )
                SELECT
                    $1,
                    ids.allergen_id
                FROM unnest($2::UUID[]) AS ids(allergen_id)
                RETURNING
                    id,
                    user_id,
                    allergen_id
            )
            SELECT
                inserted.id AS user_allergen_id,
                a.id AS allergen_id,
                a.name,
                a.description,
                a.created_at
            FROM inserted
            INNER JOIN allergens a
                ON a.id = inserted.allergen_id
            ORDER BY a.name ASC
            `,
            [userId, uniqueAllergenIds]
        );

        return res.status(200).json({
            success: true,
            message: 'Your allergen list was updated successfully.',
            count: result.rows.length,
            allergens: result.rows,
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.removeMyAllergen = async (req, res) => {
    try {
        const userId = req.user.id;
        const { allergenId } = req.params;

        const result = await query(
            `
            DELETE FROM user_allergens
            WHERE user_id = $1
              AND allergen_id = $2
            RETURNING
                id,
                user_id,
                allergen_id
            `,
            [userId, allergenId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'This allergen is not assigned to your account.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Allergen removed from your account successfully.',
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};