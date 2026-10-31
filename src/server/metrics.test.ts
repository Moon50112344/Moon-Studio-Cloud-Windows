import test from 'node:test';
import assert from 'node:assert/strict';
import { vmMetricsCollector } from './metrics';

test('VmMetricsCollector returns valid structure and non-empty history', () => {
  const metrics = vmMetricsCollector.getMetrics();

  assert.equal(metrics.success, true);
  assert.ok(typeof metrics.cpuPercent === 'number');
  assert.ok(metrics.cpuPercent >= 0 && metrics.cpuPercent <= 100);
  assert.ok(typeof metrics.memoryMb === 'number');
  assert.ok(typeof metrics.totalMemoryMb === 'number');
  assert.ok(typeof metrics.memoryPercent === 'number');
  assert.ok(metrics.memoryPercent >= 0 && metrics.memoryPercent <= 100);
  assert.ok(typeof metrics.cores === 'number');
  assert.ok(metrics.cores >= 1);
  assert.ok(Array.isArray(metrics.history));
  assert.ok(metrics.history.length > 0);

  const sample = metrics.history[0];
  assert.ok(typeof sample.time === 'string');
  assert.ok(typeof sample.cpu === 'number');
  assert.ok(typeof sample.memory === 'number');
});

test('VmMetricsCollector handles specified vmId properly', () => {
  const metrics = vmMetricsCollector.getMetrics('vm-custom-test');
  assert.equal(metrics.success, true);
  assert.equal(metrics.vmId, 'vm-custom-test');
  assert.ok(metrics.history.length > 0);
});
