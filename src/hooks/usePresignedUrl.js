import { useQuery } from '@tanstack/react-query';
import { getUrl } from 'aws-amplify/storage';
import { ThumbnailService } from '../utils/thumbnailService';

/**
 * React Query hook for fetching and caching S3 presigned URLs
 * @param {string} path - S3 object path
 * @param {boolean} useThumbnail - Whether to try loading thumbnail first
 * @returns {object} - { url, isLoading, error, isError }
 */
export const usePresignedUrl = (path, useThumbnail = false) => {
  const queryKey = useThumbnail
    ? ['presigned-url', 'thumbnail', path]
    : ['presigned-url', 'original', path];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!path) {
        throw new Error('Path is required');
      }

      let finalPath = path;
      let finalUrl = null;

      // If thumbnail is requested, try thumbnail first
      if (useThumbnail) {
        const thumbnailPath = ThumbnailService.getThumbnailPath(path);

        try {
          // Try to get thumbnail URL
          const thumbnailResult = await getUrl({
            path: thumbnailPath,
            options: {
              validateObjectExistence: true,
              expiresIn: 300, // 5 minutes
              useAccelerateEndpoint: false
            }
          });

          finalPath = thumbnailPath;
          finalUrl = thumbnailResult.url.toString();
          console.log(`[React Query] Thumbnail URL fetched for ${thumbnailPath}`);

        } catch (thumbnailError) {
          console.log(`[React Query] Thumbnail not found, generating from original: ${thumbnailPath}`);

          // Thumbnail doesn't exist, try to generate it
          try {
            await ThumbnailService.generateThumbnailForExistingImage(path);

            // Try loading thumbnail again after generation
            const newThumbnailResult = await getUrl({
              path: thumbnailPath,
              options: {
                validateObjectExistence: true,
                expiresIn: 300,
                useAccelerateEndpoint: false
              }
            });

            finalPath = thumbnailPath;
            finalUrl = newThumbnailResult.url.toString();
            console.log(`[React Query] Thumbnail generated and URL fetched for ${thumbnailPath}`);

          } catch (generationError) {
            console.log(`[React Query] Failed to generate thumbnail, falling back to original:`, generationError);
            // Fall back to original image
            finalPath = path;
          }
        }
      }

      // If we haven't set a URL yet (either no thumbnail requested or fallback needed)
      if (!finalUrl) {
        const result = await getUrl({
          path: finalPath,
          options: {
            validateObjectExistence: true,
            expiresIn: 300, // 5 minutes
            useAccelerateEndpoint: false
          }
        });

        finalUrl = result.url.toString();
        console.log(`[React Query] Original URL fetched for ${finalPath}`);
      }

      return { url: finalUrl, path: finalPath };
    },
    enabled: !!path, // Only run query if path is provided
    staleTime: 4 * 60 * 1000, // 4 minutes (1 min buffer before 5 min expiry)
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404 errors (file not found)
      if (error?.message?.includes('NotFound') || error?.message?.includes('404')) {
        return false;
      }
      // Retry once for other errors
      return failureCount < 1;
    },
  });
};
