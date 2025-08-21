# Arduino Firmware for Macro Keyboard

This directory contains the Arduino firmware for the macro keyboard hardware.

## Supported Hardware

The firmware supports various button configurations:
- 8 buttons (2x4 matrix)
- 12 buttons (3x4 matrix) 
- 16 buttons (4x4 matrix)
- 24 buttons (4x6 matrix)
- 32 buttons (4x8 matrix)

Plus up to 8 rotary encoders.

## Configuration

The firmware now supports **runtime configuration** through the host application's UI! You no longer need to reflash firmware to change your hardware configuration.

### Runtime Configuration (Recommended)

Configure your hardware through the host application:

1. Connect your Arduino to your computer
2. Open the Macro Keyboard application  
3. Go to the Hardware Configuration section
4. Select your button count (8, 12, 16, 24, or 32)
5. Set encoder count (0-8)
6. Click "Apply Configuration"

The settings are automatically saved to the Arduino's EEPROM and persist between power cycles.

### Manual Configuration (Legacy)

If you prefer to set the configuration at compile time, you can still modify `config.h`:

1. Open `config.h` in the Arduino IDE
2. Uncomment the line for your button configuration:
   ```cpp
   #define BUTTONS_8    // For 8 buttons
   #define BUTTONS_12   // For 12 buttons
   #define BUTTONS_16   // For 16 buttons
   #define BUTTONS_24   // For 24 buttons
   #define BUTTONS_32   // For 32 buttons
   ```

3. Set the number of encoders:
   ```cpp
   #define ENCODER_COUNT 2  // Set to 0-8 based on your hardware
   ```

4. Verify the pin assignments match your wiring

## Pin Assignments

### Default Pin Assignments by Configuration

**8 Buttons (2x4 matrix):**
- Row pins: 2, 3
- Column pins: 4, 5, 6, 7

**12 Buttons (3x4 matrix):**
- Row pins: 2, 3, 4
- Column pins: 5, 6, 7, 8

**16 Buttons (4x4 matrix):**
- Row pins: 2, 3, 4, 5
- Column pins: 6, 7, 8, 9

**24 Buttons (4x6 matrix):**
- Row pins: 2, 3, 4, 5
- Column pins: 6, 7, 8, 9, 10, 11

**32 Buttons (4x8 matrix):**
- Row pins: 2, 3, 4, 5
- Column pins: 6, 7, 8, 9, 10, 11, 12, 13

**Rotary Encoders:**
- Encoder A pins: A0-A7
- Encoder B pins: 14-21

## Wiring

### Button Matrix Wiring

Connect buttons in a matrix configuration:
1. Connect one terminal of each button in a row to the corresponding row pin
2. Connect the other terminal of each button in a column to the corresponding column pin
3. Add diodes (1N4148) in series with each button to prevent ghosting

### Encoder Wiring

For each rotary encoder:
1. Connect the A channel to the designated A pin (A0-A7)
2. Connect the B channel to the designated B pin (14-21)
3. Connect the common pin to ground
4. Optional: Add 10kΩ pull-up resistors on A and B channels

## Communication Protocol

The firmware communicates with the host application via serial at 9600 baud:

### Output Messages

**Button Press:**
```
BTN:<button_id>
```
Example: `BTN:1` (Button 1 was pressed)

**Encoder Rotation:**
```
ENC:<encoder_id>:<direction>
```
Examples:
- `ENC:1:CW` (Encoder 1 rotated clockwise)
- `ENC:2:CCW` (Encoder 2 rotated counter-clockwise)

### Input Commands

**Configuration Commands:**
```
CONFIG:BUTTONS:<count>  // Set button count (8, 12, 16, 24, or 32)
CONFIG:ENCODERS:<count> // Set encoder count (0-8)  
CONFIG:SAVE             // Save configuration to EEPROM
CONFIG:RESET            // Reset to default configuration
CONFIG:GET              // Get current configuration
```

**Status Request:**
```
STATUS
```
Response includes current configuration

**Test Mode:**
```
TEST
```
Simulates all button presses and encoder rotations

## Installation

1. Install Arduino IDE
2. Connect your Arduino Micro via USB
3. Open `macro-keyboard-firmware.ino` in Arduino IDE
4. Select the correct board: Tools → Board → Arduino Micro
5. Select the correct port: Tools → Port → (your Arduino port)
6. Upload the firmware: Sketch → Upload
7. Configure hardware through the host application UI (no reflashing needed!)

## Troubleshooting

**No serial output:**
- Check baud rate (should be 9600)
- Verify USB connection
- Ensure Arduino Micro is properly enumerated

**Button presses not detected:**
- Check wiring connections
- Verify pin assignments in config.h
- Test with multimeter for continuity

**Encoder not working:**
- Verify A and B channel connections
- Check for proper grounding
- Ensure encoder is mechanically functioning

**Matrix ghosting (multiple buttons triggered):**
- Add diodes (1N4148) in series with each button
- Verify no short circuits in wiring

**Configuration not saving:**
- Ensure Arduino has EEPROM support (most models do)
- Send CONFIG:SAVE command after changing settings
- Check serial output for error messages

**Wrong button/encoder count after restart:**
- Configuration is stored in EEPROM and should persist
- Use CONFIG:GET to check current settings
- Use CONFIG:RESET to restore defaults if needed