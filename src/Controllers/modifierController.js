const path = require('path');
const { query } = require('../db');

exports.createModifierGroup = async (req, res) => {
    try {
        const { dish_id } = req.params;

        const {
            name,
            required = false,
            min_selections = 0,
            max_selections = 1
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Modifier group name is required.',
            });
        }

        if (min_selections < 0) {
            return res.status(400).json({
                success: false,
                message: 'Minimum selections cannot be negative.',
            });
        }

        if (max_selections < 1) {
            return res.status(400).json({
                success: false,
                message: 'Maximum selections must be at least 1.',
            });
        }

        if (max_selections < min_selections) {
            return res.status(400).json({
                success: false,
                message: 'Maximum selections cannot be less than minimum selections.',
            });
        }

        // Verify dish exists
        const dishResult = await query(
            `
            SELECT id
            FROM dishes
            WHERE id = $1
            `,
            [dish_id]
        );

        if (dishResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found.',
            });
        }

        const result = await query(
            `
            INSERT INTO modifier_groups (
                dish_id,
                name,
                required,
                min_selections,
                max_selections
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [
                dish_id,
                name,
                required,
                min_selections,
                max_selections
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Modifier group created successfully.',
            data: result.rows[0],
        });

    } catch (error) {
        console.error('Create Modifier Group Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create modifier group.',
        });
    }
};

exports.getModifierGroupsByDish = async (req, res) => {
    try {
        const { dish_id } = req.params;

        const dishResult = await query(
            `
            SELECT id
            FROM dishes
            WHERE id = $1
            `,
            [dish_id]
        );

        if (dishResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found.',
            });
        }

        const result = await query(
            `
            SELECT
                mg.id,
                mg.dish_id,
                mg.name,
                mg.required,
                mg.min_selections,
                mg.max_selections,
                mg.created_at,

                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'name', m.name,
                            'price_delta', m.price_delta,
                            'available', m.available,
                            'created_at', m.created_at,
                            'updated_at', m.updated_at
                        )
                        ORDER BY m.created_at ASC
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'
                ) AS modifiers

            FROM modifier_groups mg

            LEFT JOIN modifiers m
                ON m.modifier_group_id = mg.id

            WHERE mg.dish_id = $1

            GROUP BY
                mg.id,
                mg.dish_id,
                mg.name,
                mg.required,
                mg.min_selections,
                mg.max_selections,
                mg.created_at

            ORDER BY mg.created_at ASC
            `,
            [dish_id]
        );

        return res.status(200).json({
            success: true,
            data: result.rows,
        });

    } catch (error) {
        console.error('Get Modifier Groups Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch modifier groups.',
        });
    }
};

exports.updateModifierGroup = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            required,
            min_selections,
            max_selections
        } = req.body;

        const existingResult = await query(
            `
            SELECT *
            FROM modifier_groups
            WHERE id = $1
            `,
            [id]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Modifier group not found.',
            });
        }

        const existing = existingResult.rows[0];

        const finalMin =
            min_selections !== undefined
                ? min_selections
                : existing.min_selections;

        const finalMax =
            max_selections !== undefined
                ? max_selections
                : existing.max_selections;

        if (finalMin < 0) {
            return res.status(400).json({
                success: false,
                message: 'Minimum selections cannot be negative.',
            });
        }

        if (finalMax < 1) {
            return res.status(400).json({
                success: false,
                message: 'Maximum selections must be at least 1.',
            });
        }

        if (finalMax < finalMin) {
            return res.status(400).json({
                success: false,
                message: 'Maximum selections cannot be less than minimum selections.',
            });
        }

        const result = await query(
            `
            UPDATE modifier_groups
            SET
                name = COALESCE($1, name),
                required = COALESCE($2, required),
                min_selections = COALESCE($3, min_selections),
                max_selections = COALESCE($4, max_selections)
            WHERE id = $5
            RETURNING *
            `,
            [
                name || null,
                required === undefined ? null : required,
                min_selections === undefined ? null : min_selections,
                max_selections === undefined ? null : max_selections,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: 'Modifier group updated successfully.',
            data: result.rows[0],
        });

    } catch (error) {
        console.error('Update Modifier Group Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update modifier group.',
        });
    }
};

exports.deleteModifierGroup = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `
            DELETE FROM modifier_groups
            WHERE id = $1
            RETURNING id, name
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Modifier group not found.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Modifier group deleted successfully.',
            data: result.rows[0],
        });

    } catch (error) {
        console.error('Delete Modifier Group Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete modifier group.',
        });
    }
};

exports.createModifier = async (req, res) => {
    try {
        const { modifier_group_id } = req.params;

        const {
            name,
            price_delta = 0,
            available = true
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Modifier name is required.',
            });
        }

        if (price_delta < 0) {
            return res.status(400).json({
                success: false,
                message: 'Modifier price cannot be negative.',
            });
        }

        // Verify modifier group exists
        const groupResult = await query(
            `
            SELECT id, dish_id
            FROM modifier_groups
            WHERE id = $1
            `,
            [modifier_group_id]
        );

        if (groupResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Modifier group not found.',
            });
        }

        const result = await query(
            `
            INSERT INTO modifiers (
                modifier_group_id,
                name,
                price_delta,
                available
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [
                modifier_group_id,
                name,
                price_delta,
                available
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Modifier created successfully.',
            data: result.rows[0],
        });

    } catch (error) {
        console.error('Create Modifier Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create modifier.',
        });
    }
};

exports.updateModifier = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            price_delta,
            available
        } = req.body;

        const existingResult = await query(
            `
            SELECT *
            FROM modifiers
            WHERE id = $1
            `,
            [id]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Modifier not found.',
            });
        }

        if (
            price_delta !== undefined &&
            price_delta < 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Modifier price cannot be negative.',
            });
        }

        const result = await query(
            `
            UPDATE modifiers
            SET
                name = COALESCE($1, name),
                price_delta = COALESCE($2, price_delta),
                available = COALESCE($3, available),
                updated_at = NOW()
            WHERE id = $4
            RETURNING *
            `,
            [
                name || null,
                price_delta === undefined
                    ? null
                    : price_delta,
                available === undefined
                    ? null
                    : available,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: 'Modifier updated successfully.',
            data: result.rows[0],
        });

    } catch (error) {
        console.error('Update Modifier Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update modifier.',
        });
    }
};

exports.deleteModifier = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `
            DELETE FROM modifiers
            WHERE id = $1
            RETURNING id, name
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Modifier not found.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Modifier deleted successfully.',
            data: result.rows[0],
        });

    } catch (error) {
        console.error('Delete Modifier Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete modifier.',
        });
    }
};

exports.getModifierGroupById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `
            SELECT
                mg.id,
                mg.dish_id,
                mg.name,
                mg.required,
                mg.min_selections,
                mg.max_selections,
                mg.created_at,

                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'name', m.name,
                            'price_delta', m.price_delta,
                            'available', m.available,
                            'created_at', m.created_at,
                            'updated_at', m.updated_at
                        )
                        ORDER BY m.created_at ASC
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'
                ) AS modifiers

            FROM modifier_groups mg

            LEFT JOIN modifiers m
                ON m.modifier_group_id = mg.id

            WHERE mg.id = $1

            GROUP BY
                mg.id,
                mg.dish_id,
                mg.name,
                mg.required,
                mg.min_selections,
                mg.max_selections,
                mg.created_at
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Modifier group not found.',
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0],
        });

    } catch (error) {
        console.error('Get Modifier Group Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch modifier group.',
        });
    }
};