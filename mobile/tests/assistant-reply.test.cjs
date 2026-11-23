const assert = require('node:assert/strict');
const { test } = require('node:test');
const { replyPresentation } = require('../src/assistant-reply.ts');

test('assistant reveals a reply with one effect and respects the reader’s position', () => {
  assert.equal(replyPresentation(120, 100, 500, true, false), 'fade');
  assert.equal(replyPresentation(500, 100, 500, true, false), 'scroll');
  assert.equal(replyPresentation(80, 100, 500, true, false), 'scroll');
  assert.equal(replyPresentation(500, 100, 500, false, false), 'show');
  assert.equal(replyPresentation(120, 100, 500, true, true), 'show');
  assert.equal(replyPresentation(500, 100, 500, true, true), 'jump');
  assert.equal(replyPresentation(500, 100, 100, true, false), 'show');
});
