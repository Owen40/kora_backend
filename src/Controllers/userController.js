const pool = require('../db');

const getAllUsers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                email,
                first_name,
                last_name,
                phone,
                role,
                created_at,
                CASE
                    WHEN role = 'admin' THEN last_login_at
                    ELSE NULL
                END AS last_login_at
            FROM users
            ORDER BY created_at DESC
        `);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            users: result.rows
        });

    } catch (error) {
        console.error('Error fetching users:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
};

const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const allowedRoles = [
            'user',
            'admin',
            'restaurant_owner',
            'delivery_rider'
        ];

        if (!role) {
            return res.status(400).json({
                success: false,
                message: 'Role is required'
            });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        const result = await pool.query(
            `
            UPDATE users
            SET
                role = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING
                id,
                email,
                first_name,
                last_name,
                phone,
                role,
                created_at,
                last_login_at
            `,
            [role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User role updated successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating user role:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update user role'
        });
    }
};


module.exports = {
    getAllUsers,
    updateUserRole
};