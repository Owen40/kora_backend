const jwt = require('jsonwebtoken');
const { query } = require('../db');

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await query(
            `SELECT id, email, first_name, last_name, phone, role, created_at, updated_at FROM users WHERE id = $1`, [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists.'
            });
        }
        req.user = result.rows[0];
        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error.message);

        return res.status(401).json({
            success: false,
            message: 'Not authorized. Invalid or expired token.'
        });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have permission.',
            });
        }

        next();
    };
};

module.exports = {
    protect,
    authorizeRoles
};