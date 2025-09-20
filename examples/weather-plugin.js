/**
 * Weather Plugin Example
 * 
 * This plugin demonstrates how to:
 * - Create custom action types
 * - Handle configuration with schema validation
 * - Make network requests (with permissions)
 * - Show notifications and dialogs
 * - Handle errors gracefully
 */

module.exports = {
  manifest: {
    id: 'weather-plugin',
    name: 'Weather Plugin',
    version: '1.0.0',
    apiVersion: '1.0.0',
    description: 'Get weather information and display it as notifications',
    author: 'Macro Keyboard Team <team@macro-keyboard.dev>',
    homepage: 'https://github.com/macro-keyboard/examples',
    license: 'MIT',
    keywords: ['weather', 'api', 'notifications'],
    
    permissions: {
      network: true,        // Required for weather API calls
      fileSystem: false,
      hardware: false,
      system: false
    }
  },
  
  // Plugin configuration with default values
  config: {
    apiKey: '',              // OpenWeatherMap API key
    defaultCity: 'London',   // Default city for weather queries
    units: 'metric',         // Temperature units: metric, imperial, kelvin
    showDetails: true,       // Show detailed weather information
    cacheTime: 300000       // Cache weather data for 5 minutes
  },
  
  // Weather data cache
  cache: new Map(),
  
  /**
   * Initialize the plugin
   */
  initialize: function(api) {
    this.api = api;
    this.logger = api.getLogger();
    this.logger.info('Weather Plugin initialized');
    
    // Load saved configuration
    const savedConfig = api.getConfig();
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }
    
    // Validate API key
    if (!this.config.apiKey) {
      this.logger.warn('Weather API key not configured. Some features will be unavailable.');
    }
  },
  
  /**
   * Clean up resources
   */
  dispose: function() {
    // Clear cache
    this.cache.clear();
    this.logger.info('Weather Plugin disposed');
  },
  
  /**
   * Return available action types
   */
  getActionTypes: function() {
    return [
      'get-weather',
      'get-weather-forecast',
      'set-weather-city',
      'show-weather-widget'
    ];
  },
  
  /**
   * Execute plugin actions
   */
  executeAction: function(actionType, config, context) {
    this.logger.debug('Executing action', { actionType, config });
    
    switch (actionType) {
      case 'get-weather':
        return this.getCurrentWeather(config);
        
      case 'get-weather-forecast':
        return this.getWeatherForecast(config);
        
      case 'set-weather-city':
        return this.setDefaultCity(config);
        
      case 'show-weather-widget':
        return this.showWeatherWidget(config);
        
      default:
        return {
          success: false,
          error: `Unknown action type: ${actionType}`
        };
    }
  },
  
  /**
   * Get configuration schema for validation
   */
  getConfigSchema: function() {
    return {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'OpenWeatherMap API key',
          minLength: 1
        },
        defaultCity: {
          type: 'string',
          description: 'Default city for weather queries',
          default: 'London',
          minLength: 1
        },
        units: {
          type: 'string',
          description: 'Temperature units',
          enum: ['metric', 'imperial', 'kelvin'],
          default: 'metric'
        },
        showDetails: {
          type: 'boolean',
          description: 'Show detailed weather information',
          default: true
        },
        cacheTime: {
          type: 'integer',
          description: 'Cache time for weather data (milliseconds)',
          minimum: 60000,
          maximum: 3600000,
          default: 300000
        }
      },
      required: ['apiKey']
    };
  },
  
  /**
   * Update plugin configuration
   */
  updateConfig: function(newConfig) {
    try {
      // Validate configuration against schema
      const schema = this.getConfigSchema();
      const validation = this.validateConfigData(newConfig, schema);
      
      if (!validation.valid) {
        throw new Error('Invalid configuration: ' + validation.errors.join(', '));
      }
      
      // Update configuration
      this.config = { ...this.config, ...newConfig };
      
      // Clear cache when configuration changes
      this.cache.clear();
      
      this.logger.info('Configuration updated', { config: this.config });
      return true;
      
    } catch (error) {
      this.logger.error('Failed to update configuration', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Get current weather for a city
   */
  getCurrentWeather: async function(config) {
    try {
      const city = config.city || this.config.defaultCity;
      
      if (!this.config.apiKey) {
        return {
          success: false,
          error: 'Weather API key not configured'
        };
      }
      
      // Check cache
      const cacheKey = `current_${city}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        this.logger.debug('Using cached weather data', { city });
        return {
          success: true,
          result: cached,
          source: 'cache'
        };
      }
      
      // Make API request
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${this.config.apiKey}&units=${this.config.units}`;
      
      const response = await this.api.httpRequest({
        method: 'GET',
        url: url,
        timeout: 10000
      });
      
      if (!response.success) {
        throw new Error('Weather API request failed: ' + response.error);
      }
      
      const weatherData = response.data;
      
      // Format weather information
      const formattedWeather = this.formatWeatherData(weatherData);
      
      // Cache the data
      this.setCachedData(cacheKey, formattedWeather);
      
      // Show notification if requested
      if (config.showNotification !== false) {
        this.api.showNotification(
          `Weather in ${formattedWeather.city}: ${formattedWeather.temperature}°${this.getTemperatureUnit()} - ${formattedWeather.description}`,
          'info'
        );
      }
      
      return {
        success: true,
        result: formattedWeather,
        source: 'api'
      };
      
    } catch (error) {
      this.logger.error('Failed to get current weather', { error: error.message, config });
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * Get weather forecast for a city
   */
  getWeatherForecast: async function(config) {
    try {
      const city = config.city || this.config.defaultCity;
      const days = config.days || 5;
      
      if (!this.config.apiKey) {
        return {
          success: false,
          error: 'Weather API key not configured'
        };
      }
      
      // Check cache
      const cacheKey = `forecast_${city}_${days}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        this.logger.debug('Using cached forecast data', { city, days });
        return {
          success: true,
          result: cached,
          source: 'cache'
        };
      }
      
      // Make API request
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${this.config.apiKey}&units=${this.config.units}&cnt=${days * 8}`;
      
      const response = await this.api.httpRequest({
        method: 'GET',
        url: url,
        timeout: 10000
      });
      
      if (!response.success) {
        throw new Error('Weather forecast API request failed: ' + response.error);
      }
      
      const forecastData = response.data;
      
      // Format forecast information
      const formattedForecast = this.formatForecastData(forecastData, days);
      
      // Cache the data
      this.setCachedData(cacheKey, formattedForecast);
      
      return {
        success: true,
        result: formattedForecast,
        source: 'api'
      };
      
    } catch (error) {
      this.logger.error('Failed to get weather forecast', { error: error.message, config });
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * Set default city for weather queries
   */
  setDefaultCity: async function(config) {
    try {
      const city = config.city;
      
      if (!city) {
        return {
          success: false,
          error: 'City name is required'
        };
      }
      
      // Verify city exists by making a test API call
      if (this.config.apiKey) {
        const testResult = await this.getCurrentWeather({ 
          city: city, 
          showNotification: false 
        });
        
        if (!testResult.success) {
          return {
            success: false,
            error: `Cannot find city: ${city}`
          };
        }
      }
      
      // Update configuration
      await this.updateConfig({ defaultCity: city });
      
      this.api.showNotification(`Default city set to ${city}`, 'success');
      
      return {
        success: true,
        result: { defaultCity: city }
      };
      
    } catch (error) {
      this.logger.error('Failed to set default city', { error: error.message, config });
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * Show weather widget dialog
   */
  showWeatherWidget: async function(config) {
    try {
      const city = config.city || this.config.defaultCity;
      
      // Get current weather
      const weatherResult = await this.getCurrentWeather({ 
        city: city, 
        showNotification: false 
      });
      
      if (!weatherResult.success) {
        return weatherResult;
      }
      
      const weather = weatherResult.result;
      
      // Show dialog with weather information
      const dialogResult = await this.api.showDialog({
        title: `Weather in ${weather.city}`,
        message: this.formatWeatherMessage(weather),
        buttons: ['OK', 'Get Forecast', 'Change City'],
        type: 'info'
      });
      
      // Handle dialog response
      if (dialogResult.response === 1) { // Get Forecast
        return this.getWeatherForecast({ city: city });
      } else if (dialogResult.response === 2) { // Change City
        const cityDialog = await this.api.showDialog({
          title: 'Change City',
          message: 'Enter city name:',
          buttons: ['OK', 'Cancel'],
          type: 'question',
          defaultValue: city
        });
        
        if (cityDialog.response === 0 && cityDialog.value) {
          return this.setDefaultCity({ city: cityDialog.value });
        }
      }
      
      return {
        success: true,
        result: weather
      };
      
    } catch (error) {
      this.logger.error('Failed to show weather widget', { error: error.message, config });
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * Format raw weather data from API
   */
  formatWeatherData: function(data) {
    return {
      city: data.name,
      country: data.sys.country,
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      description: data.weather[0].description,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind.speed,
      windDirection: data.wind.deg,
      visibility: data.visibility / 1000, // Convert to kilometers
      cloudiness: data.clouds.all,
      sunrise: new Date(data.sys.sunrise * 1000),
      sunset: new Date(data.sys.sunset * 1000),
      timestamp: new Date()
    };
  },
  
  /**
   * Format forecast data from API
   */
  formatForecastData: function(data, days) {
    const forecasts = [];
    const processedDates = new Set();
    
    for (let i = 0; i < data.list.length && forecasts.length < days; i++) {
      const item = data.list[i];
      const date = new Date(item.dt * 1000).toDateString();
      
      // Take one forecast per day (around noon)
      if (!processedDates.has(date)) {
        const hour = new Date(item.dt * 1000).getHours();
        if (hour >= 11 && hour <= 14) {
          processedDates.add(date);
          forecasts.push({
            date: new Date(item.dt * 1000),
            temperature: Math.round(item.main.temp),
            minTemp: Math.round(item.main.temp_min),
            maxTemp: Math.round(item.main.temp_max),
            description: item.weather[0].description,
            humidity: item.main.humidity,
            windSpeed: item.wind.speed,
            cloudiness: item.clouds.all
          });
        }
      }
    }
    
    return {
      city: data.city.name,
      country: data.city.country,
      forecasts: forecasts,
      timestamp: new Date()
    };
  },
  
  /**
   * Format weather data for display message
   */
  formatWeatherMessage: function(weather) {
    const unit = this.getTemperatureUnit();
    let message = `Temperature: ${weather.temperature}°${unit} (feels like ${weather.feelsLike}°${unit})\n`;
    message += `Condition: ${weather.description}\n`;
    
    if (this.config.showDetails) {
      message += `Humidity: ${weather.humidity}%\n`;
      message += `Wind: ${weather.windSpeed} m/s\n`;
      message += `Pressure: ${weather.pressure} hPa\n`;
      message += `Visibility: ${weather.visibility} km`;
    }
    
    return message;
  },
  
  /**
   * Get temperature unit symbol based on configuration
   */
  getTemperatureUnit: function() {
    switch (this.config.units) {
      case 'imperial': return 'F';
      case 'kelvin': return 'K';
      case 'metric':
      default: return 'C';
    }
  },
  
  /**
   * Get cached data if still valid
   */
  getCachedData: function(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTime) {
      return cached.data;
    }
    return null;
  },
  
  /**
   * Store data in cache with timestamp
   */
  setCachedData: function(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  },
  
  /**
   * Simple configuration validation (in real plugin, use proper JSON Schema validation)
   */
  validateConfigData: function(data, schema) {
    const errors = [];
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    // Basic type checking for demonstration
    for (const [key, value] of Object.entries(data)) {
      const prop = schema.properties[key];
      if (prop) {
        if (prop.type === 'string' && typeof value !== 'string') {
          errors.push(`Field ${key} must be a string`);
        }
        if (prop.type === 'integer' && !Number.isInteger(value)) {
          errors.push(`Field ${key} must be an integer`);
        }
        if (prop.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Field ${key} must be a boolean`);
        }
        if (prop.enum && !prop.enum.includes(value)) {
          errors.push(`Field ${key} must be one of: ${prop.enum.join(', ')}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
};