/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @xenova/transformers (y su runtime onnx) cargan binarios/wasm: hay que dejarlos
  // FUERA del bundle del server para que se carguen como módulos nativos en runtime.
  // El modelo e5 corre en el proceso Node (next start), no en serverless.
  experimental: {
    serverComponentsExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  },
};

export default nextConfig;
