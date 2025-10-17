import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, PpeType } from '../types';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove "data:image/jpeg;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};


const prompt = `أنت مفتش متخصص في الصحة والسلامة والبيئة (HSE) في مصانع الأدوية. مهمتك هي تحليل الصورة المقدمة للتحقق من امتثال العامل لمعدات الوقاية الشخصية (PPE).
تحقق من وجود وارتداء العناصر التالية بشكل صحيح: غطاء الشعر، الكمامة، البذلة الواقية، القفازات، وحذاء السلامة.
لكل عنصر، حدد ما إذا كان متوافقًا أم لا، وقدم سببًا موجزًا باللغة العربية، وحدد مربع الإحاطة الإحداثيات النسبية (0-1). عند تحديد مربعات الإحاطة، تأكد من أنها محكمة وتناسب حجم العنصر بدقة، خاصة بالنسبة لغطاء الشعر والكمامة لتجنب أن تكون كبيرة جدًا.
إذا كان كل شيء صحيحًا، فقدم ملخصًا إيجابيًا. إذا كانت هناك مشاكل، فقدم ملخصًا يوضح أنه لا يمكن دخول خط الإنتاج مع تعليمات للتصحيح.
قم بإرجاع النتائج بتنسيق JSON صارم يطابق المخطط المحدد.`;


const ppeSchema = {
  type: Type.OBJECT,
  properties: {
    findings: {
      type: Type.ARRAY,
      description: "List of PPE findings for each required item.",
      items: {
        type: Type.OBJECT,
        properties: {
          ppeItem: {
            type: Type.STRING,
            enum: Object.values(PpeType),
            description: "The type of PPE item being checked."
          },
          compliant: {
            type: Type.BOOLEAN,
            description: "True if the PPE is worn correctly, false otherwise."
          },
          reason: {
            type: Type.STRING,
            description: "A short explanation in Arabic about the finding."
          },
          boundingBox: {
            type: Type.OBJECT,
            description: "Normalized coordinates (0-1) of the bounding box for the item or missing area.",
            properties: {
              x: { type: Type.NUMBER, description: "Top-left x coordinate." },
              y: { type: Type.NUMBER, description: "Top-left y coordinate." },
              width: { type: Type.NUMBER, description: "Width of the box." },
              height: { type: Type.NUMBER, description: "Height of the box." },
            },
             required: ["x", "y", "width", "height"]
          }
        },
        required: ["ppeItem", "compliant", "reason", "boundingBox"]
      }
    },
    summary: {
      type: Type.STRING,
      description: "An overall summary message in Arabic for the user."
    },
    overallCompliant: {
        type: Type.BOOLEAN,
        description: "True if all PPE items are compliant."
    }
  },
  required: ["findings", "summary", "overallCompliant"]
};

export const analyzeImageForPpe = async (imageFile: File): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const base64Image = await fileToBase64(imageFile);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: imageFile.type,
            data: base64Image,
          },
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: ppeSchema,
    },
  });

  const jsonText = response.text.trim();
  try {
    const result = JSON.parse(jsonText);
    // Basic validation
    if (!result.findings || !Array.isArray(result.findings)) {
      throw new Error("Invalid response format: 'findings' array is missing.");
    }
    return result as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse JSON response:", jsonText);
    throw new Error("The AI returned an invalid response. Please try again.");
  }
};