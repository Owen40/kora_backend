const path = require('path');
const { query } = require('../db');
const { uploadToR2, deleteFromR2 } = require('../config/spaces');

const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const getFileExtension = (filename) => {
    return path.extname(filename || '').toLowerCase() || '.jpg';
};

const getSpacesKeyFromUrl = (url) => {
    if (!url) return null;

    const publicUrl = process.env.DO_SPACES_PUBLIC_URL;

    if (publicUrl && url.startsWith(publicUrl)) {
        return url.replace(`${publicUrl}/`, '');
    }

    return null;
};

const parseCustomization = (customization) => {
    if (!customization) return null;

    if (typeof customization === 'object') {
        return customization;
    }

    try {
        return JSON.parse(customization);
    } catch (error) {
        throw new Error('Customization must be valid JSON.');
    }
};

const getRestaurantById = async (restaurant_id) => {
    const result = await query(
        `
        SELECT id, name
        FROM restaurants
        WHERE id = $1
        `,
        [restaurant_id]
    );

    return result.rows[0];
};

const checkCategoryBelongsToRestaurant = async ({ category_id, restaurant_id }) => {
    if (!category_id) return true;

    const result = await query(
        `
        SELECT id
        FROM categories
        WHERE id = $1
          AND restaurant_id = $2
        `,
        [category_id, restaurant_id]
    );

    return result.rows.length > 0;
};

exports.createDish = async (req, res) => {
    try {
        const {
            restaurant_id,
            category_id,
            name,
            description,
            price,
            prep_time_minutes,
            customization,
            available
        } = req.body;

        if (!restaurant_id || !name || !price) {
            return res.status(400).json({
                success: false,
                message: 'Restaurant ID, dish name and price are required.',
            });
        }

        const restaurantResult = await query(
            `
            SELECT id, name
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

        const restaurant = restaurantResult.rows[0];

        if (category_id) {
            const categoryResult = await query(
                `
                SELECT id
                FROM categories
                WHERE id = $1
                  AND restaurant_id = $2
                `,
                [category_id, restaurant_id]
            );

            if (categoryResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected category does not belong to this restaurant.',
                });
            }
        }

        let parsedCustomization = null;

        if (customization) {
            try {
                parsedCustomization =
                    typeof customization === 'object'
                        ? customization
                        : JSON.parse(customization);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Customization must be valid JSON.',
                });
            }
        }

        const dishResult = await query(
            `
            INSERT INTO dishes (
                restaurant_id,
                category_id,
                name,
                description,
                price,
                prep_time_minutes,
                customization,
                available,
                created_by,
                updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $9)
            RETURNING *
            `,
            [
                restaurant_id,
                category_id || null,
                name,
                description || null,
                price,
                prep_time_minutes || null,
                parsedCustomization ? JSON.stringify(parsedCustomization) : null,
                available === undefined ? true : available,
                req.user.id,
            ]
        );

        const dish = dishResult.rows[0];

        let imageUrl = null;

        if (req.file) {
            const restaurantFolder = restaurant.name
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            const fileExtension = req.file.originalname.split('.').pop();

            const key = `Dishes/${restaurantFolder}/${dish.id}.${fileExtension}`;

            imageUrl = await uploadToR2({
                file: req.file,
                key,
            });

            const updatedDishResult = await query(
                `
                UPDATE dishes
                SET image_url = $1,
                    updated_at = NOW(),
                    updated_by = $2
                WHERE id = $3
                RETURNING *
                `,
                [imageUrl, req.user.id, dish.id]
            );

            await query(
                `
                UPDATE restaurants
                SET dish_count = COALESCE(dish_count, 0) + 1,
                    updated_at = NOW()
                WHERE id = $1
                `,
                [restaurant_id]
            );

            return res.status(201).json({
                success: true,
                message: 'Dish created successfully.',
                data: updatedDishResult.rows[0],
            });
        }

        await query(
            `
            UPDATE restaurants
            SET dish_count = COALESCE(dish_count, 0) + 1,
                updated_at = NOW()
            WHERE id = $1
            `,
            [restaurant_id]
        );

        return res.status(201).json({
            success: true,
            message: 'Dish created successfully.',
            data: dish,
        });

    } catch (error) {
        console.error('Create Dish Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create dish.',
        });
    }
};

exports.getDishes = async (req, res) => {
    try {
        const { restaurant_id, category_id, available, search } = req.query;

        const conditions = [];
        const values = [];

        if (restaurant_id) {
            values.push(restaurant_id);
            conditions.push(`d.restaurant_id = $${values.length}`);
        }

        if (category_id) {
            values.push(category_id);
            conditions.push(`d.category_id = $${values.length}`);
        }

        if (available !== undefined) {
            values.push(available === 'true');
            conditions.push(`d.available = $${values.length}`);
        }

        if (search) {
            values.push(`%${search}%`);
            conditions.push(`d.name ILIKE $${values.length}`);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const result = await query(
            `
            SELECT
                d.*,
                r.name AS restaurant_name,
                c.name AS category_name
            FROM dishes d
            JOIN restaurants r ON r.id = d.restaurant_id
            LEFT JOIN categories c ON c.id = d.category_id
            ${whereClause}
            ORDER BY d.created_at DESC
            `,
            values
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        console.error('Get Dishes Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dishes.',
        });
    }
};

exports.getDishById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `
            SELECT
                d.*,
                r.name AS restaurant_name,
                c.name AS category_name
            FROM dishes d
            JOIN restaurants r ON r.id = d.restaurant_id
            LEFT JOIN categories c ON c.id = d.category_id
            WHERE d.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found.',
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Get Dish By ID Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dish.',
        });
    }
};

exports.updateDish = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            category_id,
            name,
            description,
            price,
            prep_time_minutes,
            customization,
            available
        } = req.body;

        const existingResult = await query(
            `
            SELECT d.*, r.name AS restaurant_name
            FROM dishes d
            JOIN restaurants r ON r.id = d.restaurant_id
            WHERE d.id = $1
            `,
            [id]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found.',
            });
        }

        const existingDish = existingResult.rows[0];

        if (category_id) {
            const categoryIsValid = await checkCategoryBelongsToRestaurant({
                category_id,
                restaurant_id: existingDish.restaurant_id,
            });

            if (!categoryIsValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected category does not belong to this restaurant.',
                });
            }
        }

        let imageUrl = existingDish.image_url;

        if (req.file) {
            const oldKey = getSpacesKeyFromUrl(existingDish.image_url);

            if (oldKey) {
                await deleteFromR2({ key: oldKey });
            }

            const restaurantFolder = slugify(existingDish.restaurant_name);
            const ext = getFileExtension(req.file.originalname);

            const newKey = `restaurants/${restaurantFolder}/dishes/${id}${ext}`;

            imageUrl = await uploadToR2({
                file: req.file,
                key: newKey,
            });
        }

        let parsedCustomization = existingDish.customization;

        if (customization !== undefined) {
            parsedCustomization = parseCustomization(customization);
        }

        const result = await query(
            `
            UPDATE dishes
            SET
                category_id = COALESCE($1, category_id),
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                image_url = COALESCE($4, image_url),
                price = COALESCE($5, price),
                prep_time_minutes = COALESCE($6, prep_time_minutes),
                customization = COALESCE($7::jsonb, customization),
                available = COALESCE($8, available),
                updated_by = $9,
                updated_at = NOW()
            WHERE id = $10
            RETURNING *
            `,
            [
                category_id || null,
                name || null,
                description || null,
                imageUrl || null,
                price || null,
                prep_time_minutes || null,
                parsedCustomization ? JSON.stringify(parsedCustomization) : null,
                available === undefined ? null : available,
                req.user.id,
                id,
            ]
        );

        return res.status(200).json({
            success: true,
            message: 'Dish updated successfully.',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Update Dish Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update dish.',
        });
    }
};

exports.deleteDish = async (req, res) => {
    try {
        const { id } = req.params;

        const existingResult = await query(
            `
            SELECT *
            FROM dishes
            WHERE id = $1
            `,
            [id]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found.',
            });
        }

        const dish = existingResult.rows[0];

        const imageKey = getSpacesKeyFromUrl(dish.image_url);

        if (imageKey) {
            await deleteFromR2({ key: imageKey });
        }

        await query(
            `
            DELETE FROM dishes
            WHERE id = $1
            `,
            [id]
        );

        await query(
            `
            UPDATE restaurants
            SET dish_count = GREATEST(COALESCE(dish_count, 0) - 1, 0),
                updated_at = NOW()
            WHERE id = $1
            `,
            [dish.restaurant_id]
        );

        return res.status(200).json({
            success: true,
            message: 'Dish deleted successfully.',
        });
    } catch (error) {
        console.error('Delete Dish Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete dish.',
        });
    }
};