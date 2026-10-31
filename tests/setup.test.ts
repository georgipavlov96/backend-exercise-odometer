import * as entryPoint from '../src/index';

describe('test setup', () => {
  it('loads the TypeScript entry point', () => {
    expect(entryPoint).toEqual({});
  });
});
