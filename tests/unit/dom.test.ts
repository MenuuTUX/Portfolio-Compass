import { describe, it, expect } from 'bun:test';

describe('DOM Environment', () => {
  it('should have access to window', () => {
    expect(typeof window).toBe('object');
  });

  it('should have access to document', () => {
    expect(typeof document).toBe('object');
  });

  it('should create an element', () => {
    const div = document.createElement('div');
    div.innerHTML = 'Hello World';
    document.body.appendChild(div);
    expect(document.body.innerHTML).toBe('<div>Hello World</div>');
  });
});
