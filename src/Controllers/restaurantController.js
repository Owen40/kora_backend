const { query } = require('../db');
const { uploadToSpaces, deleteFromSpaces } = require('../config/spaces');

const getSPacesKeyFromUrl = (imageUrl) => {
    if (!imageUrl) return null;

    const publicUrl = process.env.DO_SPACES_PUBLIC_URL;

    if (!publicUrl || !imageUrl.startsWith(publicUrl)) {
        return null;
    }

    return imageUrl.replace(`${publicUrl}/`, '');
};;
exports.createRestaurant = async (req, res) => {
    try {
        const { name, opening_time, closing_time, phone, cuisine, delivery_fee, dish_count, estimated_time } = req.body;

        if (!name || !opening_time || !closing_time) {
            return res.status(400).json({
                success: false,
                message: 'Name, opening time and closing time are required.',
            });
        }

        const restaurantResult = await query(
            `
            INSERT INTO restaurants (
                name,
                opening_time,
                closing_time,
                phone,
                cuisine,
                delivery_fee,
                dish_count,
                estimated_time,
                created_by,
                updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
            RETURNING *
            `,
            [
                name,
                opening_time,
                closing_time,
                phone || null,
                cuisine || null,
                delivery_fee || 0,
                dish_count || 0,
                estimated_time || null,
                req.user.id,
            ]
        );

        const restaurant = restaurantResult.rows[0];

        let imageUrl = null;

        if (req.file) {
            const key = `restaurants/${restaurant.id}`;

            imageUrl = await uploadToSpaces({
                file: req.file,
                key,
            });

            const updatedRestaurantResult = await query(
                `
                UPDATE restaurants
                SET image_url = $1,
                    updated_at = NOW(),
                    updated_by = $2
                WHERE id = $3
                RETURNING *
                `,
                [imageUrl, req.user.id, restaurant.id]
            );

            return res.status(201).json({
                success: true,
                message: 'Restaurant created successfully.',
                data: updatedRestaurantResult.rows[0],
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Restaurant created successfully.',
            data: restaurant,
        })

    } catch (error) {
        console.error('Create Restaurant Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create restaurant.'
        });
    }
};

exports.getRestaurants = async (req, res) => {
    try {
        const result = await query(
            `
            SELECT 
                id,
                name,
                opening_time,
                closing_time,
                phone,
                image_url,
                cuisine,
                delivery_fee,
                dish_count,
                estimated_time,
                updated_at,
                updated_by,
                created_at,
                created_by
            FROM restaurants
            ORDER BY created_at DESC
            `
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        console.error('Get Restaurants Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch restaurants.',
        });
    }
};

exports.getRestaurantById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `
            SELECT 
                id,
                name,
                opening_time,
                closing_time,
                phone,
                image_url,
                cuisine,
                delivery_fee,
                dish_count,
                estimated_time,
                updated_at,
                updated_by,
                created_at,
                created_by
            FROM restaurants
            WHERE id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found.',
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Get Restaurant By ID Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch restaurant.',
        });
    }
};

exports.updateRestaurant = async (req, res) => {
    try {
        const { id } = req.params;

        const existingRestaurantResult = await query(
            `
      SELECT *
      FROM restaurants
      WHERE id = $1
      `,
            [id]
        );

        if (existingRestaurantResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found.',
            });
        }

        const existingRestaurant = existingRestaurantResult.rows[0];

        const {
            name,
            opening_time,
            closing_time,
            phone,
            cuisine,
            delivery_fee,
            dish_count,
            estimated_time,
        } = req.body;

        let imageUrl = existingRestaurant.image_url;

        if (req.file) {
            const key = `restaurants/${id}`;

            imageUrl = await uploadToSpaces({
                file: req.file,
                key,
            });
        }

        const result = await query(
            `
            UPDATE restaurants
            SET
                name = COALESCE($1, name),
                opening_time = COALESCE($2, opening_time),
                closing_time = COALESCE($3, closing_time),
                phone = COALESCE($4, phone),
                image_url = COALESCE($5, image_url),
                cuisine = COALESCE($6, cuisine),
                delivery_fee = COALESCE($7, delivery_fee),
                dish_count = COALESCE($8, dish_count),
                estimated_time = COALESCE($9, estimated_time),
                updated_at = NOW(),
                updated_by = $10
            WHERE id = $11
            RETURNING *
            `,
            [
                name || null,
                opening_time || null,
                closing_time || null,
                phone || null,
                imageUrl || null,
                cuisine || null,
                delivery_fee || null,
                dish_count || null,
                estimated_time || null,
                req.user.id,
                id,
            ]
        );

        return res.status(200).json({
            success: true,
            message: 'Restaurant updated successfully.',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Update Restaurant Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update restaurant.',
        });
    }
};

exports.deleteRestaurant = async (req, res) => {
    try {
        const { id } = req.params;

        const existingRestaurantResult = await query(
            `
            SELECT *
            FROM restaurants
            WHERE id = $1
            `,
            [id]
        );

        if (existingRestaurantResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found.',
            });
        }

        const restaurant = existingRestaurantResult.rows[0];

        if (restaurant.image_url) {
            const imageKey = getSpacesKeyFromUrl(restaurant.image_url);

            if (imageKey) {
                await deleteFromSpaces({ key: imageKey });
            }
        }

        await query(
            `
            DELETE FROM restaurants
            WHERE id = $1
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: 'Restaurant deleted successfully.',
        });
    } catch (error) {
        console.error('Delete Restaurant Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete restaurant.',
        });
    }
};