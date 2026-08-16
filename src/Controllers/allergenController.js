const { query } = require('../db');

const handleDatabaseError = (error, res) => {
    console.error('Allergen database error:', error);

    if (error.code === '22P02') {
        return res.status(400).json({
            success: false,
            message: 'Invalid UUID format.',
        });
    }

    if (error.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'An allergen with this name already exists.',
        });
    }

    return res.status(500).json({
        success: false,
        message: 'An unexpected database error occurred.',
    });
};

exports.getAllergens = async (req, res) => {
    try {
        const search = req.query.search?.trim() || null;

        const result = await query(
            `
            SELECT
                a.id,
                a.name,
                a.description,
                a.created_at,
                COUNT(da.dish_id)::INTEGER AS "dishCount"
            FROM allergens a
            LEFT JOIN dish_allergens da ON a.id = da.allergen_id
            WHERE (
                $1::TEXT IS NULL
                OR a.name ILIKE '%' || $1 || '%'
                OR a.description ILIKE '%' || $1 || '%'
            )
            GROUP BY a.id
            ORDER BY a.name ASC
            `,
            [search]
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

exports.getAllergenById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `
            SELECT
                id,
                name,
                description,
                created_at
            FROM allergens
            WHERE id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Allergen not found.',
            });
        }

        return res.status(200).json({
            success: true,
            allergen: result.rows[0],
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.createAllergen = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Allergen name is required.',
            });
        }

        const result = await query(
            `
            INSERT INTO allergens (
                name,
                description
            )
            VALUES ($1, $2)
            RETURNING
                id,
                name,
                description,
                created_at
            `,
            [
                name.trim(),
                description !== undefined && description !== null
                    ? description.trim()
                    : null,
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Allergen created successfully.',
            allergen: result.rows[0],
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.updateAllergen = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updates = [];
        const values = [];

        if (name !== undefined) {
            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Allergen name cannot be empty.',
                });
            }

            values.push(name.trim());
            updates.push(`name = $${values.length}`);
        }

        if (description !== undefined) {
            values.push(
                description === null || description === ''
                    ? null
                    : description.trim()
            );

            updates.push(`description = $${values.length}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide a name or description to update.',
            });
        }

        values.push(id);

        const result = await query(
            `
            UPDATE allergens
            SET ${updates.join(', ')}
            WHERE id = $${values.length}
            RETURNING
                id,
                name,
                description,
                created_at
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Allergen not found.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Allergen updated successfully.',
            allergen: result.rows[0],
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};

exports.deleteAllergen = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `
            DELETE FROM allergens
            WHERE id = $1
            RETURNING
                id,
                name,
                description,
                created_at
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Allergen not found.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Allergen deleted successfully.',
            allergen: result.rows[0],
        });
    } catch (error) {
        return handleDatabaseError(error, res);
    }
};