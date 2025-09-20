// Mock robotjs for testing

module.exports = {
  keyTap: jest.fn(),
  keyToggle: jest.fn((key, down) => {}),
  typeString: jest.fn((text) => {}),
  typeStringDelayed: jest.fn((text, delay) => {}),
  mouseClick: jest.fn((button, double) => {}),
  mouseDrag: jest.fn((x, y) => {}),
  moveMouse: jest.fn((x, y) => {}),
  moveMouseSmooth: jest.fn((x, y) => {}),
  mouseToggle: jest.fn((down, button) => {}),
  scrollMouse: jest.fn((x, y) => {}),
  getMousePos: jest.fn(() => ({ x: 100, y: 100 })),
  getPixelColor: jest.fn(() => 'ffffff'),
  getScreenSize: jest.fn(() => ({ width: 1920, height: 1080 })),
  captureScreen: jest.fn(() => ({
    width: 1920,
    height: 1080,
    colorAt: jest.fn(() => 'ffffff')
  })),
  screen: {
    capture: jest.fn(() => ({
      width: 1920,
      height: 1080,
      colorAt: jest.fn(() => 'ffffff')
    }))
  },
  bitmap: {
    colorAt: jest.fn(() => 'ffffff')
  }
};