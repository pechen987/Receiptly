import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  format?: SaveFormat;
}

/**
 * Preprocess the image for OCR with optimized settings
 * @param imageUri - The URI of the image to process
 * @param options - Optional processing parameters
 * @returns Promise<string> - The URI of the processed image
 */
export const preprocessImage = async (
  imageUri: string,
  options: ImageProcessingOptions = {}
): Promise<string> => {
  try {
    const {
      maxWidth = 2000,
      maxHeight = 2000,
      format = SaveFormat.PNG,
    } = options;

    // Get image info
    const imageInfo = await FileSystem.getInfoAsync(imageUri);
    if (!imageInfo.exists) {
      throw new Error('Image file does not exist');
    }

    // Process image with optimized settings for OCR
    const processed = await manipulateAsync(
      imageUri,
      [
        { resize: { width: maxWidth, height: maxHeight } },
      ],
      {
        format,
        compress: 1, // No compression for maximum quality
      }
    );

    // Verify the processed image
    const processedInfo = await FileSystem.getInfoAsync(processed.uri);
    if (!processedInfo.exists) {
      throw new Error('Failed to process image');
    }

    return processed.uri;
  } catch (error) {
    console.error('Error preprocessing image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to preprocess image: ${errorMessage}`);
  }
};

/**
 * Calculate optimal image size based on content
 * @param imageUri - The URI of the image to analyze
 * @returns Promise<{width: number, height: number}>
 */
export const calculateOptimalSize = async (imageUri: string): Promise<{width: number, height: number}> => {
  return { width: 2000, height: 2000 }; // Increased for better OCR
};

/**
 * Get recommended preprocessing options based on image characteristics
 * @param imageUri - The URI of the image to analyze
 * @returns Promise<ImageProcessingOptions>
 */
export const getRecommendedOptions = async (imageUri: string): Promise<ImageProcessingOptions> => {
  return {
    maxWidth: 2000,
    maxHeight: 2000,
    format: SaveFormat.PNG
  };
};
