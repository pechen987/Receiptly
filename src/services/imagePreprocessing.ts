import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat, FlipType } from 'expo-image-manipulator';

interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  format?: SaveFormat;
  quality?: number;
  enhanceForOCR?: boolean;
}

/**
 * Get image dimensions estimation based on file size
 */
const estimateImageDimensions = async (imageUri: string): Promise<{ width: number; height: number }> => {
  try {
    const info = await FileSystem.getInfoAsync(imageUri);
    const fileSizeKB = info.exists && info.size ? info.size / 1024 : 0;
    
    // Estimate dimensions based on file size (rough heuristic)
    // Most phone cameras produce images with similar compression ratios
    if (fileSizeKB < 500) {
      return { width: 1200, height: 1600 }; // Small image
    } else if (fileSizeKB < 2000) {
      return { width: 2000, height: 2600 }; // Medium image
    } else {
      return { width: 3000, height: 4000 }; // Large image
    }
  } catch (error) {
    console.warn('Could not estimate image dimensions, using defaults');
    return { width: 2000, height: 2600 };
  }
};

/**
 * Calculate optimal processing dimensions for OCR
 */
const calculateOptimalDimensions = (
  estimatedWidth: number, 
  estimatedHeight: number, 
  maxWidth: number = 2400, 
  maxHeight: number = 3200
): { width: number; height: number } => {
  // For OCR, we want higher resolution but need to balance with API limits
  const aspectRatio = estimatedWidth / estimatedHeight;
  
  // Calculate dimensions that maintain aspect ratio
  let targetWidth = Math.min(estimatedWidth, maxWidth);
  let targetHeight = Math.min(estimatedHeight, maxHeight);
  
  // Ensure we maintain aspect ratio
  if (targetWidth / targetHeight > aspectRatio) {
    targetWidth = Math.round(targetHeight * aspectRatio);
  } else {
    targetHeight = Math.round(targetWidth / aspectRatio);
  }
  
  // Ensure minimum resolution for OCR (text should be at least 12px high)
  const minWidth = 1000;
  const minHeight = 1300;
  
  if (targetWidth < minWidth || targetHeight < minHeight) {
    if (aspectRatio > 1) {
      // Landscape
      targetWidth = Math.max(minWidth, targetWidth);
      targetHeight = Math.round(targetWidth / aspectRatio);
    } else {
      // Portrait (typical for receipts)
      targetHeight = Math.max(minHeight, targetHeight);
      targetWidth = Math.round(targetHeight * aspectRatio);
    }
  }
  
  return { width: targetWidth, height: targetHeight };
};

/**
 * Enhanced image preprocessing for OCR using only supported operations
 */
export const preprocessImage = async (
  imageUri: string,
  options: ImageProcessingOptions = {}
): Promise<string> => {
  try {
    const {
      maxWidth = 2400,
      maxHeight = 3200,
      format = SaveFormat.PNG,
      quality = 1.0,
      enhanceForOCR = true,
    } = options;

    // Verify image exists
    const imageInfo = await FileSystem.getInfoAsync(imageUri);
    if (!imageInfo.exists) {
      throw new Error('Image file does not exist');
    }

    console.log('Original image size:', imageInfo.size, 'bytes');

    // Get optimal dimensions
    const estimatedDimensions = await estimateImageDimensions(imageUri);
    const targetDimensions = calculateOptimalDimensions(
      estimatedDimensions.width,
      estimatedDimensions.height,
      maxWidth,
      maxHeight
    );

    console.log('Target dimensions:', targetDimensions);

    // Build manipulation array with only supported operations
    const manipulations: any[] = [];

    // 1. Resize to optimal dimensions
    manipulations.push({
      resize: {
        width: targetDimensions.width,
        height: targetDimensions.height,
      },
    });

    // Note: We removed the modulate action as it's not supported
    // The preprocessing will rely on higher resolution and PNG format for better OCR

    // Process the image with supported operations only
    const processed = await manipulateAsync(
      imageUri,
      manipulations,
      {
        format,
        compress: quality,
      }
    );

    // Verify processed image
    const processedInfo = await FileSystem.getInfoAsync(processed.uri);
    if (!processedInfo.exists) {
      throw new Error('Failed to process image');
    }

    console.log('Processed image size:', processedInfo.size, 'bytes');
    
    return processed.uri;
  } catch (error) {
    console.log('Error preprocessing image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to preprocess image: ${errorMessage}`);
  }
};

/**
 * Calculate optimal image size based on estimated content
 */
export const calculateOptimalSize = async (
  imageUri: string
): Promise<{width: number, height: number}> => {
  try {
    const dimensions = await estimateImageDimensions(imageUri);
    return calculateOptimalDimensions(dimensions.width, dimensions.height);
  } catch (error) {
    console.warn('Could not calculate optimal size, using defaults');
    return { width: 2400, height: 3200 };
  }
};

/**
 * Get recommended preprocessing options based on image characteristics
 */
export const getRecommendedOptions = async (
  imageUri: string
): Promise<ImageProcessingOptions> => {
  try {
    const info = await FileSystem.getInfoAsync(imageUri);
    const dimensions = await estimateImageDimensions(imageUri);
    const optimalSize = calculateOptimalDimensions(dimensions.width, dimensions.height);
    
    // Larger images might need more compression to stay within API limits
    const shouldCompress = info.exists && (info.size || 0) > 5 * 1024 * 1024; // 5MB
    
    return {
      maxWidth: optimalSize.width,
      maxHeight: optimalSize.height,
      format: SaveFormat.PNG, // PNG for lossless quality
      quality: shouldCompress ? 0.9 : 1.0, // Slight compression for very large images
      enhanceForOCR: true,
    };
  } catch (error) {
    console.warn('Could not analyze image, using default options');
    return {
      maxWidth: 2400,
      maxHeight: 3200,
      format: SaveFormat.PNG,
      quality: 1.0,
      enhanceForOCR: true,
    };
  }
};

/**
 * Specialized preprocessing for low-quality or blurry images
 * Uses maximum resolution and no compression
 */
export const preprocessLowQualityImage = async (
  imageUri: string
): Promise<string> => {
  return preprocessImage(imageUri, {
    maxWidth: 3000,      // Higher resolution for poor quality images
    maxHeight: 4000,
    format: SaveFormat.PNG,
    quality: 1.0,        // No compression
    enhanceForOCR: true,
  });
};

/**
 * Check if image needs rotation (basic heuristic)
 */
export const shouldRotateImage = async (imageUri: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(imageUri);
    const estimated = await estimateImageDimensions(imageUri);
    
    // If width > height, it might be a rotated receipt (receipts are usually portrait)
    return estimated.width > estimated.height;
  } catch {
    return false;
  }
};

/**
 * Auto-rotate image if it appears to be sideways
 */
export const autoRotateImage = async (imageUri: string): Promise<string> => {
  try {
    const needsRotation = await shouldRotateImage(imageUri);
    
    if (!needsRotation) {
      return imageUri;
    }
    
    // Rotate 90 degrees clockwise
    const rotated = await manipulateAsync(
      imageUri,
      [{ rotate: 90 }],
      { format: SaveFormat.PNG, compress: 1.0 }
    );
    
    console.log('Image auto-rotated for better OCR');
    return rotated.uri;
  } catch (error) {
    console.warn('Auto-rotation failed, using original image:', error);
    return imageUri;
  }
};