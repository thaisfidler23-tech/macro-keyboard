/*
  Macro Keyboard Firmware
  
  This firmware supports configurable button matrices, rotary encoders, and RGB LEDs.
  It communicates with the host application via serial communication.
  
  Supported configurations:
  - 8, 12, 16, 24, or 32 buttons in matrix layout
  - Up to 8 rotary encoders
  - RGB LED strip (WS2812B/NeoPixel) with per-button lighting
  
  Communication protocol:
  - Button press: "BTN:<button_id>"
  - Encoder rotation: "ENC:<encoder_id>:<direction>"
    where direction is "CW" (clockwise) or "CCW" (counter-clockwise)
  - Configuration: "CONFIG:BUTTONS:<count>" or "CONFIG:ENCODERS:<count>"
  - LED commands: 
    - "LED:<button_id>:<r>:<g>:<b>" - Set specific button color
    - "LED:ALL:<r>:<g>:<b>" - Set all buttons to same color
    - "LED:CLEAR" - Turn off all LEDs
    - "LED:EFFECT:<effect_name>:<speed>" - Start LED effect
    - "LED:BRIGHTNESS:<0-255>" - Set overall brightness
  
  Author: Jenna Massardo
  License: MIT
*/

#include "config.h"
#include <EEPROM.h>

// RGB LED support
#if RGB_LED_ENABLED
  #include <Adafruit_NeoPixel.h>
  
  // Create NeoPixel strip object with optimized settings
  Adafruit_NeoPixel strip(RGB_LED_COUNT, RGB_LED_PIN, LED_COLOR_ORDER + LED_STRIP_SPEED);
  
  // LED state tracking with memory optimization
  struct LEDState {
    uint8_t r, g, b;
    uint8_t targetR, targetG, targetB;
    bool animating;
    unsigned long animationStart;
    uint16_t animationDuration;
  };
  
  LEDState ledStates[MAX_BUTTONS];
  unsigned long lastLEDUpdate = 0;
  uint8_t globalBrightness = RGB_BRIGHTNESS;
  
  // LED effect variables with memory optimization
  enum LEDEffect {
    EFFECT_NONE,
    EFFECT_RAINBOW,
    EFFECT_BREATHE,
    EFFECT_WAVE,
    EFFECT_PRESS_RIPPLE
  };
  
  LEDEffect currentEffect = EFFECT_NONE;
  uint8_t effectSpeed = 5;
  unsigned long effectStart = 0;
  uint16_t effectStep = 0;
  
  // Power management variables
  uint16_t currentPowerUsage = 0;  // Estimated current power usage in mA
  bool powerLimitingActive = false;
  uint8_t thermalBrightness = 255; // Thermal limiting factor
  
  #if OPTIMIZE_MEMORY
    // Gamma correction table in program memory to save RAM
    const uint8_t PROGMEM gamma8[] = {
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  1,  1,  1,  1,
      1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  2,  2,  2,  2,  2,  2,
      2,  3,  3,  3,  3,  3,  3,  3,  4,  4,  4,  4,  4,  5,  5,  5,
      5,  6,  6,  6,  6,  7,  7,  7,  7,  8,  8,  8,  9,  9,  9, 10,
     10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16,
     17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 24, 24, 25,
     25, 26, 27, 27, 28, 29, 29, 30, 31, 32, 32, 33, 34, 35, 35, 36,
     37, 38, 39, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 50,
     51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68,
     69, 70, 72, 73, 74, 75, 77, 78, 79, 81, 82, 83, 85, 86, 87, 89,
     90, 92, 93, 95, 96, 98, 99,101,102,104,105,107,109,110,112,114,
    115,117,119,120,122,124,126,127,129,131,133,135,137,138,140,142,
    144,146,148,150,152,154,156,158,160,162,164,167,169,171,173,175,
    177,180,182,184,186,189,191,193,196,198,200,203,205,208,210,213,
    215,218,220,223,225,228,231,233,236,239,241,244,247,249,252,255 };
  
    // Compress effect state to save memory
    struct CompactEffectState {
      uint8_t effectType : 4;    // 16 possible effects (0-15)
      uint8_t intensity : 4;     // 16 intensity levels (0-15)
      uint16_t phase;            // Current animation phase
      uint8_t params[4];         // Effect-specific parameters
    };
    
    CompactEffectState effectState;
  #endif
#endif

// Configuration structure for EEPROM storage
struct DeviceConfig {
  uint8_t buttonCount;
  uint8_t encoderCount;
  uint8_t matrixRows;
  uint8_t matrixCols;
  uint8_t ledBrightness;
  bool ledEnabled;
  bool isValid;
};

// EEPROM address for configuration
#define EEPROM_CONFIG_ADDR 0
#define CONFIG_MAGIC_NUMBER 0xAB  // Used to verify EEPROM data integrity

// Current runtime configuration
DeviceConfig currentConfig;

// Predefined matrix configurations
struct MatrixConfig {
  uint8_t rows;
  uint8_t cols;
  int rowPins[4];
  int colPins[8];
};

const MatrixConfig matrixConfigs[5] = {
  // 8 buttons (2x4)
  { 2, 4, {2, 3, -1, -1}, {4, 5, 6, 7, -1, -1, -1, -1} },
  // 12 buttons (3x4)  
  { 3, 4, {2, 3, 4, -1}, {5, 6, 7, 8, -1, -1, -1, -1} },
  // 16 buttons (4x4)
  { 4, 4, {2, 3, 4, 5}, {6, 7, 8, 9, -1, -1, -1, -1} },
  // 24 buttons (4x6)
  { 4, 6, {2, 3, 4, 5}, {6, 7, 8, 9, 10, 11, -1, -1} },
  // 32 buttons (4x8)
  { 4, 8, {2, 3, 4, 5}, {6, 7, 8, 9, 10, 11, 12, 13} }
};

// Get matrix config index for button count
int getMatrixConfigIndex(uint8_t buttonCount) {
  switch (buttonCount) {
    case 8: return 0;
    case 12: return 1;
    case 16: return 2;
    case 24: return 3;
    case 32: return 4;
    default: return 0; // Default to 8 buttons
  }
}
bool buttonStates[MAX_BUTTONS];
bool prevButtonStates[MAX_BUTTONS];
unsigned long buttonDebounceTime[MAX_BUTTONS];

// Button matrix variables
// Encoder variables
int encoderPinA[MAX_ENCODERS];
int encoderPinB[MAX_ENCODERS];
int encoderLastState[MAX_ENCODERS];
bool encoderEnabled[MAX_ENCODERS];

// Timing variables
unsigned long lastScanTime = 0;
const unsigned long SCAN_INTERVAL = 10; // ms
const unsigned long DEBOUNCE_DELAY = 50; // ms

// Configuration management functions
void loadConfiguration() {
  // Try to read configuration from EEPROM
  EEPROM.get(EEPROM_CONFIG_ADDR, currentConfig);
  
  // Check if configuration is valid
  if (currentConfig.isValid != true || 
      currentConfig.buttonCount < 8 || currentConfig.buttonCount > 32 ||
      currentConfig.encoderCount > MAX_ENCODERS) {
    // Use default configuration
    setDefaultConfiguration();
    saveConfiguration();
  }
  
  // Update matrix configuration based on button count
  int configIndex = getMatrixConfigIndex(currentConfig.buttonCount);
  currentConfig.matrixRows = matrixConfigs[configIndex].rows;
  currentConfig.matrixCols = matrixConfigs[configIndex].cols;
}

void setDefaultConfiguration() {
  currentConfig.buttonCount = 8;
  currentConfig.encoderCount = 0;
  currentConfig.matrixRows = 2;
  currentConfig.matrixCols = 4;
  currentConfig.ledBrightness = RGB_BRIGHTNESS;
  currentConfig.ledEnabled = RGB_LED_ENABLED;
  currentConfig.isValid = true;
}

void saveConfiguration() {
  currentConfig.isValid = true;
  EEPROM.put(EEPROM_CONFIG_ADDR, currentConfig);
}

bool setButtonCount(uint8_t count) {
  // Validate button count
  if (count != 8 && count != 12 && count != 16 && count != 24 && count != 32) {
    return false;
  }
  
  currentConfig.buttonCount = count;
  
  // Update matrix configuration
  int configIndex = getMatrixConfigIndex(count);
  currentConfig.matrixRows = matrixConfigs[configIndex].rows;
  currentConfig.matrixCols = matrixConfigs[configIndex].cols;
  
  // Reinitialize buttons
  initializeButtons();
  
  return true;
}

bool setEncoderCount(uint8_t count) {
  // Validate encoder count
  if (count > MAX_ENCODERS) {
    return false;
  }
  
  currentConfig.encoderCount = count;
  
  // Reinitialize encoders
  initializeEncoders();
  
  return true;
}

void setup() {
  Serial.begin(BAUD_RATE);
  
  // Load configuration from EEPROM or use defaults
  loadConfiguration();
  
  // Initialize hardware based on configuration
  initializeButtons();
  initializeEncoders();
  initializeLEDs();
  
  Serial.println("Macro Keyboard Ready");
  Serial.print("Buttons: ");
  Serial.println(currentConfig.buttonCount);
  Serial.print("Encoders: ");
  Serial.println(currentConfig.encoderCount);
  Serial.print("RGB LEDs: ");
  Serial.println(currentConfig.ledEnabled ? "Enabled" : "Disabled");
}

void loop() {
  unsigned long currentTime = millis();
  
  if (currentTime - lastScanTime >= SCAN_INTERVAL) {
    scanButtons();
    scanEncoders();
    lastScanTime = currentTime;
  }
  
  // Handle serial communication
  if (Serial.available() > 0) {
    serialEvent();
  }
  
  // Update RGB LEDs
#if RGB_LED_ENABLED
  if (currentConfig.ledEnabled && currentTime - lastLEDUpdate >= LED_UPDATE_INTERVAL) {
    updateLEDs();
    lastLEDUpdate = currentTime;
  }
#endif
}

void initializeButtons() {
  int configIndex = getMatrixConfigIndex(currentConfig.buttonCount);
  const MatrixConfig &config = matrixConfigs[configIndex];
  
  // Initialize row pins as outputs
  for (int i = 0; i < config.rows; i++) {
    if (config.rowPins[i] != -1) {
      pinMode(config.rowPins[i], OUTPUT);
      digitalWrite(config.rowPins[i], HIGH);
    }
  }
  
  // Initialize column pins as inputs with pull-ups
  for (int i = 0; i < config.cols; i++) {
    if (config.colPins[i] != -1) {
      pinMode(config.colPins[i], INPUT_PULLUP);
    }
  }
  
  // Initialize button states
  for (int i = 0; i < MAX_BUTTONS; i++) {
    buttonStates[i] = false;
    prevButtonStates[i] = false;
    buttonDebounceTime[i] = 0;
  }
}

void initializeEncoders() {
  // Encoder pin assignments from config.h
  const int ENCODER_A_PINS[MAX_ENCODERS] = {A0, A1, A2, A3, A4, A5, A6, A7};
  const int ENCODER_B_PINS[MAX_ENCODERS] = {14, 15, 16, 17, 18, 19, 20, 21};
  
  for (int i = 0; i < currentConfig.encoderCount; i++) {
    encoderPinA[i] = ENCODER_A_PINS[i];
    encoderPinB[i] = ENCODER_B_PINS[i];
    
    pinMode(encoderPinA[i], INPUT_PULLUP);
    pinMode(encoderPinB[i], INPUT_PULLUP);
    
    encoderLastState[i] = digitalRead(encoderPinA[i]);
    encoderEnabled[i] = true;
  }
  
  // Disable unused encoders
  for (int i = currentConfig.encoderCount; i < MAX_ENCODERS; i++) {
    encoderEnabled[i] = false;
  }
}

void scanButtons() {
  int configIndex = getMatrixConfigIndex(currentConfig.buttonCount);
  const MatrixConfig &config = matrixConfigs[configIndex];
  int buttonIndex = 0;
  
  for (int row = 0; row < config.rows; row++) {
    if (config.rowPins[row] == -1) continue;
    
    // Set current row low
    digitalWrite(config.rowPins[row], LOW);
    
    // Small delay to ensure signal settles
    delayMicroseconds(10);
    
    // Read all columns for this row
    for (int col = 0; col < config.cols; col++) {
      if (config.colPins[col] == -1) continue;
      if (buttonIndex >= currentConfig.buttonCount) break;
      
      bool currentState = !digitalRead(config.colPins[col]); // Inverted because of pull-up
      
      // Debounce logic
      if (currentState != buttonStates[buttonIndex]) {
        if (millis() - buttonDebounceTime[buttonIndex] > DEBOUNCE_DELAY) {
          buttonStates[buttonIndex] = currentState;
          buttonDebounceTime[buttonIndex] = millis();
          
          // Send button press event (only on press, not release)
          if (currentState && !prevButtonStates[buttonIndex]) {
            Serial.print("BTN:");
            Serial.println(buttonIndex + 1); // 1-indexed for user interface
            
            // Provide LED feedback for button press
#if RGB_LED_ENABLED
            onButtonPressed(buttonIndex);
#endif
          }
          
          prevButtonStates[buttonIndex] = currentState;
        }
      }
      buttonIndex++;
    }
    
    // Set row back to high
    digitalWrite(config.rowPins[row], HIGH);
  }
}

void scanEncoders() {
  for (int i = 0; i < currentConfig.encoderCount; i++) {
    if (encoderEnabled[i]) {
      int currentStateA = digitalRead(encoderPinA[i]);
      
      if (currentStateA != encoderLastState[i]) {
        int stateB = digitalRead(encoderPinB[i]);
        
        if (stateB != currentStateA) {
          // Clockwise rotation
          Serial.print("ENC:");
          Serial.print(i + 1); // 1-indexed
          Serial.println(":CW");
        } else {
          // Counter-clockwise rotation
          Serial.print("ENC:");
          Serial.print(i + 1); // 1-indexed
          Serial.println(":CCW");
        }
        
        encoderLastState[i] = currentStateA;
      }
    }
  }
}

// ========== RGB LED Functions ==========
#if RGB_LED_ENABLED

void initializeLEDs() {
  if (!currentConfig.ledEnabled) return;
  
  // Initialize NeoPixel strip
  strip.begin();
  strip.setBrightness(currentConfig.ledBrightness);
  
  // Initialize LED states with default color
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    ledStates[i].r = RGB_DEFAULT_R;
    ledStates[i].g = RGB_DEFAULT_G;
    ledStates[i].b = RGB_DEFAULT_B;
    ledStates[i].targetR = RGB_DEFAULT_R;
    ledStates[i].targetG = RGB_DEFAULT_G;
    ledStates[i].targetB = RGB_DEFAULT_B;
    ledStates[i].animating = false;
    ledStates[i].animationStart = 0;
    ledStates[i].animationDuration = 300;
    
    // Set initial LED color
    strip.setPixelColor(i, strip.Color(RGB_DEFAULT_R, RGB_DEFAULT_G, RGB_DEFAULT_B));
  }
  
  strip.show();
  Serial.println("LEDs initialized");
}

void updateLEDs() {
  if (!currentConfig.ledEnabled) return;
  
  unsigned long currentTime = millis();
  bool needsUpdate = false;
  
  // Handle LED effects with optimized timing
  if (currentEffect != EFFECT_NONE) {
    applyLEDEffect();
    needsUpdate = true;
  }
  
  // Update individual LED animations with optimized interpolation
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    if (ledStates[i].animating) {
      unsigned long elapsed = currentTime - ledStates[i].animationStart;
      
      if (elapsed >= ledStates[i].animationDuration) {
        // Animation complete
        ledStates[i].r = ledStates[i].targetR;
        ledStates[i].g = ledStates[i].targetG;
        ledStates[i].b = ledStates[i].targetB;
        ledStates[i].animating = false;
      } else {
        // Optimized interpolation using fixed-point arithmetic
        uint8_t progress = (elapsed * 255) / ledStates[i].animationDuration;
        
        #if OPTIMIZE_MEMORY
          ledStates[i].r = optimizedLerp(ledStates[i].r, ledStates[i].targetR, progress);
          ledStates[i].g = optimizedLerp(ledStates[i].g, ledStates[i].targetG, progress);
          ledStates[i].b = optimizedLerp(ledStates[i].b, ledStates[i].targetB, progress);
        #else
          float t = (float)elapsed / ledStates[i].animationDuration;
          ledStates[i].r = lerp(ledStates[i].r, ledStates[i].targetR, t);
          ledStates[i].g = lerp(ledStates[i].g, ledStates[i].targetG, t);
          ledStates[i].b = lerp(ledStates[i].b, ledStates[i].targetB, t);
        #endif
      }
      
      // Apply gamma correction if enabled and set pixel color
      #if OPTIMIZE_MEMORY
        strip.setPixelColor(i, strip.Color(
          applyGammaCorrection(ledStates[i].r),
          applyGammaCorrection(ledStates[i].g), 
          applyGammaCorrection(ledStates[i].b)
        ));
      #else
        strip.setPixelColor(i, strip.Color(ledStates[i].r, ledStates[i].g, ledStates[i].b));
      #endif
      
      needsUpdate = true;
    }
  }
  
  // Check power limits before updating
  #if ENABLE_POWER_LIMITING
    if (needsUpdate) {
      checkPowerLimits();
    }
  #endif
  
  // Update the LED strip if changes were made
  if (needsUpdate) {
    strip.show();
  }
}

void setLEDColor(int buttonId, uint8_t r, uint8_t g, uint8_t b, bool animate = true) {
  if (!currentConfig.ledEnabled || buttonId >= currentConfig.buttonCount) return;
  
  if (animate) {
    ledStates[buttonId].targetR = r;
    ledStates[buttonId].targetG = g;
    ledStates[buttonId].targetB = b;
    ledStates[buttonId].animating = true;
    ledStates[buttonId].animationStart = millis();
  } else {
    ledStates[buttonId].r = r;
    ledStates[buttonId].g = g;
    ledStates[buttonId].b = b;
    ledStates[buttonId].targetR = r;
    ledStates[buttonId].targetG = g;
    ledStates[buttonId].targetB = b;
    ledStates[buttonId].animating = false;
    strip.setPixelColor(buttonId, strip.Color(r, g, b));
    strip.show();
  }
}

void setAllLEDs(uint8_t r, uint8_t g, uint8_t b, bool animate = true) {
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    setLEDColor(i, r, g, b, animate);
  }
}

void clearAllLEDs() {
  currentEffect = EFFECT_NONE;
  setAllLEDs(0, 0, 0, false);
}

void setBrightness(uint8_t brightness) {
  if (!currentConfig.ledEnabled) return;
  
  // Apply thermal limiting if active
  if (thermalBrightness < 255) {
    brightness = (brightness * thermalBrightness) / 255;
  }
  
  globalBrightness = brightness;
  currentConfig.ledBrightness = brightness;
  strip.setBrightness(brightness);
  
  // Check power limits after brightness change
  #if ENABLE_POWER_LIMITING
    checkPowerLimits();
  #endif
  
  strip.show();
  
  Serial.print("LED brightness set to: ");
  Serial.println(brightness);
}

#if ENABLE_POWER_LIMITING
/**
 * Check power limits and reduce brightness if necessary
 */
void checkPowerLimits() {
  currentPowerUsage = calculateLEDPowerUsage();
  
  if (currentPowerUsage > MAX_USB_POWER) {
    // Calculate safe brightness level
    uint8_t safeBrightness = (MAX_USB_POWER * globalBrightness) / currentPowerUsage;
    
    if (safeBrightness < globalBrightness) {
      powerLimitingActive = true;
      strip.setBrightness(safeBrightness);
      strip.show();
      
      Serial.print("POWER:LIMITING:Active, reduced brightness to ");
      Serial.println(safeBrightness);
    }
  } else {
    if (powerLimitingActive) {
      powerLimitingActive = false;
      Serial.println("POWER:LIMITING:Inactive");
    }
  }
}

/**
 * Calculate estimated LED power usage in mA
 */
uint16_t calculateLEDPowerUsage() {
  uint32_t totalPower = 0;
  
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    // Calculate power for each LED based on current color values
    uint32_t ledPower = ledStates[i].r + ledStates[i].g + ledStates[i].b;
    
    // Apply brightness scaling
    ledPower = (ledPower * globalBrightness) / 255;
    
    totalPower += ledPower;
  }
  
  // Convert to mA (approximate calculation)
  return (totalPower * LED_CURRENT_PER_LEVEL) / 1000;
}
#endif

#if OPTIMIZE_MEMORY
/**
 * Apply gamma correction using program memory lookup table
 */
uint8_t applyGammaCorrection(uint8_t value) {
  return pgm_read_byte(&gamma8[value]);
}

/**
 * Optimized color interpolation for smooth animations
 */
uint8_t optimizedLerp(uint8_t start, uint8_t end, uint8_t t) {
  // Use fixed-point arithmetic to avoid floating point operations
  uint16_t result = start + (((uint16_t)(end - start) * t) >> 8);
  return (uint8_t)result;
}
#endif

void applyLEDEffect() {
  unsigned long currentTime = millis();
  unsigned long elapsed = currentTime - effectStart;
  
  switch (currentEffect) {
    case EFFECT_RAINBOW:
      applyRainbowEffect(elapsed);
      break;
    case EFFECT_BREATHE:
      applyBreatheEffect(elapsed);
      break;
    case EFFECT_WAVE:
      applyWaveEffect(elapsed);
      break;
    case EFFECT_PRESS_RIPPLE:
      applyPressRippleEffect(elapsed);
      break;
  }
}

void applyRainbowEffect(unsigned long elapsed) {
  // Optimized rainbow effect using fixed-point arithmetic
  uint16_t baseHue = (elapsed / (256 - effectSpeed * 20)) & 0xFF;
  
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    uint8_t pixelHue = baseHue + (i * 256 / currentConfig.buttonCount);
    uint32_t color = wheelOptimized(pixelHue);
    strip.setPixelColor(i, color);
  }
}

void applyBreatheEffect(unsigned long elapsed) {
  // Optimized breathing effect using lookup table for sine approximation
  static const uint8_t PROGMEM breathTable[] = {
    128, 131, 134, 137, 140, 143, 146, 149, 152, 155, 158, 162, 165, 167, 170, 173,
    176, 179, 182, 185, 188, 190, 193, 196, 198, 201, 203, 206, 208, 211, 213, 215,
    218, 220, 222, 224, 226, 228, 230, 232, 234, 235, 237, 238, 240, 241, 243, 244,
    245, 246, 248, 249, 250, 250, 251, 252, 253, 253, 254, 254, 254, 255, 255, 255,
    255, 255, 255, 255, 254, 254, 254, 253, 253, 252, 251, 250, 250, 249, 248, 246,
    245, 244, 243, 241, 240, 238, 237, 235, 234, 232, 230, 228, 226, 224, 222, 220,
    218, 215, 213, 211, 208, 206, 203, 201, 198, 196, 193, 190, 188, 185, 182, 179,
    176, 173, 170, 167, 165, 162, 158, 155, 152, 149, 146, 143, 140, 137, 134, 131,
    128, 124, 121, 118, 115, 112, 109, 106, 103, 100, 97, 93, 90, 88, 85, 82,
    79, 76, 73, 70, 67, 65, 62, 59, 57, 54, 52, 49, 47, 44, 42, 40,
    37, 35, 33, 31, 29, 27, 25, 23, 21, 20, 18, 17, 15, 14, 12, 11,
    10, 9, 7, 6, 5, 5, 4, 3, 2, 2, 1, 1, 1, 0, 0, 0,
    0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5, 5, 6, 7, 9,
    10, 11, 12, 14, 15, 17, 18, 20, 21, 23, 25, 27, 29, 31, 33, 35,
    37, 40, 42, 44, 47, 49, 52, 54, 57, 59, 62, 65, 67, 70, 73, 76,
    79, 82, 85, 88, 90, 93, 97, 100, 103, 106, 109, 112, 115, 118, 121, 124
  };
  
  uint8_t index = ((elapsed * effectSpeed) / 20) % 256;
  uint8_t brightness = pgm_read_byte(&breathTable[index]);
  
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    strip.setPixelColor(i, strip.Color(
      (RGB_DEFAULT_R * brightness) / 255,
      (RGB_DEFAULT_G * brightness) / 255,
      (RGB_DEFAULT_B * brightness) / 255
    ));
  }
}

void applyWaveEffect(unsigned long elapsed) {
  // Optimized wave effect
  uint8_t waveSpeed = effectSpeed * 2;
  
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    // Use simple sine approximation for performance
    uint8_t phase = ((elapsed * waveSpeed) / 20 + (i * 32)) & 0xFF;
    uint8_t brightness = (phase < 128) ? phase * 2 : (255 - phase) * 2;
    
    strip.setPixelColor(i, strip.Color(
      (RGB_DEFAULT_R * brightness) / 255,
      (RGB_DEFAULT_G * brightness) / 255,
      (RGB_DEFAULT_B * brightness) / 255
    ));
  }
}

void applyPressRippleEffect(unsigned long elapsed) {
  // Improved ripple effect that can be triggered by button presses
  uint16_t rippleDuration = 2000; // 2 second duration
  
  if (elapsed > rippleDuration) {
    currentEffect = EFFECT_NONE;
    return;
  }
  
  // Simple expanding circle effect from center
  uint8_t centerButton = currentConfig.buttonCount / 2;
  float progress = (float)elapsed / rippleDuration;
  uint8_t rippleRadius = progress * (currentConfig.buttonCount / 2);
  
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    int distance = abs(i - centerButton);
    
    if (distance <= rippleRadius && distance >= rippleRadius - 1) {
      // LED is at the ripple edge - bright color
      uint8_t intensity = 255 - (progress * 255);
      strip.setPixelColor(i, strip.Color(intensity, intensity / 2, 0));
    } else {
      // Fade to default
      strip.setPixelColor(i, strip.Color(RGB_DEFAULT_R / 4, RGB_DEFAULT_G / 4, RGB_DEFAULT_B / 4));
    }
  }
}

uint32_t wheelOptimized(byte wheelPos) {
  // Optimized color wheel function using fixed-point arithmetic
  wheelPos = 255 - wheelPos;
  if (wheelPos < 85) {
    return strip.Color(255 - wheelPos * 3, 0, wheelPos * 3);
  }
  if (wheelPos < 170) {
    wheelPos -= 85;
    return strip.Color(0, wheelPos * 3, 255 - wheelPos * 3);
  }
  wheelPos -= 170;
  return strip.Color(wheelPos * 3, 255 - wheelPos * 3, 0);
}

uint32_t wheel(byte wheelPos) {
  wheelPos = 255 - wheelPos;
  if (wheelPos < 85) {
    return strip.Color(255 - wheelPos * 3, 0, wheelPos * 3);
  }
  if (wheelPos < 170) {
    wheelPos -= 85;
    return strip.Color(0, wheelPos * 3, 255 - wheelPos * 3);
  }
  wheelPos -= 170;
  return strip.Color(wheelPos * 3, 255 - wheelPos * 3, 0);
}

uint8_t lerp(uint8_t start, uint8_t end, float t) {
  return start + (uint8_t)((end - start) * t);
}

void onButtonPressed(int buttonId) {
  // Visual feedback for button press
  setLEDColor(buttonId, RGB_PRESSED_R, RGB_PRESSED_G, RGB_PRESSED_B, false);
  
  // Restore default color after short delay
  delay(50); // Brief press indication
  setLEDColor(buttonId, RGB_DEFAULT_R, RGB_DEFAULT_G, RGB_DEFAULT_B, true);
}

void startLEDEffect(LEDEffect effect, uint8_t speed) {
  currentEffect = effect;
  effectSpeed = speed;
  effectStart = millis();
  effectStep = 0;
  
  Serial.print("LED effect started: ");
  Serial.println((int)effect);
}

#else
// Stub functions when LEDs are disabled
void initializeLEDs() {}
void updateLEDs() {}
void onButtonPressed(int buttonId) {}
#endif

// ========== End RGB LED Functions ==========

// Function to handle serial commands (for configuration or debugging)
void serialEvent() {
  while (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command.startsWith("CONFIG")) {
      // Handle configuration commands
      handleConfigCommand(command);
    } else if (command.startsWith("LED")) {
      // Handle LED commands
      handleLEDCommand(command);
    } else if (command == "STATUS") {
      // Send status information
      Serial.println("STATUS:OK");
      Serial.print("BUTTONS:");
      Serial.println(currentConfig.buttonCount);
      Serial.print("ENCODERS:");
      Serial.println(currentConfig.encoderCount);
      Serial.print("LEDS:");
      Serial.println(currentConfig.ledEnabled ? "Enabled" : "Disabled");
      Serial.print("BRIGHTNESS:");
      Serial.println(currentConfig.ledBrightness);
    } else if (command == "TEST") {
      // Test mode - simulate button presses
      testMode();
    }
  }
}

void handleConfigCommand(String command) {
  // Parse configuration commands
  // Format: CONFIG:BUTTONS:16, CONFIG:ENCODERS:2, CONFIG:SAVE, CONFIG:RESET
  
  if (command.startsWith("CONFIG:BUTTONS:")) {
    int count = command.substring(15).toInt();
    if (setButtonCount(count)) {
      Serial.print("CONFIG:BUTTONS:");
      Serial.println(currentConfig.buttonCount);
    } else {
      Serial.println("ERROR:Invalid button count. Valid: 8,12,16,24,32");
    }
  } 
  else if (command.startsWith("CONFIG:ENCODERS:")) {
    int count = command.substring(16).toInt();
    if (setEncoderCount(count)) {
      Serial.print("CONFIG:ENCODERS:");
      Serial.println(currentConfig.encoderCount);
    } else {
      Serial.print("ERROR:Invalid encoder count. Max: ");
      Serial.println(MAX_ENCODERS);
    }
  } 
  else if (command == "CONFIG:SAVE") {
    saveConfiguration();
    Serial.println("CONFIG:SAVED");
  } 
  else if (command == "CONFIG:RESET") {
    setDefaultConfiguration();
    saveConfiguration();
    initializeButtons();
    initializeEncoders();
    initializeLEDs();
    Serial.println("CONFIG:RESET");
  }
  else if (command == "CONFIG:GET") {
    Serial.print("CONFIG:BUTTONS:");
    Serial.println(currentConfig.buttonCount);
    Serial.print("CONFIG:ENCODERS:");
    Serial.println(currentConfig.encoderCount);
  }
  else {
    Serial.println("ERROR:Unknown config command");
  }
}

#if RGB_LED_ENABLED
void handleLEDCommand(String command) {
  // Enhanced LED command formats from requirements document:
  // LED:SET:<button_id>:<r>:<g>:<b> - Set specific button color (button_id is 1-indexed)
  // LED:BATCH:<count>:<data> - Set multiple buttons efficiently
  // LED:EFFECT:<effect_id>:<params> - Trigger lighting effect
  // LED:BRIGHTNESS:<level> - Global brightness 0-255
  // LED:POWER:<on|off> - LED power control
  // LED:STATUS - Get LED system status
  // LED:RESET - Reset all LEDs to default
  // 
  // Legacy compatibility:
  // LED:<button_id>:<r>:<g>:<b> - Set specific button color (backward compatibility)
  // LED:ALL:<r>:<g>:<b> - Set all buttons to same color
  // LED:CLEAR - Turn off all LEDs
  
  if (!command.startsWith("LED:")) {
    Serial.println("ERROR:LED:INVALID_COMMAND:Not an LED command");
    return;
  }
  
  if (!currentConfig.ledEnabled) {
    Serial.println("ERROR:LED:DISABLED:LEDs are disabled");
    return;
  }
  
  // Parse command structure
  int firstColon = command.indexOf(':', 4);
  if (firstColon == -1) {
    Serial.println("ERROR:LED:PARSE_ERROR:Invalid command format");
    return;
  }
  
  String subCommand = command.substring(4, firstColon);
  String params = (firstColon < command.length() - 1) ? command.substring(firstColon + 1) : "";
  
  // Handle new protocol commands
  if (subCommand == "SET") {
    handleLEDSetCommand(params);
  }
  else if (subCommand == "BATCH") {
    handleLEDBatchCommand(params);
  }
  else if (subCommand == "EFFECT") {
    handleLEDEffectCommand(params);
  }
  else if (subCommand == "BRIGHTNESS") {
    handleLEDBrightnessCommand(params);
  }
  else if (subCommand == "POWER") {
    handleLEDPowerCommand(params);
  }
  else if (subCommand == "STATUS") {
    handleLEDStatusCommand();
  }
  else if (subCommand == "RESET") {
    handleLEDResetCommand();
  }
  // Legacy compatibility commands
  else if (subCommand == "CLEAR") {
    clearAllLEDs();
    Serial.println("LED:ACK:CLEARED");
  }
  else if (subCommand == "ALL") {
    // Parse RGB values: ALL:R:G:B
    int r, g, b;
    if (parseRGBValues(params, r, g, b)) {
      setAllLEDs(r, g, b, true);
      Serial.print("LED:ACK:ALL:");
      Serial.print(r); Serial.print(":");
      Serial.print(g); Serial.print(":");
      Serial.println(b);
    } else {
      Serial.println("ERROR:LED:INVALID_RGB:Invalid RGB values");
    }
  }
  else {
    // Check if it's a direct button command (legacy format)
    int buttonId = subCommand.toInt();
    if (buttonId >= 1 && buttonId <= currentConfig.buttonCount) {
      int r, g, b;
      if (parseRGBValues(params, r, g, b)) {
        setLEDColor(buttonId - 1, r, g, b, true); // Convert to 0-indexed
        Serial.print("LED:ACK:");
        Serial.print(buttonId);
        Serial.print(":");
        Serial.print(r); Serial.print(":");
        Serial.print(g); Serial.print(":");
        Serial.println(b);
      } else {
        Serial.println("ERROR:LED:INVALID_RGB:Invalid RGB values");
      }
    } else {
      Serial.println("ERROR:LED:UNKNOWN_COMMAND:Unknown LED command");
    }
  }
}

void handleLEDSetCommand(String params) {
  // Format: SET:<button_id>:<r>:<g>:<b>
  int colonPos1 = params.indexOf(':');
  if (colonPos1 == -1) {
    Serial.println("ERROR:LED:SET:Missing button ID");
    return;
  }
  
  int buttonId = params.substring(0, colonPos1).toInt();
  if (buttonId < 1 || buttonId > currentConfig.buttonCount) {
    Serial.print("ERROR:LED:SET:Invalid button ID (1-");
    Serial.print(currentConfig.buttonCount);
    Serial.println(" allowed)");
    return;
  }
  
  String rgbParams = params.substring(colonPos1 + 1);
  int r, g, b;
  if (parseRGBValues(rgbParams, r, g, b)) {
    setLEDColor(buttonId - 1, r, g, b, true); // Convert to 0-indexed
    Serial.print("LED:ACK:SET:");
    Serial.print(buttonId);
    Serial.print(":");
    Serial.print(r); Serial.print(":");
    Serial.print(g); Serial.print(":");
    Serial.println(b);
  } else {
    Serial.println("ERROR:LED:SET:Invalid RGB values");
  }
}

void handleLEDBatchCommand(String params) {
  // Format: BATCH:<count>:<r1>:<g1>:<b1>:<r2>:<g2>:<b2>:...
  int colonPos = params.indexOf(':');
  if (colonPos == -1) {
    Serial.println("ERROR:LED:BATCH:Missing count parameter");
    return;
  }
  
  int count = params.substring(0, colonPos).toInt();
  if (count <= 0 || count > currentConfig.buttonCount) {
    Serial.println("ERROR:LED:BATCH:Invalid count parameter");
    return;
  }
  
  String dataParams = params.substring(colonPos + 1);
  
  // Count expected parameters (count * 3 for RGB values)
  int expectedParams = count * 3;
  int actualParams = 1; // Start with 1 for the first value
  for (int i = 0; i < dataParams.length(); i++) {
    if (dataParams.charAt(i) == ':') actualParams++;
  }
  
  if (actualParams != expectedParams) {
    Serial.print("ERROR:LED:BATCH:Expected ");
    Serial.print(expectedParams);
    Serial.print(" parameters, got ");
    Serial.println(actualParams);
    return;
  }
  
  // Parse and set colors in batch
  int paramIndex = 0;
  int buttonIndex = 0;
  
  while (buttonIndex < count && paramIndex < dataParams.length()) {
    // Find next three values (R, G, B)
    int r = 0, g = 0, b = 0;
    
    // Parse R value
    int nextColon = dataParams.indexOf(':', paramIndex);
    if (nextColon == -1 && buttonIndex == count - 1) nextColon = dataParams.length();
    if (nextColon == -1) break;
    
    r = dataParams.substring(paramIndex, nextColon).toInt();
    paramIndex = nextColon + 1;
    
    // Parse G value  
    nextColon = dataParams.indexOf(':', paramIndex);
    if (nextColon == -1 && buttonIndex == count - 1) nextColon = dataParams.length();
    if (nextColon == -1) break;
    
    g = dataParams.substring(paramIndex, nextColon).toInt();
    paramIndex = nextColon + 1;
    
    // Parse B value
    nextColon = dataParams.indexOf(':', paramIndex);
    if (nextColon == -1) nextColon = dataParams.length();
    
    b = dataParams.substring(paramIndex, nextColon).toInt();
    paramIndex = nextColon + 1;
    
    // Validate and set color
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      setLEDColor(buttonIndex, r, g, b, false); // No animation for batch operations
    }
    
    buttonIndex++;
  }
  
  // Update strip once after all changes
  strip.show();
  
  Serial.print("LED:ACK:BATCH:");
  Serial.println(count);
}

void handleLEDEffectCommand(String params) {
  // Format: EFFECT:<effect_name>:<speed>:<param1>:<param2>:...
  int colonPos = params.indexOf(':');
  if (colonPos == -1) {
    Serial.println("ERROR:LED:EFFECT:Missing effect name");
    return;
  }
  
  String effectName = params.substring(0, colonPos);
  String effectParams = params.substring(colonPos + 1);
  
  // Parse speed parameter
  int speedColonPos = effectParams.indexOf(':');
  int speed = 5; // Default speed
  
  if (speedColonPos > 0) {
    speed = effectParams.substring(0, speedColonPos).toInt();
  } else if (effectParams.length() > 0) {
    speed = effectParams.toInt();
  }
  
  if (speed < 1 || speed > 10) {
    Serial.println("ERROR:LED:EFFECT:Speed must be 1-10");
    return;
  }
  
  LEDEffect effect = EFFECT_NONE;
  if (effectName == "RAINBOW") effect = EFFECT_RAINBOW;
  else if (effectName == "BREATHE") effect = EFFECT_BREATHE;  
  else if (effectName == "WAVE") effect = EFFECT_WAVE;
  else if (effectName == "RIPPLE") effect = EFFECT_PRESS_RIPPLE;
  
  if (effect != EFFECT_NONE) {
    startLEDEffect(effect, speed);
    Serial.print("LED:ACK:EFFECT:");
    Serial.print(effectName);
    Serial.print(":");
    Serial.println(speed);
  } else {
    Serial.println("ERROR:LED:EFFECT:Unknown effect name");
  }
}

void handleLEDBrightnessCommand(String params) {
  int brightness = params.toInt();
  if (brightness >= 0 && brightness <= 255) {
    setBrightness(brightness);
    Serial.print("LED:ACK:BRIGHTNESS:");
    Serial.println(brightness);
  } else {
    Serial.println("ERROR:LED:BRIGHTNESS:Value must be 0-255");
  }
}

void handleLEDPowerCommand(String params) {
  if (params == "on" || params == "ON") {
    currentConfig.ledEnabled = true;
    initializeLEDs();
    Serial.println("LED:ACK:POWER:ON");
  } else if (params == "off" || params == "OFF") {
    clearAllLEDs();
    currentConfig.ledEnabled = false;
    Serial.println("LED:ACK:POWER:OFF");
  } else {
    Serial.println("ERROR:LED:POWER:Use 'on' or 'off'");
  }
}

void handleLEDStatusCommand() {
  Serial.println("LED:STATUS:BEGIN");
  Serial.print("LED:STATUS:ENABLED:");
  Serial.println(currentConfig.ledEnabled ? "true" : "false");
  Serial.print("LED:STATUS:BUTTON_COUNT:");
  Serial.println(currentConfig.buttonCount);
  Serial.print("LED:STATUS:BRIGHTNESS:");
  Serial.println(globalBrightness);
  Serial.print("LED:STATUS:CURRENT_EFFECT:");
  Serial.println((int)currentEffect);
  Serial.print("LED:STATUS:MEMORY_USAGE:");
  
  // Calculate approximate memory usage for LEDs
  int ledMemoryUsage = (currentConfig.buttonCount * sizeof(LEDState)) + 
                       (RGB_LED_COUNT * 3) + // Color buffer
                       64; // Effect state overhead
  Serial.println(ledMemoryUsage);
  
  Serial.println("LED:STATUS:END");
}

void handleLEDResetCommand() {
  // Reset all LEDs to default state
  currentEffect = EFFECT_NONE;
  effectSpeed = 5;
  effectStart = 0;
  effectStep = 0;
  
  // Reset all LED states to default colors
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    ledStates[i].r = RGB_DEFAULT_R;
    ledStates[i].g = RGB_DEFAULT_G;
    ledStates[i].b = RGB_DEFAULT_B;
    ledStates[i].targetR = RGB_DEFAULT_R;
    ledStates[i].targetG = RGB_DEFAULT_G;
    ledStates[i].targetB = RGB_DEFAULT_B;
    ledStates[i].animating = false;
    ledStates[i].animationStart = 0;
    ledStates[i].animationDuration = 300;
    
    strip.setPixelColor(i, strip.Color(RGB_DEFAULT_R, RGB_DEFAULT_G, RGB_DEFAULT_B));
  }
  
  strip.show();
  Serial.println("LED:ACK:RESET");
}

bool parseRGBValues(String rgbString, int &r, int &g, int &b) {
  int firstColon = rgbString.indexOf(':');
  int secondColon = rgbString.indexOf(':', firstColon + 1);
  
  if (firstColon == -1 || secondColon == -1) return false;
  
  r = rgbString.substring(0, firstColon).toInt();
  g = rgbString.substring(firstColon + 1, secondColon).toInt();
  b = rgbString.substring(secondColon + 1).toInt();
  
  return (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255);
}
#else
void handleLEDCommand(String command) {
  Serial.println("ERROR:LED support not compiled");
}
#endif

void testMode() {
  Serial.println("TEST:Starting test mode...");
  
  // Test all buttons
  for (int i = 1; i <= currentConfig.buttonCount; i++) {
    Serial.print("BTN:");
    Serial.println(i);
    delay(500);
  }
  
  // Test all encoders
  for (int i = 1; i <= currentConfig.encoderCount; i++) {
    Serial.print("ENC:");
    Serial.print(i);
    Serial.println(":CW");
    delay(500);
    
    Serial.print("ENC:");
    Serial.print(i);
    Serial.println(":CCW");
    delay(500);
  }
  
  Serial.println("TEST:Complete");
}