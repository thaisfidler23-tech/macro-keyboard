/*
  Macro Keyboard Firmware
  
  This firmware supports configurable button matrices and rotary encoders.
  It communicates with the host application via serial communication.
  
  Supported configurations:
  - 8, 12, 16, 24, or 32 buttons in matrix layout
  - Up to 8 rotary encoders
  
  Communication protocol:
  - Button press: "BTN:<button_id>"
  - Encoder rotation: "ENC:<encoder_id>:<direction>"
    where direction is "CW" (clockwise) or "CCW" (counter-clockwise)
  - Configuration: "CONFIG:BUTTONS:<count>" or "CONFIG:ENCODERS:<count>"
  
  Author: Jenna Massardo
  License: MIT
*/

#include "config.h"
#include <EEPROM.h>

// Configuration structure for EEPROM storage
struct DeviceConfig {
  uint8_t buttonCount;
  uint8_t encoderCount;
  uint8_t matrixRows;
  uint8_t matrixCols;
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
  
  Serial.println("Macro Keyboard Ready");
  Serial.print("Buttons: ");
  Serial.println(currentConfig.buttonCount);
  Serial.print("Encoders: ");
  Serial.println(currentConfig.encoderCount);
}

void loop() {
  unsigned long currentTime = millis();
  
  if (currentTime - lastScanTime >= SCAN_INTERVAL) {
    scanButtons();
    scanEncoders();
    lastScanTime = currentTime;
  }
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

// Function to handle serial commands (for configuration or debugging)
void serialEvent() {
  while (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command.startsWith("CONFIG")) {
      // Handle configuration commands
      handleConfigCommand(command);
    } else if (command == "STATUS") {
      // Send status information
      Serial.println("STATUS:OK");
      Serial.print("BUTTONS:");
      Serial.println(currentConfig.buttonCount);
      Serial.print("ENCODERS:");
      Serial.println(currentConfig.encoderCount);
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