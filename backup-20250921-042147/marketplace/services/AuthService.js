/**
 * Authentication Service
 * Handles user registration, login, JWT tokens, and API key management
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

class AuthService {
  constructor(databaseManager, config) {
    this.db = databaseManager;
    this.config = config;
    this.router = express.Router();

    this.setupRoutes();
  }

  /**
   * Setup authentication routes
   */
  setupRoutes() {
    // User registration
    this.router.post('/register', [
      body('username')
        .isLength({ min: 3, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscore, and dash'),
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Must be a valid email address'),
      body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number')
    ], this.register.bind(this));

    // User login
    this.router.post('/login', [
      body('email').isEmail().normalizeEmail(),
      body('password').notEmpty()
    ], this.login.bind(this));

    // Token refresh
    this.router.post('/refresh', this.authenticateToken.bind(this), this.refreshToken.bind(this));

    // Logout
    this.router.post('/logout', this.authenticateToken.bind(this), this.logout.bind(this));

    // Get current user info
    this.router.get('/me', this.authenticateToken.bind(this), this.getCurrentUser.bind(this));

    // Update user profile
    this.router.put('/me', [
      this.authenticateToken.bind(this),
      body('username').optional().isLength({ min: 3, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/),
      body('email').optional().isEmail()
        .normalizeEmail()
    ], this.updateProfile.bind(this));

    // Change password
    this.router.put('/password', [
      this.authenticateToken.bind(this),
      body('currentPassword').notEmpty(),
      body('newPassword')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    ], this.changePassword.bind(this));

    // API key management
    this.router.get('/api-keys', this.authenticateToken.bind(this), this.getApiKeys.bind(this));
    this.router.post('/api-keys', [
      this.authenticateToken.bind(this),
      body('name').isLength({ min: 1, max: 100 }),
      body('permissions').optional().isArray()
    ], this.createApiKey.bind(this));
    this.router.delete('/api-keys/:keyId', this.authenticateToken.bind(this), this.deleteApiKey.bind(this));

    // Email verification (if enabled)
    if (this.config.requireEmailVerification) {
      this.router.post('/verify-email', this.verifyEmail.bind(this));
      this.router.post('/resend-verification', this.resendVerification.bind(this));
    }

    // Password reset
    this.router.post('/forgot-password', [
      body('email').isEmail().normalizeEmail()
    ], this.forgotPassword.bind(this));
    this.router.post('/reset-password', [
      body('token').notEmpty(),
      body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    ], this.resetPassword.bind(this));
  }

  /**
   * User registration
   */
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { username, email, password } = req.body;

      // Check if user already exists
      const existingUser = await this.db.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          error: 'User already exists',
          message: 'Username or email already registered'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.config.bcryptRounds);

      // Create user
      const { rows } = await this.db.query(`
        INSERT INTO users (username, email, password_hash, is_verified)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, is_verified, created_at
      `, [username, email, passwordHash, !this.config.requireEmailVerification]);

      const user = rows[0];

      // Generate JWT token
      const token = this.generateToken(user);

      // Send verification email if required
      if (this.config.requireEmailVerification) {
        await this.sendVerificationEmail(user);
      }

      res.status(201).json({
        message: 'User registered successfully',
        user: this.sanitizeUser(user),
        token,
        requiresVerification: this.config.requireEmailVerification
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        message: 'Internal server error'
      });
    }
  }

  /**
   * User login
   */
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { email, password } = req.body;

      // Get user by email
      const { rows } = await this.db.query(`
        SELECT id, username, email, password_hash, is_verified, is_admin, reputation, created_at
        FROM users
        WHERE email = $1
      `, [email]);

      if (rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      const user = rows[0];

      // Check password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Check if email is verified
      if (this.config.requireEmailVerification && !user.is_verified) {
        return res.status(401).json({
          error: 'Email not verified',
          message: 'Please verify your email address before logging in'
        });
      }

      // Update last login time
      await this.db.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      // Generate JWT token
      const token = this.generateToken(user);

      res.json({
        message: 'Login successful',
        user: this.sanitizeUser(user),
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Token refresh
   */
  async refreshToken(req, res) {
    try {
      const { rows } = await this.db.query(`
        SELECT id, username, email, is_verified, is_admin, reputation
        FROM users
        WHERE id = $1
      `, [req.user.id]);

      if (rows.length === 0) {
        return res.status(401).json({
          error: 'User not found',
          message: 'Token is invalid'
        });
      }

      const user = rows[0];
      const token = this.generateToken(user);

      res.json({
        message: 'Token refreshed successfully',
        user: this.sanitizeUser(user),
        token
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        error: 'Token refresh failed',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Logout (token blacklisting would be implemented here)
   */
  async logout(req, res) {
    // In a production system, you would blacklist the token
    // For now, just return success
    res.json({
      message: 'Logout successful'
    });
  }

  /**
   * Get current user
   */
  async getCurrentUser(req, res) {
    try {
      const { rows } = await this.db.query(`
        SELECT id, username, email, is_verified, is_admin, reputation, created_at, profile_data
        FROM users
        WHERE id = $1
      `, [req.user.id]);

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        user: this.sanitizeUser(rows[0])
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        error: 'Failed to get user information',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { username, email, profileData } = req.body;
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (username) {
        // Check if username is taken by another user
        const { rows: existingUser } = await this.db.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, req.user.id]
        );

        if (existingUser.length > 0) {
          return res.status(400).json({
            error: 'Username already taken'
          });
        }

        updates.push(`username = $${paramCount++}`);
        values.push(username);
      }

      if (email) {
        // Check if email is taken by another user
        const { rows: existingUser } = await this.db.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, req.user.id]
        );

        if (existingUser.length > 0) {
          return res.status(400).json({
            error: 'Email already taken'
          });
        }

        updates.push(`email = $${paramCount++}`);
        values.push(email);

        // If email verification is required, reset verification status
        if (this.config.requireEmailVerification) {
          updates.push('is_verified = false');
        }
      }

      if (profileData) {
        updates.push(`profile_data = $${paramCount++}`);
        values.push(JSON.stringify(profileData));
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'No updates provided'
        });
      }

      values.push(req.user.id);

      const { rows } = await this.db.query(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, email, is_verified, is_admin, reputation, created_at, profile_data
      `, values);

      res.json({
        message: 'Profile updated successfully',
        user: this.sanitizeUser(rows[0])
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Profile update failed',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Get current password hash
      const { rows } = await this.db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!validPassword) {
        return res.status(401).json({
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);

      // Update password
      await this.db.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, req.user.id]
      );

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        error: 'Password change failed',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get user's API keys
   */
  async getApiKeys(req, res) {
    try {
      const { rows } = await this.db.query(`
        SELECT id, name, permissions, rate_limit, is_active, last_used_at, expires_at, created_at
        FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [req.user.id]);

      res.json({
        apiKeys: rows
      });
    } catch (error) {
      console.error('Get API keys error:', error);
      res.status(500).json({
        error: 'Failed to get API keys',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Create new API key
   */
  async createApiKey(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { name, permissions = [], rateLimit = 100, expiresAt } = req.body;

      // Generate API key
      const apiKey = crypto.randomBytes(32).toString('hex');
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      const { rows } = await this.db.query(`
        INSERT INTO api_keys (user_id, key_hash, name, permissions, rate_limit, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, permissions, rate_limit, is_active, expires_at, created_at
      `, [req.user.id, keyHash, name, permissions, rateLimit, expiresAt]);

      res.status(201).json({
        message: 'API key created successfully',
        apiKey: `mk_${apiKey}`, // Prefix for identification
        keyInfo: rows[0],
        warning: 'Save this API key now. You won\'t be able to see it again.'
      });
    } catch (error) {
      console.error('Create API key error:', error);
      res.status(500).json({
        error: 'API key creation failed',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Delete API key
   */
  async deleteApiKey(req, res) {
    try {
      const { keyId } = req.params;

      const { rowCount } = await this.db.query(
        'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
        [keyId, req.user.id]
      );

      if (rowCount === 0) {
        return res.status(404).json({
          error: 'API key not found'
        });
      }

      res.json({
        message: 'API key deleted successfully'
      });
    } catch (error) {
      console.error('Delete API key error:', error);
      res.status(500).json({
        error: 'API key deletion failed',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Authentication middleware for JWT tokens
   */
  authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required'
      });
    }

    jwt.verify(token, this.config.jwtSecret, (err, user) => {
      if (err) {
        return res.status(403).json({
          error: 'Invalid token'
        });
      }

      req.user = user;
      next();
    });
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin
      },
      this.config.jwtSecret,
      { expiresIn: this.config.jwtExpiresIn }
    );
  }

  /**
   * Remove sensitive data from user object
   */
  sanitizeUser(user) {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Send verification email (stub - implement with actual email service)
   */
  async sendVerificationEmail(user) {
    // This would integrate with an email service like SendGrid, AWS SES, etc.
    console.log(`Verification email would be sent to ${user.email}`);
    // Implementation would go here
  }

  /**
   * Email verification
   */
  async verifyEmail(req, res) {
    // Implementation would verify email with token
    res.status(501).json({
      error: 'Email verification not implemented'
    });
  }

  /**
   * Resend verification email
   */
  async resendVerification(req, res) {
    // Implementation would resend verification email
    res.status(501).json({
      error: 'Resend verification not implemented'
    });
  }

  /**
   * Forgot password
   */
  async forgotPassword(req, res) {
    // Implementation would send password reset email
    res.status(501).json({
      error: 'Password reset not implemented'
    });
  }

  /**
   * Reset password
   */
  async resetPassword(req, res) {
    // Implementation would reset password with token
    res.status(501).json({
      error: 'Password reset not implemented'
    });
  }

  /**
   * Get Express router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = AuthService;
