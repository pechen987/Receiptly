import axios, { AxiosError } from 'axios';
import * as FileSystem from 'expo-file-system';
import { OPENAI_API_KEY } from '@env';
import { Alert } from 'react-native';
import { 
  preprocessImage, 
  getRecommendedOptions, 
  preprocessLowQualityImage,
  autoRotateImage 
} from './imagePreprocessing';
import { SaveFormat } from 'expo-image-manipulator';
import apiConfig from '../config/api';

interface ReceiptItem {
  name: string | null;
  quantity: number | null;
  price: number | null;
  total: number | null;
  discount: number | null;
  category: string | null;
}

interface ReceiptData {
  store_category: string | null;
  store_name: string | null;
  date: string;
  total: number | null;
  tax_amount: number | null;
  total_discount: number | null;
  items: ReceiptItem[];
}

const MODEL = 'gpt-4o'; // Use the more capable model for better accuracy
const MAX_RETRIES = 1; // Try the main attempt, then retry once on failure
const RETRY_DELAY = 1000;

interface RetryConfig {
  maxRetries: number;
  delay: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig = { maxRetries: MAX_RETRIES, delay: RETRY_DELAY }
): Promise<T> => {
  let lastError: Error = new Error('Operation failed');
  
  for (let i = 0; i < config.maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (error instanceof AxiosError) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw lastError; // Don't retry auth errors
        }
      }
      
      if (i < config.maxRetries - 1) {
        await sleep(config.delay * Math.pow(2, i)); // Exponential backoff
        console.log(`Retrying operation, attempt ${i + 2}/${config.maxRetries}`);
      }
    }
  }
  
  throw lastError;
};

const validateReceiptData = (data: ReceiptData): boolean => {
  if (!data) return false;
  if (!data.date) return false;
  if (data.total === null || data.total === undefined) return false;
  if (!Array.isArray(data.items)) return false;
  
  // Validate items - at least one item should have meaningful data
  const validItems = data.items.filter(item => item.name || item.price);
  if (validItems.length === 0) return false;
  
  return true;
};

// Enhanced string normalization
const normalizeString = (str: string | null): string | null => {
  if (!str) return null;
  
  // Clean up the string
  const cleaned = str.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  
  const words = cleaned.toLowerCase().split(' ');
  if (words.length === 0) return null;
  
  // Capitalize only the first word, keep others lowercase
  const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  const restOfWords = words.slice(1);
  
  return [firstWord, ...restOfWords].join(' ');
};

// Create axios instance with timeout and proper error handling
const openaiAxios = axios.create({
  baseURL: 'https://api.openai.com/v1',
  timeout: 60000, // 60 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  }
});

// Enhanced system prompt for better OCR results
const getSystemPrompt = () => `You are a professional receipt processor with expertise in OCR and data extraction. Your task is to analyze receipt images with high accuracy and extract structured information.

CRITICAL INSTRUCTIONS:
1. Examine the entire image carefully, including edges and corners where text might be faded
2. Look for patterns that indicate receipt structure (headers, item lists, totals, etc.)
3. Use context clues to identify ambiguous characters (e.g., 0 vs O, 1 vs l, 5 vs S)
4. Pay special attention to decimal points and currency symbols
5. Cross-reference extracted totals with itemized amounts for consistency
6. Handle rotated or sideways text by mentally rotating the image

OUTPUT FORMAT (JSON only, no markdown or explanations):
{
  "store_category": "string (ALWAYS one of: Grocery, Restaurant, Fast food, Pet store, Beauty & cosmetics, Pharmacy, Electronics, Clothing, Home goods, Gas station, Convenience store, Entertainment, Online marketplace, Other)",
  "store_name": "string or null",
  "date": "DD-MM-YYYY format or today's date if missing",
  "total": "number or null",
  "tax_amount": "number or null", 
  "total_discount": "number or null",
  "items": [
    {
      "name": "string or null",
      "quantity": "number or null (default 1 if not specified)",
      "price": "number or null (unit price)",
      "total": "number or null (quantity × price)",
      "discount": "number or null",
      "category": "string or null (ALWAYS one of: Fruits, Vegetables, Meat & poultry, Seafood, Dairy & eggs, Bakery, Snacks, Beverages, Alcoholic beverages, Frozen foods, Canned & jarred goods, Dry & packaged goods, Condiments & sauces, Spices & seasonings, Breakfast foods, Baby products, Household supplies, Personal care, Pet supplies, Ready-to-eat foods, Organic health foods, International foods, Baking supplies, Deli & cheese, Other)"
    }
  ]
}

PROCESSING GUIDELINES:
- First determine the receipt language and format conventions
- Identify the receipt layout (header, items section, totals section)
- For dates: Consider regional formats (DD-MM-YYYY vs MM-DD-YYYY). Use contextual clues like language or store location
- For amounts: Look for decimal separators (. or ,) and currency symbols
- For items: Extract in order they appear, preserving quantity and pricing relationships
- Store category: Infer from store name, items sold, or visual branding
- Item categories: Depending on what language the receipt is in, understand which categories are relevant for each item. ONLY choose categories from: [Fruits, Vegetables, Meat & poultry, Seafood, Dairy & eggs, Bakery, Snacks, Beverages, Alcoholic beverages, Frozen foods, Canned & jarred goods, Dry & packaged goods, Condiments & sauces, Spices & seasonings, Breakfast foods, Baby products, Household supplies, Personal care, Pet supplies, Ready-to-eat foods, Organic health foods, International foods, Baking supplies, Deli & cheese, Other]. Default to Other if unsure.
- Handle multi-line items by combining related text
- If unsure about a value, return null rather than guessing
- Validate mathematical relationships (item totals, tax calculations, final total)
- If the image appears rotated, mentally rotate it to read the text correctly

ERROR HANDLING:
- If image is not a receipt, return: {"error": "Image does not appear to be a receipt."}
- If image is too blurry or damaged to read, return: {"error": "Image quality too poor for processing."}
- If receipt is partially readable, extract what you can and null for unclear fields`;

// Function to determine if we should use high-quality processing
const shouldUseHighQualityProcessing = async (imageUri: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(imageUri);
    // Use high quality for smaller images (likely lower resolution) or very large files
    return info.exists && ((info.size || 0) < 1024 * 1024 || (info.size || 0) > 10 * 1024 * 1024);
  } catch {
    return false;
  }
};

export const processReceipt = async (imageUri: string): Promise<ReceiptData | null> => {
  try {
    console.log('Starting receipt processing...');
    
    // Step 1: Auto-rotate if needed
    const rotatedImageUri = await autoRotateImage(imageUri);
    
    // Step 2: Determine processing strategy
    const useHighQuality = await shouldUseHighQualityProcessing(rotatedImageUri);
    
    let processedImageUri: string;
    
    if (useHighQuality) {
      console.log('Using high-quality processing for challenging image');
      processedImageUri = await preprocessLowQualityImage(rotatedImageUri);
    } else {
      // Get recommended options and preprocess
      const options = await getRecommendedOptions(rotatedImageUri);
      console.log('Using standard processing with options:', options);
      processedImageUri = await preprocessImage(rotatedImageUri, options);
    }

    // Read processed image as base64
    const base64 = await FileSystem.readAsStringAsync(processedImageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const dataUrl = `data:image/png;base64,${base64}`;
    
    console.log('Image processed, size:', Math.round(base64.length * 0.75 / 1024), 'KB');

    // Enhanced message structure
    const messages = [
      {
        role: 'system',
        content: getSystemPrompt(),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please analyze this receipt image and extract all information according to the instructions. Focus on accuracy and completeness. If the image appears rotated, please mentally rotate it to read the text correctly.',
          },
          {
            type: 'image_url',
            image_url: { 
              url: dataUrl,
              detail: 'high' // Request high-detail analysis
            },
          },
        ],
      },
    ];

    // Send to OpenAI with enhanced parameters
    const response = await retryOperation(async () => {
      return await openaiAxios.post('/chat/completions', {
        model: MODEL,
        messages,
        max_tokens: 3000, // Increased for complex receipts
        temperature: 0.1, // Lower temperature for more consistent results
        top_p: 0.9,       // Slight creativity for handling ambiguous text
      });
    });

    const content = response.data.choices?.[0]?.message?.content;
    console.log('OpenAI response received, length:', content?.length || 0);
    
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse JSON response
    let parsed;
    try {
      // Clean up the JSON string
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.log('Failed to parse OpenAI response:', parseErr);
      console.log('Raw content:', content);
      throw new Error('Could not parse receipt data. Please try again.');
    }

    // Check for OpenAI-reported errors
    if (parsed.error) {
      throw new Error(`OpenAI Error: ${parsed.error}`);
    }
    
    // Validate the structure of the parsed data
    if (!validateReceiptData(parsed)) {
      console.log('Invalid receipt data structure:', parsed);
      throw new Error('The scanned image does not appear to be a valid receipt.');
    }
    
    // Normalize and clean up data
    const normalizedData = {
      ...parsed,
      store_name: normalizeString(parsed.store_name),
      items: parsed.items.map((item: ReceiptItem) => ({
        ...item,
        name: normalizeString(item.name),
        category: item.category ? normalizeString(item.category) : 'Other',
      })),
    };

    return normalizedData;

  } catch (err: any) {
    console.log('processReceipt error:', err);

    let errorMessage = 'An unexpected error occurred during processing.';

    if (err instanceof AxiosError) {
      if (err.response) {
        // Handle specific OpenAI API errors
        const status = err.response.status;
        const data = err.response.data;
        if (status === 401 || status === 403) {
          errorMessage = 'Authentication error with OpenAI. Please check your API key.';
        } else if (status === 429) {
          errorMessage = 'You have exceeded your OpenAI API quota. Please check your plan and billing details.';
        } else if (data?.error?.message) {
          errorMessage = `OpenAI API Error: ${data.error.message}`;
        }
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'The request to OpenAI timed out. The server may be busy. Please try again in a few moments.';
      } else {
        errorMessage = 'A network error occurred while connecting to OpenAI.';
      }
    } else if (err.message) {
      // Handle custom errors thrown in the try block
      errorMessage = err.message;
    }
    
    // Show a user-friendly alert
    Alert.alert('Processing Failed', errorMessage);
    
    return null;
  } finally {
    // Optional: Clean up temporary files
    // Consider if you want to keep them for debugging
  }
};