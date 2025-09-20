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
  
  // Create NeoPixel strip object
  Adafruit_NeoPixel strip(RGB_LED_COUNT, RGB_LED_PIN, NEO_GRB + NEO_KHZ800);
  
  // LED state tracking
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
  
  // LED effect variables
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
  
  // Handle LED effects
  if (currentEffect != EFFECT_NONE) {
    applyLEDEffect();
    needsUpdate = true;
  }
  
  // Update individual LED animations
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
        // Interpolate colors
        float progress = (float)elapsed / ledStates[i].animationDuration;
        ledStates[i].r = lerp(ledStates[i].r, ledStates[i].targetR, progress);
        ledStates[i].g = lerp(ledStates[i].g, ledStates[i].targetG, progress);
        ledStates[i].b = lerp(ledStates[i].b, ledStates[i].targetB, progress);
      }
      
      strip.setPixelColor(i, strip.Color(ledStates[i].r, ledStates[i].g, ledStates[i].b));
      needsUpdate = true;
    }
  }
  
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
  
  globalBrightness = brightness;
  currentConfig.ledBrightness = brightness;
  strip.setBrightness(brightness);
  strip.show();
  
  Serial.print("LED brightness set to: ");
  Serial.println(brightness);
}

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
  uint8_t hue = (elapsed / (256 - effectSpeed * 25)) % 256;
  
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    uint32_t color = wheel((hue + i * 256 / currentConfig.buttonCount) & 255);
    strip.setPixelColor(i, color);
  }
}

void applyBreatheEffect(unsigned long elapsed) {
  float breath = (sin((elapsed * effectSpeed) / 1000.0) + 1.0) / 2.0;
  uint8_t brightness = (uint8_t)(breath * 255);
  
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    strip.setPixelColor(i, strip.Color(
      (RGB_DEFAULT_R * brightness) / 255,
      (RGB_DEFAULT_G * brightness) / 255,
      (RGB_DEFAULT_B * brightness) / 255
    ));
  }
}

void applyWaveEffect(unsigned long elapsed) {
  for (int i = 0; i < currentConfig.buttonCount; i++) {
    float wave = sin((elapsed * effectSpeed / 1000.0) + (i * 0.5)) * 0.5 + 0.5;
    uint8_t brightness = (uint8_t)(wave * 255);
    
    strip.setPixelColor(i, strip.Color(
      (RGB_DEFAULT_R * brightness) / 255,
      (RGB_DEFAULT_G * brightness) / 255,
      (RGB_DEFAULT_B * brightness) / 255
    ));
  }
}

void applyPressRippleEffect(unsigned long elapsed) {
  // This effect is triggered by button presses - placeholder for now
  if (elapsed > 2000) { // Effect duration
    currentEffect = EFFECT_NONE;
  }
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
  // LED command formats:
  // LED:<button_id>:<r>:<g>:<b> - Set specific button color (button_id is 1-indexed)
  // LED:ALL:<r>:<g>:<b> - Set all buttons to same color
  // LED:CLEAR - Turn off all LEDs
  // LED:EFFECT:<effect_name>:<speed> - Start LED effect
  // LED:BRIGHTNESS:<0-255> - Set overall brightness
  
  if (command.startsWith("LED:") && currentConfig.ledEnabled) {
    int firstColon = command.indexOf(':', 4);
    if (firstColon == -1) {
      Serial.println("ERROR:Invalid LED command format");
      return;
    }
    
    String subCommand = command.substring(4, firstColon);
    String params = command.substring(firstColon + 1);
    
    if (subCommand == "CLEAR") {
      clearAllLEDs();
      Serial.println("LED:CLEARED");
    }
    else if (subCommand == "BRIGHTNESS") {
      int brightness = params.toInt();
      if (brightness >= 0 && brightness <= 255) {
        setBrightness(brightness);
        Serial.print("LED:BRIGHTNESS:");
        Serial.println(brightness);
      } else {
        Serial.println("ERROR:Brightness must be 0-255");
      }
    }
    else if (subCommand == "ALL") {
      // Parse RGB values: ALL:R:G:B
      int r, g, b;
      if (parseRGBValues(params, r, g, b)) {
        setAllLEDs(r, g, b, true);
        Serial.print("LED:ALL:");
        Serial.print(r); Serial.print(":");
        Serial.print(g); Serial.print(":");
        Serial.println(b);
      } else {
        Serial.println("ERROR:Invalid RGB values");
      }
    }
    else if (subCommand == "EFFECT") {
      // Parse effect: EFFECT:name:speed
      int colonPos = params.indexOf(':');
      if (colonPos > 0) {
        String effectName = params.substring(0, colonPos);
        int speed = params.substring(colonPos + 1).toInt();
        
        LEDEffect effect = EFFECT_NONE;
        if (effectName == "RAINBOW") effect = EFFECT_RAINBOW;
        else if (effectName == "BREATHE") effect = EFFECT_BREATHE;
        else if (effectName == "WAVE") effect = EFFECT_WAVE;
        else if (effectName == "RIPPLE") effect = EFFECT_PRESS_RIPPLE;
        
        if (effect != EFFECT_NONE && speed >= 1 && speed <= 10) {
          startLEDEffect(effect, speed);
          Serial.print("LED:EFFECT:");
          Serial.print(effectName);
          Serial.print(":");
          Serial.println(speed);
        } else {
          Serial.println("ERROR:Invalid effect name or speed (1-10)");
        }
      } else {
        Serial.println("ERROR:Invalid effect command format");
      }
    }
    else {
      // Individual button: <button_id>:R:G:B
      int buttonId = subCommand.toInt();
      if (buttonId >= 1 && buttonId <= currentConfig.buttonCount) {
        int r, g, b;
        if (parseRGBValues(params, r, g, b)) {
          setLEDColor(buttonId - 1, r, g, b, true); // Convert to 0-indexed
          Serial.print("LED:");
          Serial.print(buttonId);
          Serial.print(":");
          Serial.print(r); Serial.print(":");
          Serial.print(g); Serial.print(":");
          Serial.println(b);
        } else {
          Serial.println("ERROR:Invalid RGB values");
        }
      } else {
        Serial.println("ERROR:Invalid button ID");
      }
    }
  } else if (!currentConfig.ledEnabled) {
    Serial.println("ERROR:LEDs are disabled");
  } else {
    Serial.println("ERROR:Invalid LED command");
  }
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