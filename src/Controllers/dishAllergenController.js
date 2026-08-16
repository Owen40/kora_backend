const { query } = require('../db');

const handleDatabaseError = (error, res) => {
    console.error('Dish allergen database error:', error);

    if (error.code === '22P02') {
        return res.status(400).json({
            success: false,
            message: 'One or more UUID values are invalid.',
        });
    }

    if (error.code === '23503') {
        return res.status(404).json({
            success: false,
            message: 'The dish or one of the allergens does not exist.',
        });
    }

    return res.status(500).json({
        success: false,
        message: 'An unexpected database error occurred.',
    });
};


const checkDishExists = async (dishId) => {
    const result = await query(
        `
        SELECT id
        from dishes
        WHERE id = $1
        `,
        [dishId]
    );

    return result.rows.length > 0;
}

exports.getDishAllergens = async (req, res) => {
    try {
        const { dishId } = req.params;

        const dishExists = await checkDishExists(dishId);

        if (!dishExists) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found.',
            });
        }

        const result = await query(
            `
            SELECT
                a.id AS allergen_id,
                a.name,
                a.description,
                a.created_at
            FROM dish_allergens da
            INNER JOIN allergens a
                ON a.id = da.allergen_id
            WHERE da.dish_id = $1
            ORDER BY a.name ASC
            `,
            [dishId]
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

exports.addDishAllergen = async (req, res) => {
    try {
        const { dishId } = req.params;
        const { allergen_id } = req.body;

        if (!allergen_id) {
            return res.status(400).json({
                success: false,
                message: 'Allergen ID is required.',
            });
        }

        const resourceResult = await query(
            `
            SELECT
                EXISTS(
                    SELECT 1
                    FROM dishes
                    WHERE id = $1
                ) AS dish_exists,
                EXISTS(
                    SELECT 1
                    FROM allergens
                    WHERE id = $2
                ) AS allergen_exists
            `,
            [dishId, allergen_id]
        );

        const { dish_exists, allergen_exists } = resourceResult.rows[0];

        if (!dish_exists) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found.',
            });
        }

        if (!allergen_exists) {
            return res.status(404).json({
                success: false,
                message: 'Allergen not found.',
            });
        }

        const result = await query(
            `
            WITH inserted AS (
                INSERT INTO dish_allergens (
                    dish_id,
                    allergen_id
                )
                VALUES ($1, $2)
                ON CONFLICT (dish_id, allergen_id) DO NOTHING
                RETURNING
                    dish_id,
                    allergen_id
            )
            SELECT
                inserted.dish_id,
                a.id AS allergen_id,
                a.name,
                a.description,
                a.created_at
            FROM inserted
            INNER JOIN allergens a
                ON a.id = inserted.allergen_id
            `,
            [dishId, allergen_id]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({
                success: false,
                message: 'This allergen is already assigned to the dish.',
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Allergen assigned to dish successfully.',
            allergen: result.rows[0],
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.replaceDishAllergens = async (req, res) => {
    try {
        const { dishId } = req.params;
        const { allergen_ids } = req.body;

        if (!Array.isArray(allergen_ids)) {
            return res.status(400).json({
                success: false,
                message: 'allergen_ids must be an array.',
            });
        }

        const uniqueAllergenIds = [...new Set(allergen_ids)];

        const dishExists = await checkDishExists(dishId);

        if (!dishExists) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found.',
            });
        }

        if (uniqueAllergenIds.length > 0) {
            const existingAllergens = await query(
                `
                SELECT id
                FROM allergens
                WHERE id = ANY($1::UUID[])
                `,
                [uniqueAllergenIds]
            );

            if (existingAllergens.rows.length !== uniqueAllergenIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more allergen IDs do not exist.',
                });
            }
        }

        const result = await query(
            `
            WITH deleted AS (
                DELETE FROM dish_allergens
                WHERE dish_id = $1
            ),
            inserted AS (
                INSERT INTO dish_allergens (
                    dish_id,
                    allergen_id
                )
                SELECT
                    $1,
                    ids.allergen_id
                FROM unnest($2::UUID[]) AS ids(allergen_id)
                RETURNING
                    dish_id,
                    allergen_id
            )
            SELECT
                inserted.dish_id,
                a.id AS allergen_id,
                a.name,
                a.description,
                a.created_at
            FROM inserted
            INNER JOIN allergens a
                ON a.id = inserted.allergen_id
            ORDER BY a.name ASC
            `,
            [dishId, uniqueAllergenIds]
        );

        return res.status(200).json({
            success: true,
            message: 'Dish allergens updated successfully.',
            count: result.rows.length,
            allergens: result.rows,
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.removeDishAllergen = async (req, res) => {
    try {
        const { dishId, allergenId } = req.params;

        const result = await query(
            `
            DELETE FROM dish_allergens
            WHERE dish_id = $1
              AND allergen_id = $2
            RETURNING
                dish_id,
                allergen_id
            `,
            [dishId, allergenId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'This allergen is not assigned to the dish.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Allergen removed from dish successfully.',
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.getAllergenDishes = async (req, res) => {
    try {
        // The id here will come from the /allergens/:id/dishes route
        const { id } = req.params;

        const result = await query(
            `
            SELECT
                d.id,
                d.name,
                r.name AS "restaurantName"
            FROM dish_allergens da
            INNER JOIN dishes d ON da.dish_id = d.id
            LEFT JOIN restaurants r ON d.restaurant_id = r.id
            WHERE da.allergen_id = $1
            ORDER BY d.name ASC
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            dishes: result.rows,
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};