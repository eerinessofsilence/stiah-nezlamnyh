const assert = require('node:assert/strict');
const { test } = require('node:test');
const { acceptLiveSpeech, createLiveVoiceGate, liveVoiceThreshold, speechThreshold, voiceInputLevel } = require('../src/assistant-voice-level.ts');

test('the orb ignores background noise and increases with speech volume up to its visual limit', () => {
  assert.equal(voiceInputLevel(0), 0);
  assert.equal(voiceInputLevel(speechThreshold), 0);
  assert.equal(voiceInputLevel(speechThreshold + 0.06), 0.5);
  assert.equal(voiceInputLevel(1), 1);
});

test('the microphone learns steady room noise while waiting for the user', () => {
  const gate = createLiveVoiceGate();
  for (let frame = 0; frame < 80; frame++) {
    assert.equal(acceptLiveSpeech(gate, 0.021, 50, 'listening'), false);
  }
  assert.ok(liveVoiceThreshold(gate, 'listening') > 0.035);
  assert.equal(voiceInputLevel(0.03, liveVoiceThreshold(gate, 'listening')), 0);
  for (const level of [0.06, 0.054, 0.047, 0.008, 0.052, 0.044]) {
    assert.equal(acceptLiveSpeech(gate, level, 50, 'listening'), false);
  }
  assert.equal(acceptLiveSpeech(gate, 0.049, 50, 'listening'), true);
  assert.equal(acceptLiveSpeech(gate, 0.033, 50, 'continuing'), true);
});

test('background voices and short loud sounds do not cut off a reply', () => {
  const gate = createLiveVoiceGate();
  for (let frame = 0; frame < 18; frame++) {
    assert.equal(acceptLiveSpeech(gate, 0.064, 50, 'interrupting'), false);
  }
  for (const level of [0.17, 0.19, 0.006, 0.011, 0.13, 0.006, 0.012]) {
    assert.equal(acceptLiveSpeech(gate, level, 50, 'interrupting'), false);
  }
  assert.equal(gate.noiseFloor, 0);
  for (let frame = 0; frame < 7; frame++) {
    assert.equal(acceptLiveSpeech(gate, 0.11, 50, 'interrupting'), false);
  }
  assert.equal(acceptLiveSpeech(gate, 0.11, 50, 'interrupting'), true);
});

test('speech detected during a reply does not carry over when playback ends', () => {
  const gate = createLiveVoiceGate();
  assert.equal(acceptLiveSpeech(gate, 0.09, 300, 'interrupting'), false);
  assert.equal(acceptLiveSpeech(gate, 0.05, 50, 'listening'), false);
  assert.equal(gate.speechMs, 50);
});
