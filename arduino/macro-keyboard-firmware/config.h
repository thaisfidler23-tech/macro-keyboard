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

// Hardware-specific settings
#define LED_PIN 13  // Built-in LED pin for status indication

// Pin usage summary for reference:
// 
// For 8-button configuration:
//   Digital pins 2-3: Row pins
//   Digital pins 4-7: Column pins
//   Analog pins A0-A7: Encoder A channels (if using encoders)
//   Digital pins 14-21: Encoder B channels (if using encoders)
//
// For larger configurations, adjust pins accordingly
// Ensure no pin conflicts between button matrix and encoders

#endif // CONFIG_H