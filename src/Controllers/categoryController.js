const { query } = require('../db');

exports.createCategory = async (req, res) => {
    try {
        const { restaurant_id, name } = req.body;

        if (!restaurant_id || !name) {
            return res.status(400).json({
                success: false,
                message: 'Restaurant ID and category name are required.'
            });
        }

        const restaurantResult = await query(
            `
            SELECT id
            FROM restaurants
            WHERE id = $1
            `,
            [restaurant_id]
        );

        if (restaurantResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found.',
            });
        }

        const existingCategory = await query(
            `
            SELECT id
            FROM categories
            WHERE restaurant_id = $1
                AND LOWER(name) = LOWER($2)
            `,
            [restaurant_id, name.trim()]
        );

        if (existingCategory.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This category already exists for this restaurant.',
            });
        }

        const result = await query(
            `
            INSERT INTO categories (
                restaurant_id,
                name
            )
            VALUES ($1, $2)
            RETURNING *
            `,
            [restaurant_id, name.trim()]
        );

        return res.status(201).json({
            success: true,
            message: 'Category created successfully.',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Create Category Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create category.',
        });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const { restaurant_id } = req.query;

        let result;

        if (restaurant_id) {
            result = await query(
                `
                SELECT 
                c.id,
                c.restaurant_id,
                c.name,
                c.created_at,
                r.name AS restaurant_name
                FROM categories c
                JOIN restaurants r ON c.restaurant_id = r.id
                WHERE c.restaurant_id = $1
                ORDER BY c.created_at DESC
                `,
                [restaurant_id]
            );
        } else {
            result = await query(
                `
                SELECT 
                c.id,
                c.restaurant_id,
                c.name,
                c.created_at,
                r.name AS restaurant_name
                FROM categories c
                JOIN restaurants r ON c.restaurant_id = r.id
                ORDER BY c.created_at DESC
                `
            );
        }

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        console.error('Get Categories Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch categories.',
        });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `
            SELECT 
                c.id,
                c.restaurant_id,
                c.name,
                c.created_at,
                r.name AS restaurant_name
            FROM categories c
            JOIN restaurants r ON c.restaurant_id = r.id
            WHERE c.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Category not found.',
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Get Category By ID Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch category.',
        });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, restaurant_id } = req.body;

        if (!name && !restaurant_id) {
            return res.status(400).json({
                success: false,
                message: 'Provide at least one field to update.',
            });
        }

        const existingCategoryResult = await query(
            `
            SELECT *
            FROM categories
            WHERE id = $1
            `,
            [id]
        );

        if (existingCategoryResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Category not found.',
            });
        }

        const existingCategory = existingCategoryResult.rows[0];

        const finalRestaurantId = restaurant_id || existingCategory.restaurant_id;
        const finalName = name ? name.trim() : existingCategory.name;

        if (restaurant_id) {
            const restaurantResult = await query(
                `
                SELECT id
                FROM restaurants
                WHERE id = $1
                `,
                [restaurant_id]
            );

            if (restaurantResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Restaurant not found.',
                });
            }
        }

        const duplicateResult = await query(
            `
            SELECT id
            FROM categories
            WHERE restaurant_id = $1
                AND LOWER(name) = LOWER($2)
                AND id != $3
            `,
            [finalRestaurantId, finalName, id]
        );

        if (duplicateResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Another category with this name already exists for this restaurant.',
            });
        }

        const result = await query(
            `
            UPDATE categories
            SET 
                restaurant_id = $1,
                name = $2
            WHERE id = $3
            RETURNING *
            `,
            [finalRestaurantId, finalName, id]
        );

        return res.status(200).json({
            success: true,
            message: 'Category updated successfully.',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Update Category Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update category.',
        });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const existingCategoryResult = await query(
            `
            SELECT id
            FROM categories
            WHERE id = $1
            `,
            [id]
        );

        if (existingCategoryResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Category not found.',
            });
        }

        await query(
            `
            DELETE FROM categories
            WHERE id = $1
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: 'Category deleted successfully.',
        });
    } catch (error) {
        console.error('Delete Category Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete category.',
        });
    }
};