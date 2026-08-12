const { query, pool } = require('../db');

exports.getAddresses = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await query(
            `
            SELECT
                id,
                nickname,
                street,
                city,
                longitude,
                latitude,
                delivery_instructions,
                is_default,
                created_at,
                updated_at
            FROM addresses
            WHERE user_id = $1
            ORDER BY is_default DESC, created_at ASC
            `,
            [userId]
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            addresses: result.rows
        });

    } catch (error) {
        console.error('❌ Get addresses error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch addresses.'
        });
    }
};

exports.getAddress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await query(
            `
            SELECT
                id,
                nickname,
                street,
                city,
                longitude,
                latitude,
                delivery_instructions,
                is_default,
                created_at,
                updated_at
            FROM addresses
            WHERE id = $1
            AND user_id = $2
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Address not found.'
            });
        }

        return res.status(200).json({
            success: true,
            address: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Get address error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch address.'
        });
    }
};

exports.createAddress = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.id;

        const {
            nickname,
            street,
            city,
            longitude,
            latitude,
            delivery_instructions
        } = req.body;

        if (!street || !city) {
            return res.status(400).json({
                success: false,
                message: 'Street and city are required.'
            });
        }

        await client.query('BEGIN');

        // Check whether this is the user's first address
        const countResult = await client.query(
            `
            SELECT COUNT(*)::int AS count
            FROM addresses
            WHERE user_id = $1
            `,
            [userId]
        );

        const addressCount = countResult.rows[0].count;

        const shouldBeDefault =
            addressCount === 0 ||
            nickname?.trim().toLowerCase() === 'house';

        if (shouldBeDefault) {
            await client.query(
                `
                UPDATE addresses
                SET
                    is_default = FALSE,
                    updated_at = NOW()
                WHERE user_id = $1
                AND is_default = TRUE
                `,
                [userId]
            );
        }

        const result = await client.query(
            `
            INSERT INTO addresses (
                user_id,
                nickname,
                street,
                city,
                longitude,
                latitude,
                delivery_instructions,
                is_default
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                id,
                nickname,
                street,
                city,
                longitude,
                latitude,
                delivery_instructions,
                is_default,
                created_at,
                updated_at
            `,
            [
                userId,
                nickname || null,
                street,
                city,
                longitude ?? null,
                latitude ?? null,
                delivery_instructions || null,
                shouldBeDefault
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Address added successfully.',
            address: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('❌ Create address error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to create address.'
        });

    } finally {
        client.release();
    }
};

exports.updateAddress = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.id;
        const { id } = req.params;

        const {
            nickname,
            street,
            city,
            longitude,
            latitude,
            delivery_instructions,
            is_default
        } = req.body;

        await client.query('BEGIN');

        // Check that the address belongs to this user
        const existingResult = await client.query(
            `
            SELECT *
            FROM addresses
            WHERE id = $1
            AND user_id = $2
            FOR UPDATE
            `,
            [id, userId]
        );

        if (existingResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Address not found.'
            });
        }

        const existingAddress = existingResult.rows[0];

        const newNickname =
            nickname !== undefined
                ? nickname
                : existingAddress.nickname;

        const shouldBeDefault =
            is_default === true ||
            newNickname?.trim().toLowerCase() === 'house';

        if (shouldBeDefault) {
            await client.query(
                `
                UPDATE addresses
                SET
                    is_default = FALSE,
                    updated_at = NOW()
                WHERE user_id = $1
                AND id != $2
                `,
                [userId, id]
            );
        }

        const result = await client.query(
            `
            UPDATE addresses
            SET
                nickname = COALESCE($1, nickname),
                street = COALESCE($2, street),
                city = COALESCE($3, city),
                longitude = COALESCE($4, longitude),
                latitude = COALESCE($5, latitude),
                delivery_instructions = COALESCE(
                    $6,
                    delivery_instructions
                ),
                is_default = CASE
                    WHEN $7 = TRUE THEN TRUE
                    ELSE is_default
                END,
                updated_at = NOW()
            WHERE id = $8
            AND user_id = $9
            RETURNING
                id,
                nickname,
                street,
                city,
                longitude,
                latitude,
                delivery_instructions,
                is_default,
                created_at,
                updated_at
            `,
            [
                nickname,
                street,
                city,
                longitude,
                latitude,
                delivery_instructions,
                shouldBeDefault,
                id,
                userId
            ]
        );

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Address updated successfully.',
            address: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('❌ Update address error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to update address.'
        });

    } finally {
        client.release();
    }
};

exports.setDefaultAddress = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.id;
        const { id } = req.params;

        await client.query('BEGIN');

        // Check address exists and belongs to user
        const addressResult = await client.query(
            `
            SELECT id
            FROM addresses
            WHERE id = $1
            AND user_id = $2
            FOR UPDATE
            `,
            [id, userId]
        );

        if (addressResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Address not found.'
            });
        }

        // Remove default from all user's addresses
        await client.query(
            `
            UPDATE addresses
            SET
                is_default = FALSE,
                updated_at = NOW()
            WHERE user_id = $1
            `,
            [userId]
        );

        // Make selected address default
        const result = await client.query(
            `
            UPDATE addresses
            SET
                is_default = TRUE,
                updated_at = NOW()
            WHERE id = $1
            AND user_id = $2
            RETURNING
                id,
                nickname,
                street,
                city,
                longitude,
                latitude,
                delivery_instructions,
                is_default,
                created_at,
                updated_at
            `,
            [id, userId]
        );

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Default address updated successfully.',
            address: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('❌ Set default address error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to set default address.'
        });

    } finally {
        client.release();
    }
};

exports.deleteAddress = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.id;
        const { id } = req.params;

        await client.query('BEGIN');

        const addressResult = await client.query(
            `
            SELECT *
            FROM addresses
            WHERE id = $1
            AND user_id = $2
            FOR UPDATE
            `,
            [id, userId]
        );

        if (addressResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Address not found.'
            });
        }

        const address = addressResult.rows[0];

        await client.query(
            `
            DELETE FROM addresses
            WHERE id = $1
            AND user_id = $2
            `,
            [id, userId]
        );

        if (address.is_default) {
            await client.query(
                `
                UPDATE addresses
                SET
                    is_default = TRUE,
                    updated_at = NOW()
                WHERE id = (
                    SELECT id
                    FROM addresses
                    WHERE user_id = $1
                    ORDER BY
                        CASE
                            WHEN LOWER(TRIM(nickname)) = 'home'
                            THEN 0
                            ELSE 1
                        END,
                        created_at ASC
                    LIMIT 1
                )
                `,
                [userId]
            );
        }

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Address deleted successfully.'
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('❌ Delete address error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete address.'
        });

    } finally {
        client.release();
    }
};