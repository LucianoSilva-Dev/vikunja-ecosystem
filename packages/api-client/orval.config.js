import { defineConfig } from 'orval';

module.exports = defineConfig({
  vikunja: {
    input: {
      target: './swagger-v3.yaml',
    },
    output: {
      mode: 'tags-split',
      target: 'src/generated/vikunja.ts',
      schemas: 'src/generated/model',
      client: 'axios-functions',
      clean: true,
      override: {
        mutator: {
          path: './src/lib/axios-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
