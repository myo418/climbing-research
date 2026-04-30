import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://myo418.github.io',
  base: '/climbing-research',
  integrations: [mdx()],
  server: {
    port: 4321,
    host: true,
  },
});
