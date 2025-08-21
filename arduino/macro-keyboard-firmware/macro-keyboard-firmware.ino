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
  
  Author: Jenna Massardo
  License: MIT
*/

#include "config.h"

// Button matrix variables
bool buttonStates[MAX_BUTTONS];
bool prevButtonStates[MAX_BUTTONS];
unsigned long buttonDebounceTime[MAX_BUTTONS];

// Encoder variables
int encoderPinA[MAX_ENCODERS];
int encoderPinB[MAX_ENCODERS];
int encoderLastState[MAX_ENCODERS];
bool encoderEnabled[MAX_ENCODERS];

// Timing variables
unsigned long lastScanTime = 0;
const unsigned long SCAN_INTERVAL = 10; // ms
const unsigned long DEBOUNCE_DELAY = 50; // ms

void setup() {
  Serial.begin(BAUD_RATE);
  
  // Initialize button matrix
  initializeButtons();
  
  // Initialize encoders
  initializeEncoders();
  
  Serial.println("Macro Keyboard Ready");
  Serial.print("Buttons: ");
  Serial.println(BUTTON_COUNT);
  Serial.print("Encoders: ");
  Serial.println(ENCODER_COUNT);
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
  // Initialize row pins as outputs
  for (int i = 0; i < MATRIX_ROWS; i++) {
    pinMode(rowPins[i], OUTPUT);
    digitalWrite(rowPins[i], HIGH);
  }
  
  // Initialize column pins as inputs with pull-ups
  for (int i = 0; i < MATRIX_COLS; i++) {
    pinMode(colPins[i], INPUT_PULLUP);
  }
  
  // Initialize button states
  for (int i = 0; i < MAX_BUTTONS; i++) {
    buttonStates[i] = false;
    prevButtonStates[i] = false;
    buttonDebounceTime[i] = 0;
  }
}

void initializeEncoders() {
  for (int i = 0; i < ENCODER_COUNT; i++) {
    encoderPinA[i] = ENCODER_A_PINS[i];
    encoderPinB[i] = ENCODER_B_PINS[i];
    
    pinMode(encoderPinA[i], INPUT_PULLUP);
    pinMode(encoderPinB[i], INPUT_PULLUP);
    
    encoderLastState[i] = digitalRead(encoderPinA[i]);
    encoderEnabled[i] = true;
  }
}

void scanButtons() {
  int buttonIndex = 0;
  
  for (int row = 0; row < MATRIX_ROWS; row++) {
    // Set current row low
    digitalWrite(rowPins[row], LOW);
    
    // Small delay to ensure signal settles
    delayMicroseconds(10);
    
    // Read all columns for this row
    for (int col = 0; col < MATRIX_COLS; col++) {
      if (buttonIndex < BUTTON_COUNT) {
        bool currentState = !digitalRead(colPins[col]); // Inverted because of pull-up
        
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
    }
    
    // Set row back to high
    digitalWrite(rowPins[row], HIGH);
  }
}

void scanEncoders() {
  for (int i = 0; i < ENCODER_COUNT; i++) {
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
      Serial.println(BUTTON_COUNT);
      Serial.print("ENCODERS:");
      Serial.println(ENCODER_COUNT);
    } else if (command == "TEST") {
      // Test mode - simulate button presses
      testMode();
    }
  }
}

void handleConfigCommand(String command) {
  // Parse configuration commands
  // Format: CONFIG:BUTTON_COUNT:8 or CONFIG:ENCODER_COUNT:2
  int firstColon = command.indexOf(':', 7); // Skip "CONFIG:"
  int secondColon = command.indexOf(':', firstColon + 1);
  
  if (firstColon != -1 && secondColon != -1) {
    String param = command.substring(7, firstColon);
    String value = command.substring(secondColon + 1);
    
    if (param == "BUTTON_COUNT") {
      int newButtonCount = value.toInt();
      if (newButtonCount <= MAX_BUTTONS) {
        // Note: This would require recompiling with new config
        Serial.print("CONFIG:BUTTON_COUNT:");
        Serial.println(BUTTON_COUNT);
      }
    } else if (param == "ENCODER_COUNT") {
      int newEncoderCount = value.toInt();
      if (newEncoderCount <= MAX_ENCODERS) {
        Serial.print("CONFIG:ENCODER_COUNT:");
        Serial.println(ENCODER_COUNT);
      }
    }
  }
}

void testMode() {
  Serial.println("TEST:Starting test mode...");
  
  // Test all buttons
  for (int i = 1; i <= BUTTON_COUNT; i++) {
    Serial.print("BTN:");
    Serial.println(i);
    delay(500);
  }
  
  // Test all encoders
  for (int i = 1; i <= ENCODER_COUNT; i++) {
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