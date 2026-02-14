/**
 * Review Service
 * 
 * Manages plugin reviews, ratings, and moderation for the marketplace.
 * 
 * @module ReviewService
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class ReviewService extends EventEmitter {
  constructor(pluginService, logger, config = {}) {
    super();
    
    this.pluginService = pluginService;
    this.logger = logger;
    this.config = {
      minRating: 1,
      maxRating: 5,
      minReviewLength: 10,
      maxReviewLength: 2000,
      requireDownload: true, // Must download plugin before reviewing
      moderationEnabled: true,
      ...config
    };
    
    this.reviews = new Map();
    this.userReviews = new Map(); // Track reviews per user
    this.pendingModeration = new Map();
    
    this.statistics = {
      totalReviews: 0,
      pendingModeration: 0,
      averageRating: 0
    };
  }

  /**
   * Submit a review for a plugin
   */
  async submitReview(pluginId, userId, reviewData) {
    try {
      // Validate plugin exists
      const plugin = await this.pluginService.getPlugin(pluginId);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
      
      // Check if user already reviewed this plugin
      const existingReview = this._getUserReviewForPlugin(userId, pluginId);
      if (existingReview) {
        throw new Error('You have already reviewed this plugin. Use updateReview instead.');
      }
      
      // Validate review data
      this._validateReviewData(reviewData);
      
      // Create review
      const review = {
        id: crypto.randomBytes(8).toString('hex'),
        pluginId,
        userId,
        rating: reviewData.rating,
        title: reviewData.title || null,
        body: reviewData.body,
        helpful: 0,
        notHelpful: 0,
        status: this.config.moderationEnabled ? 'pending' : 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store review
      this.reviews.set(review.id, review);
      
      // Track user reviews
      this._trackUserReview(userId, review.id, pluginId);
      
      // Handle moderation
      if (this.config.moderationEnabled) {
        this.pendingModeration.set(review.id, review);
        this.statistics.pendingModeration++;
      } else {
        // Update plugin rating immediately
        await this._updatePluginRating(pluginId);
      }
      
      this.statistics.totalReviews++;
      
      this.emit('reviewSubmitted', { review });
      
      return {
        id: review.id,
        status: review.status,
        message: review.status === 'pending' 
          ? 'Your review has been submitted and is awaiting moderation'
          : 'Your review has been published'
      };
    } catch (error) {
      this.logger?.error('Submit review failed', { pluginId, userId, error });
      throw error;
    }
  }

  /**
   * Update an existing review
   */
  async updateReview(reviewId, userId, updates) {
    try {
      const review = this.reviews.get(reviewId);
      
      if (!review) {
        throw new Error(`Review not found: ${reviewId}`);
      }
      
      if (review.userId !== userId) {
        throw new Error('You can only update your own reviews');
      }
      
      // Validate updates
      if (updates.rating !== undefined) {
        this._validateRating(updates.rating);
        review.rating = updates.rating;
      }
      
      if (updates.title !== undefined) {
        review.title = updates.title;
      }
      
      if (updates.body !== undefined) {
        this._validateReviewBody(updates.body);
        review.body = updates.body;
      }
      
      review.updatedAt = new Date().toISOString();
      
      // Re-trigger moderation if enabled
      if (this.config.moderationEnabled) {
        review.status = 'pending';
        this.pendingModeration.set(review.id, review);
        this.statistics.pendingModeration++;
      } else {
        await this._updatePluginRating(review.pluginId);
      }
      
      this.emit('reviewUpdated', { review });
      
      return review;
    } catch (error) {
      this.logger?.error('Update review failed', { reviewId, userId, error });
      throw error;
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId, userId, isAdmin = false) {
    try {
      const review = this.reviews.get(reviewId);
      
      if (!review) {
        throw new Error(`Review not found: ${reviewId}`);
      }
      
      if (review.userId !== userId && !isAdmin) {
        throw new Error('You can only delete your own reviews');
      }
      
      const pluginId = review.pluginId;
      
      // Remove from all maps
      this.reviews.delete(reviewId);
      this.pendingModeration.delete(reviewId);
      this._removeUserReview(review.userId, reviewId);
      
      // Update plugin rating
      await this._updatePluginRating(pluginId);
      
      this.emit('reviewDeleted', { reviewId, pluginId });
      
      return true;
    } catch (error) {
      this.logger?.error('Delete review failed', { reviewId, userId, error });
      throw error;
    }
  }

  /**
   * Get reviews for a plugin
   */
  async getPluginReviews(pluginId, options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'recent',
      includeRatings = true
    } = options;
    
    let reviews = Array.from(this.reviews.values())
      .filter(r => r.pluginId === pluginId && r.status === 'approved');
    
    // Sort reviews
    switch (sortBy) {
      case 'recent':
        reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'helpful':
        reviews.sort((a, b) => b.helpful - a.helpful);
        break;
      case 'rating-high':
        reviews.sort((a, b) => b.rating - a.rating);
        break;
      case 'rating-low':
        reviews.sort((a, b) => a.rating - b.rating);
        break;
    }
    
    const totalCount = reviews.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Paginate
    const startIndex = (page - 1) * limit;
    reviews = reviews.slice(startIndex, startIndex + limit);
    
    const result = {
      reviews,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    };
    
    if (includeRatings) {
      result.ratingsSummary = this._getRatingsSummary(pluginId);
    }
    
    return result;
  }

  /**
   * Get a single review
   */
  async getReview(reviewId) {
    return this.reviews.get(reviewId) || null;
  }

  /**
   * Mark review as helpful or not helpful
   */
  async markReviewHelpfulness(reviewId, userId, isHelpful) {
    const review = this.reviews.get(reviewId);
    
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }
    
    if (review.userId === userId) {
      throw new Error('You cannot mark your own review');
    }
    
    // Simple increment (in production, track per-user votes)
    if (isHelpful) {
      review.helpful++;
    } else {
      review.notHelpful++;
    }
    
    this.emit('reviewHelpfulnessMarked', { reviewId, isHelpful });
    
    return review;
  }

  /**
   * Moderate a review (admin function)
   */
  async moderateReview(reviewId, action, reason = null) {
    const review = this.pendingModeration.get(reviewId);
    
    if (!review) {
      throw new Error(`Review not found in moderation queue: ${reviewId}`);
    }
    
    switch (action) {
      case 'approve':
        review.status = 'approved';
        this.pendingModeration.delete(reviewId);
        this.statistics.pendingModeration--;
        await this._updatePluginRating(review.pluginId);
        break;
        
      case 'reject':
        review.status = 'rejected';
        review.rejectionReason = reason;
        this.pendingModeration.delete(reviewId);
        this.statistics.pendingModeration--;
        break;
        
      case 'flag':
        review.status = 'flagged';
        review.flagReason = reason;
        break;
        
      default:
        throw new Error(`Invalid moderation action: ${action}`);
    }
    
    review.moderatedAt = new Date().toISOString();
    
    this.emit('reviewModerated', { reviewId, action, reason });
    
    return review;
  }

  /**
   * Get pending moderation queue
   */
  getPendingModeration(options = {}) {
    const { page = 1, limit = 20 } = options;
    
    const reviews = Array.from(this.pendingModeration.values())
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const startIndex = (page - 1) * limit;
    
    return {
      reviews: reviews.slice(startIndex, startIndex + limit),
      totalCount: reviews.length
    };
  }

  /**
   * Validate review data
   */
  _validateReviewData(data) {
    this._validateRating(data.rating);
    this._validateReviewBody(data.body);
  }

  /**
   * Validate rating value
   */
  _validateRating(rating) {
    if (typeof rating !== 'number' || 
        rating < this.config.minRating || 
        rating > this.config.maxRating) {
      throw new Error(`Rating must be between ${this.config.minRating} and ${this.config.maxRating}`);
    }
  }

  /**
   * Validate review body
   */
  _validateReviewBody(body) {
    if (!body || typeof body !== 'string') {
      throw new Error('Review body is required');
    }
    
    if (body.length < this.config.minReviewLength) {
      throw new Error(`Review must be at least ${this.config.minReviewLength} characters`);
    }
    
    if (body.length > this.config.maxReviewLength) {
      throw new Error(`Review cannot exceed ${this.config.maxReviewLength} characters`);
    }
  }

  /**
   * Track user review
   */
  _trackUserReview(userId, reviewId, pluginId) {
    if (!this.userReviews.has(userId)) {
      this.userReviews.set(userId, []);
    }
    this.userReviews.get(userId).push({ reviewId, pluginId });
  }

  /**
   * Remove user review tracking
   */
  _removeUserReview(userId, reviewId) {
    const reviews = this.userReviews.get(userId);
    if (reviews) {
      const index = reviews.findIndex(r => r.reviewId === reviewId);
      if (index !== -1) {
        reviews.splice(index, 1);
      }
    }
  }

  /**
   * Get user's review for a specific plugin
   */
  _getUserReviewForPlugin(userId, pluginId) {
    const userReviewList = this.userReviews.get(userId);
    if (!userReviewList) return null;
    
    const entry = userReviewList.find(r => r.pluginId === pluginId);
    if (!entry) return null;
    
    return this.reviews.get(entry.reviewId);
  }

  /**
   * Update plugin's aggregate rating
   */
  async _updatePluginRating(pluginId) {
    const approvedReviews = Array.from(this.reviews.values())
      .filter(r => r.pluginId === pluginId && r.status === 'approved');
    
    if (approvedReviews.length === 0) {
      return;
    }
    
    const totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / approvedReviews.length;
    
    await this.pluginService.updatePlugin(pluginId, {
      rating: Math.round(averageRating * 10) / 10,
      reviewCount: approvedReviews.length
    });
  }

  /**
   * Get ratings summary for a plugin
   */
  _getRatingsSummary(pluginId) {
    const reviews = Array.from(this.reviews.values())
      .filter(r => r.pluginId === pluginId && r.status === 'approved');
    
    if (reviews.length === 0) {
      return {
        average: 0,
        total: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }
    
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    
    for (const review of reviews) {
      distribution[Math.round(review.rating)] = (distribution[Math.round(review.rating)] || 0) + 1;
      total += review.rating;
    }
    
    return {
      average: Math.round((total / reviews.length) * 10) / 10,
      total: reviews.length,
      distribution
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const allReviews = Array.from(this.reviews.values());
    const approved = allReviews.filter(r => r.status === 'approved');
    
    let avgRating = 0;
    if (approved.length > 0) {
      avgRating = approved.reduce((sum, r) => sum + r.rating, 0) / approved.length;
    }
    
    return {
      totalReviews: this.statistics.totalReviews,
      approvedReviews: approved.length,
      pendingModeration: this.statistics.pendingModeration,
      averageRating: Math.round(avgRating * 10) / 10
    };
  }
}

module.exports = ReviewService;
