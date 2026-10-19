import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js', // CommonJS
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js', // ES Modules
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.umd.js', // UMD
      name: 'HexPic',
      format: 'umd',
      exports: 'named',
      sourcemap: true,
      globals: {
        react: 'React',
      },
    },
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      exclude: ['**/*.test.ts'],
    }),
    terser(),
  ],
  external: ['react'],
};
