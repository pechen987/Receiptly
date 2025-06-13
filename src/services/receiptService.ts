import axios, { AxiosError } from 'axios';
import * as FileSystem from 'expo-file-system';
import { OPENAI_API_KEY } from '@env';
import { Alert } from 'react-native';
import { preprocessImage } from './imagePreprocessing';
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

const MODEL = 'gpt-4o-mini'; // Lighter model for faster responses
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

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
      if (i < config.maxRetries - 1) {
        await sleep(config.delay * Math.pow(2, i)); // Exponential backoff
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
  
  // Validate items
  for (const item of data.items) {
    if (!item.name && !item.price) return false;
  }
  
  return true;
};

// Utility function to normalize strings
const normalizeString = (str: string | null): string | null => {
  if (!str) return null;
  const words = str.toLowerCase().split(' ');
  if (words.length === 0) return null;
  
  // Capitalize only the first word
  const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  // Keep all other words lowercase
  const restOfWords = words.slice(1);
  
  return [firstWord, ...restOfWords].join(' ');
};

// Create a separate axios instance for OpenAI API
const openaiAxios = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  }
});

export const processReceipt = async (imageUri: string): Promise<ReceiptData | null> => {
  try {
    // Preprocess the image first
    const processedImageUri = await preprocessImage(imageUri, {
      maxWidth: 2000,
      maxHeight: 2000,
      format: SaveFormat.PNG
    });

    // Read image as base64 with retry
    const base64 = await retryOperation(async () => {
      return await FileSystem.readAsStringAsync(processedImageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    });
    
    const dataUrl = `data:image/png;base64,${base64}`;

    // Compose messages
    const messages = [
      {
        role: 'system',
        content: `You are a professional receipt processor. Analyze the receipt image and extract the information. Expected output structure (Don't place any ' or " before the JSON. Always start with the JSON.):
{
  "store_category": string (one of ["Grocery", "Restaurant", "Fast food", "Pet store", "Beauty & cosmetics", "Pharmacy", "Electronics", "Clothing", "Home goods", "Gas station", "Convenience store", "Entertainment", "Online marketplace", "Other"]),
  "store_name": string or null,
  "date": "DD-MM-YYYY" or today's date if missing,
  "total": number or null,
  "tax_amount": number or null,
  "total_discount": number or null,
  "items": [
    {
      "name": string or null,
      "quantity": number or null,
      "price": number or null,
      "total": number or null,
      "discount": number or null,
      "category": string or null (one of Fruits, Vegetables, Meat & poultry, Seafood, Dairy & eggs, Bakery, Snacks, Beverages, Alcoholic beverages, Frozen foods, Canned & jarred goods, Dry & packaged goods, Condiments & sauces, Spices & seasonings, Breakfast foods, Baby products, Household supplies, Personal care, Pet supplies, Ready-to-eat foods, Organic health foods, International foods, Baking supplies, Deli & cheese, Other),
    }
  ]
}

Guidelines:
- Determine the language of receipt. Once you understand the language you can better understand which column contains product price, tax, discount and so on.
- Analyze the receipt image first, understand the overall structure and context. Only then proceed with generating a proper JSON.
- Look for the date on the receipt! Use logic to determine what region is the receipt from (e.g. if the date is in the future, it's probably from a different region, or if the language is not english, the format is probably different). This is very important, because date in America and Europe is formatted differently. Use today's date if the date is not found on the receipt.
- Store category should be guessed from store name, item names, or general context. Default to "other" if unsure.
- Product category should be guessed from item name or general context! If the receipt is not in english, identify the language and translate the item names to english to extract category. Really think hard on the item name to get the right category. Default to "Other" if unsure as last resort.
- Return null for any fields you cannot confidently extract. But double check before returning null!
- Summarize discounts yourself to get the total discount.
- Do not hallucinate values.
- Check for logical consistency.
- Only extract from receipts. If the image is not a receipt, return:
{ "error": "Image does not appear to be a receipt." }`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Carefully extract and complete receipt data according to instructions:',
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      },
    ];

    // Send to OpenAI with retry
    const response = await retryOperation(async () => {
      return await openaiAxios.post('/chat/completions', {
        model: MODEL,
        messages,
        max_tokens: 2000,
        temperature: 0.5,
      });
    });

    const content = response.data.choices?.[0]?.message?.content;
    console.log(content)
    if (!content) throw new Error('Empty response from OpenAI');

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error('Failed to parse OpenAI response:', parseErr);
      throw new Error('Failed to process receipt. Please try again.');
    }

    if (parsed.error === "Image does not appear to be a receipt.") {
      return null;
    }

    // Validate parsed data
    if (!validateReceiptData(parsed)) {
      throw new Error('Invalid receipt data structure');
    }

    // Normalize store and item names
    const normalizedData: ReceiptData = {
      ...parsed,
      store_name: normalizeString(parsed.store_name),
      store_category: normalizeString(parsed.store_category),
      items: parsed.items.map((item: ReceiptItem) => ({
        ...item,
        name: normalizeString(item.name),
        category: normalizeString(item.category)
      }))
    };

    return normalizedData;
  } catch (err) {
    console.error('processReceipt error:', err);
    
    if (err instanceof AxiosError) {
      if (err.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.');
      }
      if (err.response?.status === 401) {
        throw new Error('API authentication failed. Please check your API key.');
      }
    }
    
    throw new Error('Failed to process receipt. Please try again.');
  }
};
