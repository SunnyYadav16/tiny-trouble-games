import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'wordlists',
    environment: 'node',
  },
});
