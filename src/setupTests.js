import '@testing-library/jest-dom';
import { vi } from 'vitest';

HTMLCanvasElement.prototype.getContext = () => ({
  fillStyle: '',
  fillRect: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  roundRect: vi.fn(),
  fill: vi.fn()
});
