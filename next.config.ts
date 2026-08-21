import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Local-dev-only: allows next/image to fetch from localhost/private
    // IPs. Next.js blocks this by default as SSRF protection, since a
    // production image URL should never point at a private/internal
    // address. It's safe here specifically because the "remote" image
    // server is this same project's own backend on localhost (see
    // spotly-api's local-disk upload fallback) — nothing external is
    // involved. This has no effect on real S3/R2 URLs, which use normal
    // public hostnames and were never affected by this check.
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "i.pravatar.cc", pathname: "/**" },
      // Next.js requires an exact port match — "localhost" alone only
      // matches the default port (80), not the backend's :3000, which
      // is where local-dev image uploads are actually served from (see
      // spotly-api's storage.service.ts local-disk fallback). An
      // explicit pathname wildcard is required too, or Next rejects the
      // URL with "url parameter is not allowed" even with a matching
      // protocol/hostname/port.
      { protocol: "http", hostname: "localhost", port: "3000", pathname: "/**" },

      // Business media storage. Wildcards cover any AWS S3 bucket and
      // Cloudflare R2's default public dev URL out of the box. If you're
      // using a custom domain in front of your bucket/CDN (recommended
      // for production — see spotly-api/README.md's storage section),
      // add that exact hostname here too, e.g.:
      //   { protocol: "https", hostname: "media.yourdomain.com" }
      { protocol: "https", hostname: "*.s3.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com", pathname: "/**" },
      // Cloudinary, the current storage backend (see spotly-api's
      // MediaService/StorageService) — all uploaded photos and videos
      // are served from this single fixed hostname regardless of cloud
      // name, so no wildcard is needed here.
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
