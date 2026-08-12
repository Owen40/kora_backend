require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const {
    sendWelcomeEmail,
    sendOtpEmail,
    sendResetPasswordEmail
} = require('../services/emailService');

const generateToken = (userId, role) => {
    return jwt.sign(
        {
            id: userId,
            role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        }
    );
};

const sanitizeUser = (user) => {
    const { password, ...safeUser } = user;
    return safeUser;
}

exports.register = async (req, res) => {
    try {
        const {
            email,
            first_name,
            last_name,
            phone,
            password,
            role,
            allergen_ids,
        } = req.body;

        if (!email || !first_name || !last_name || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email, first name, last name and password are required.',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.',
            });
        }

        const existingUser = await query(
            `
      SELECT id FROM users
      WHERE email = $1
      `,
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email is already registered.',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userResult = await query(
            `
      INSERT INTO users (
        email,
        first_name,
        last_name,
        phone,
        password,
        role
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, first_name, last_name, phone, role, created_at, updated_at
      `,
            [
                email.toLowerCase(),
                first_name,
                last_name,
                phone || null,
                hashedPassword,
                role || 'user',
            ]
        );

        const user = userResult.rows[0];

        if (Array.isArray(allergen_ids) && allergen_ids.length > 0) {
            for (const allergenId of allergen_ids) {
                await query(
                    `
          INSERT INTO user_allergens (user_id, allergen_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, allergen_id) DO NOTHING
          `,
                    [user.id, allergenId]
                );
            }
        }

        await sendWelcomeEmail({
            email: user.email,
            firstName: user.first_name,
        });

        const token = generateToken(user.id, user.role);

        return res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            token,
            user,
        });
    } catch (error) {
        console.error('❌ Register error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to create account.',
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.',
            });
        }

        const result = await query(
            `
      SELECT *
      FROM users
      WHERE email = $1
      `,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
            });
        }

        const user = result.rows[0];

        if (user.role === 'user') {
            return res.status(403).json({
                success: false,
                message: "oops! You're trying to sneak into the pantry. Admins only, please!"
            })
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
            });
        }

        const otp = crypto.randomInt(100000, 999999).toString();

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const clientIp = getCleanIp(req);
        const userAgent = req.headers['user-agent'];
    
        const geo = geoip.lookup(clientIp);
        const location = geo ? `${geo.city}, ${geo.country}` : 'Unknown Location';

        const parser = new UAParser(userAgent);
        const browser = parser.getBrowser().name || 'Unknown Browser';
        const os = parser.getOS().name || 'Unknown OS';
        const readableDeviceInfo = `${browser} on ${os}`;

        await query(`
            INSERT INTO otp (user_id, otp_code, ip_address, device_info, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            `, [user.id, otp, req.ip, req.headers['user-agent'], expiresAt]);

        // Send OTP email
        await sendOtpEmail({
            email: user.email,
            firstName: user.first_name || 'User',
            otp,
            ipAddress: clientIp,
            location,
            deviceINfo: readableDeviceInfo
        });

        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully. Please Verify otp to complete login',
            requiresOtp: true,
            email: user.email
        });
    } catch (error) {
        console.error('❌ Login error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to login.',
        });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp_code } = req.body;

        if (!email || !otp_code) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP code are required.',
            });
        }

        const userResult = await query(
            `
      SELECT id, email, first_name, last_name, role
      FROM users
      WHERE email = $1
      `,
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            });
        }

        const user = userResult.rows[0];

        const otpResult = await query(
            `
      SELECT id, otp_code, expires_at, verified
      FROM otp
      WHERE user_id = $1
        AND otp_code = $2
        AND verified = FALSE
      ORDER BY created_at DESC
      LIMIT 1
      `,
            [user.id, otp_code]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP.',
            });
        }

        const otpRecord = otpResult.rows[0];

        if (new Date(otpRecord.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired.',
            });
        }

        await query(
            `
      UPDATE otp
      SET verified = TRUE
      WHERE id = $1
      `,
            [otpRecord.id]
        );

        await query(
            `
            UPDATE users
            SET last_login_at = NOW()
            WHERE id = $1
            `,
            [user.id]
        );

        const token = generateToken(user.id, user.role);

        return res.status(200).json({
            success: true,
            message: 'Login verified successfully.',
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('❌ Verify OTP error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP.',
        });
    }
};

exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required.',
            });
        }

        const userResult = await query(
            `
      SELECT id, email, first_name
      FROM users
      WHERE email = $1
      `,
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            });
        }

        const user = userResult.rows[0];

        const rawToken = crypto.randomBytes(32).toString('hex');

        const hashedToken = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await query(
            `
      INSERT INTO password_reset_tokens (
        user_id,
        token,
        expires_at
      )
      VALUES ($1, $2, $3)
      `,
            [user.id, hashedToken, expiresAt]
        );

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

        await sendResetPasswordEmail({
            email: user.email,
            firstName: user.first_name,
            resetLink,
        });

        return res.status(200).json({
            success: true,
            message: 'Password reset email sent successfully.',
        });
    } catch (error) {
        console.error('❌ Request reset error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to send password reset email.',
        });
    }
}

exports.resetPassword = async (req, res) => {
    try {
        const { token, new_password } = req.body;

        if (!token || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required.',
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.',
            });
        }

        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const tokenResult = await query(
            `
      SELECT id, user_id, expires_at, used
      FROM password_reset_tokens
      WHERE token = $1
        AND used = FALSE
      LIMIT 1
      `,
            [hashedToken]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or already used reset token.',
            });
        }

        const resetToken = tokenResult.rows[0];

        if (new Date(resetToken.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired.',
            });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        await query(
            `
      UPDATE users
      SET password = $1, updated_at = NOW()
      WHERE id = $2
      `,
            [hashedPassword, resetToken.user_id]
        );

        await query(
            `
      UPDATE password_reset_tokens
      SET used = TRUE
      WHERE id = $1
      `,
            [resetToken.id]
        );

        return res.status(200).json({
            success: true,
            message: 'Password reset successfully.',
        });
    } catch (error) {
        console.error('❌ Reset password error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to reset password.',
        });
    }
};

exports.getMe = async (req, res) => {
    return res.status(200).json({
        success: true,
        user: req.user,
    });
};