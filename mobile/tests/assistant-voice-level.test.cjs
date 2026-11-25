const assert = require('node:assert/strict');
const { test } = require('node:test');
const { speechThreshold, voiceInputLevel } = require('../src/assistant-voice-level.ts');

test('the orb ignores background noise and increases with speech volume up to its visual limit', () => {
  assert.equal(voiceInputLevel(0), 0);
  assert.equal(voiceInputLevel(speechThreshold), 0);
  assert.equal(voiceInputLevel(speechThreshold + 0.06), 0.5);
  assert.equal(voiceInputLevel(1), 1);
});
