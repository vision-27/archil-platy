import test from 'node:test';
import assert from 'node:assert/strict';
import { validateModelEvents } from '../src/model.mjs';
const completed = { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5, unrelated: 'private' } };
test('intentional disabled execution host warning is not misclassified as a tool call', () => {
  const result = validateModelEvents([{ type: 'item.completed', item: { type: 'error', message: 'Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`.' } }, completed]);
  assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 5 }); assert.equal(result.warnings.length, 1);
});
test('model completion cannot hide tool calls, unknown diagnostics, or failed/incomplete turns', () => {
  for (const type of ['command_execution','mcp_tool_call','web_search','unknown/type']) assert.throws(() => validateModelEvents([{ type: 'item.completed', item: { type } }, completed]), e => e.code === 'model_tool_attempt');
  assert.throws(() => validateModelEvents([{ type: 'item.completed', item: { type: 'error', message: 'Some other failure' } }, completed]), e => e.code === 'model_diagnostic');
  assert.throws(() => validateModelEvents([{ type: 'turn.failed' }, completed]), e => e.code === 'model_failed');
  assert.throws(() => validateModelEvents([]), e => e.code === 'model_incomplete');
});
