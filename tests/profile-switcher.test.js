const ProfileSwitcher = require('../src/ProfileSwitcher');
const EventEmitter = require('events');

// Mock ProfileManager
class MockProfileManager extends EventEmitter {
  constructor() {
    super();
    this.profiles = new Map();
    this.profiles.set('default', { id: 'default', name: 'Default Profile' });
    this.profiles.set('work', { id: 'work', name: 'Work Profile' });
    this.profiles.set('gaming', { id: 'gaming', name: 'Gaming Profile' });
    this.activeProfile = 'default';
  }

  getActiveProfileName() {
    return this.activeProfile;
  }

  getProfiles() {
    const profilesObject = {};
    this.profiles.forEach((profile, name) => {
      profilesObject[name] = profile;
    });
    return profilesObject;
  }

  activateProfile(profileName) {
    return new Promise((resolve, reject) => {
      if (this.profiles.has(profileName)) {
        this.activeProfile = profileName;
        this.emit('profile-activated', { name: profileName });
        resolve({ success: true, profileName });
      } else {
        reject(new Error(`Profile not found: ${profileName}`));
      }
    });
  }
}

describe('ProfileSwitcher', () => {
  let profileSwitcher;
  let mockProfileManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileManager = new MockProfileManager();
    profileSwitcher = new ProfileSwitcher(mockProfileManager);
  });

  afterEach(() => {
    if (profileSwitcher) {
      profileSwitcher.disableAutomaticSwitching();
    }
  });

  test('should initialize with ProfileManager', () => {
    expect(profileSwitcher).toBeInstanceOf(EventEmitter);
    expect(profileSwitcher.isAutomaticSwitchingEnabled()).toBe(true);
  });

  test('should enable and disable automatic switching', () => {
    profileSwitcher.disableAutomaticSwitching();
    expect(profileSwitcher.isAutomaticSwitchingEnabled()).toBe(false);
    
    profileSwitcher.enableAutomaticSwitching();
    expect(profileSwitcher.isAutomaticSwitchingEnabled()).toBe(true);
  });

  test('should switch to profile', async () => {
    const result = await profileSwitcher.switchToProfile('work', 'context-rule', 10);
    console.log('Switch result:', result);
    expect(result.success).toBe(true);
  });

  test('should handle non-existent profile', async () => {
    const result = await profileSwitcher.switchToProfile('nonexistent');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('profile_not_found');
  });

  test('should track statistics', () => {
    const stats = profileSwitcher.getStatistics();
    expect(stats).toHaveProperty('totalSwitches');
    expect(stats).toHaveProperty('suggestions');
    expect(stats).toHaveProperty('uptime');
  });

  test('should handle context changes', async () => {
    const mockContext = { recommendedProfile: 'work' };
    await profileSwitcher.handleContextChange(mockContext);
    // Should switch to work profile
  });

  test('should analyze profile compatibility', () => {
    const compatibility = profileSwitcher.analyzeProfileCompatibility('work', 'gaming');
    expect(compatibility).toHaveProperty('compatibility');
    expect(compatibility).toHaveProperty('conflicts');
    expect(compatibility).toHaveProperty('recommendations');
  });

  test('should confirm current profile', async () => {
    await profileSwitcher.confirmCurrentProfile();
    // Should not throw errors
  });

  test('should require ProfileManager', () => {
    expect(() => new ProfileSwitcher()).toThrow('ProfileManager instance required');
  });
});