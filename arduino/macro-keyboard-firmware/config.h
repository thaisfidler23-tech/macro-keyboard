/*
  Configuration file for Macro Keyboard Firmware
  
  Modify these values to match your hardware configuration.
  After changing values, recompile and upload the firmware.
*/

#ifndef CONFIG_H
#define CONFIG_H

// Serial communication settings
#define BAUD_RATE 9600

// Button matrix configuration
// Choose one configuration based on your button count

// Configuration for 8 buttons (2x4 matrix)
#if defined(BUTTONS_8)
  #define BUTTON_COUNT 8
  #define MATRIX_ROWS 2
  #define MATRIX_COLS 4
  const int rowPins[MATRIX_ROWS] = {2, 3};
  const int colPins[MATRIX_COLS] = {4, 5, 6, 7};

// Configuration for 12 buttons (3x4 matrix)
#elif defined(BUTTONS_12)
  #define BUTTON_COUNT 12
  #define MATRIX_ROWS 3
  #define MATRIX_COLS 4
  const int rowPins[MATRIX_ROWS] = {2, 3, 4};
  const int colPins[MATRIX_COLS] = {5, 6, 7, 8};

// Configuration for 16 buttons (4x4 matrix)
#elif defined(BUTTONS_16)
  #define BUTTON_COUNT 16
  #define MATRIX_ROWS 4
  #define MATRIX_COLS 4
  const int rowPins[MATRIX_ROWS] = {2, 3, 4, 5};
  const int colPins[MATRIX_COLS] = {6, 7, 8, 9};

// Configuration for 24 buttons (4x6 matrix)
#elif defined(BUTTONS_24)
  #define BUTTON_COUNT 24
  #define MATRIX_ROWS 4
  #define MATRIX_COLS 6
  const int rowPins[MATRIX_ROWS] = {2, 3, 4, 5};
  const int colPins[MATRIX_COLS] = {6, 7, 8, 9, 10, 11};

// Configuration for 32 buttons (4x8 matrix)
#elif defined(BUTTONS_32)
  #define BUTTON_COUNT 32
  #define MATRIX_ROWS 4
  #define MATRIX_COLS 8
  const int rowPins[MATRIX_ROWS] = {2, 3, 4, 5};
  const int colPins[MATRIX_COLS] = {6, 7, 8, 9, 10, 11, 12, 13};

// Default to 8 buttons if no configuration is specified
#else
  #define BUTTON_COUNT 8
  #define MATRIX_ROWS 2
  #define MATRIX_COLS 4
  const int rowPins[MATRIX_ROWS] = {2, 3};
  const int colPins[MATRIX_COLS] = {4, 5, 6, 7};
#endif

// Maximum supported buttons and encoders
#define MAX_BUTTONS 32
#define MAX_ENCODERS 8

// Encoder configuration
// Set the number of encoders you want to use (0-8)
#ifndef ENCODER_COUNT
  #define ENCODER_COUNT 0  // Default: no encoders
#endif

// Encoder pin assignments
// Each encoder uses 2 pins (A and B channels)
#if ENCODER_COUNT > 0
  const int ENCODER_A_PINS[MAX_ENCODERS] = {A0, A1, A2, A3, A4, A5, A6, A7};
  const int ENCODER_B_PINS[MAX_ENCODERS] = {14, 15, 16, 17, 18, 19, 20, 21};
#endif

// RGB LED Configuration
// WS2812B (NeoPixel) LED strip support
#define RGB_LED_ENABLED true     // Enable/disable RGB LED support
#define RGB_LED_PIN 22           // Data pin for WS2812B LED strip (use available digital pin)
#define RGB_LED_COUNT MAX_BUTTONS // One LED per button (matches button count)
#define RGB_BRIGHTNESS 128       // Default brightness (0-255)

// LED update timing and performance optimization
#define LED_UPDATE_INTERVAL 16   // ms - 60fps target (1000/60 ≈ 16ms)
#define LED_FADE_SPEED 5        // Speed of fade animations (1-10)
#define ANIMATION_FPS 60        // Target animation frame rate
#define EFFECT_UPDATE_INTERVAL (1000 / ANIMATION_FPS) // 16ms for 60fps

// Memory optimization for Arduino Micro (2KB RAM)
#define LED_BUFFER_SIZE (MAX_BUTTONS * 3)  // RGB values buffer
#define EFFECT_BUFFER_SIZE 64              // Effect state data buffer
#define OPTIMIZE_MEMORY 1                  // Enable memory optimization features

// Power management and safety
#define MAX_USB_POWER 400        // mA - Conservative USB 2.0 limit (500mA - overhead)
#define LED_CURRENT_PER_LEVEL 1  // mA per brightness level per LED (approximate)
#define ENABLE_POWER_LIMITING 1  // Enable automatic power limiting
#define THERMAL_PROTECTION 1     // Enable thermal protection (placeholder)

// LED timing optimization
#define LED_STRIP_SPEED NEO_KHZ800     // WS2812B speed
#define LED_COLOR_ORDER NEO_GRB        // WS2812B color order

// Default LED colors (RGB values 0-255)
#define RGB_DEFAULT_R 50
#define RGB_DEFAULT_G 50  
#define RGB_DEFAULT_B 100

#define RGB_ACTIVE_R 0
#define RGB_ACTIVE_G 255
#define RGB_ACTIVE_B 0

#define RGB_PRESSED_R 255
#define RGB_PRESSED_G 100
#define RGB_PRESSED_B 0

#define RGB_ERROR_R 255
#define RGB_ERROR_G 0
#define RGB_ERROR_B 0

// Hardware-specific settings
#define LED_PIN 13  // Built-in LED pin for status indication

// Pin usage summary for reference:
// 
// For 8-button configuration:
//   Digital pins 2-3: Row pins
//   Digital pins 4-7: Column pins
//   Analog pins A0-A7: Encoder A channels (if using encoders)
//   Digital pins 14-21: Encoder B channels (if using encoders)
//   Digital pin 22: RGB LED data pin (WS2812B strip)
//
// For larger configurations, adjust pins accordingly
// Ensure no pin conflicts between button matrix, encoders, and LEDs

#endif // CONFIG_H