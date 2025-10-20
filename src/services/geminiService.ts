import { AnalysisResult } from '../types';

export const analyzeImageForPpe = async (imageFile: File): Promise<AnalysisResult> => {
  const formData = new FormData();
  formData.append('image', imageFile, imageFile.name);

  try {
    const response = await fetch('/api/analyze-image', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || `Request failed with status ${response.status}`);
    }

    if (!result.findings || !Array.isArray(result.findings)) {
      throw new Error("Invalid response format from server: 'findings' array is missing.");
    }

    return result as AnalysisResult;

  } catch (err) {
    console.error("Error calling analysis API:", err);
    if (err instanceof Error) {
        throw new Error(`Network or server error: ${err.message}`);
    }
    throw new Error('An unknown error occurred during analysis.');
  }
};
