// netlify/functions/analyze.js

const { GoogleGenerativeAI } = require("@google/genai");
const busboy = require('busboy');

// This is a helper function to process the image file sent from the frontend.
function parseMultipartForm(event) {
  return new Promise((resolve) => {
    const fields = {};
    const bb = busboy({
      headers: {
        'content-type': event.headers['content-type'] |

| event.headers,
      },
    });

    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks =;
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });
      file.on('end', () => {
        fields[name] = {
          filename,
          mimeType,
          content: Buffer.concat(chunks),
        };
      });
    });

    bb.on('close', () => {
      resolve(fields);
    });

    // Netlify sends the request body as a base64-encoded string.
    // We need to convert it back to a buffer for busboy to process.
    bb.end(Buffer.from(event.body, 'base64'));
  });
}

// This is the main function that Netlify will run.
exports.handler = async (event) => {
  try {
    // 1. Securely get the API key from the environment variables you set in the Netlify UI.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    // 2. Parse the incoming image file from the request.
    const parsedForm = await parseMultipartForm(event);
    const imageFile = parsedForm.image; // 'image' must match the name in your FormData from script.js

    if (!imageFile) {
      return { statusCode: 400, body: JSON.stringify({ error: "No image file uploaded." }) };
    }

    // 3. Initialize the Google Gemini client with your secret key.
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    // 4. Prepare the image data to be sent to the Gemini API.
    const imagePart = {
      inlineData: {
        data: imageFile.content.toString("base64"),
        mimeType: imageFile.mimeType,
      },
    };

    // 5. Define the specific instructions for the AI.
    const prompt = "Analyze this image. Is the person wearing all required safety equipment for a pharmaceutical production line, specifically a charlotte, bavette, and full industry suit? Respond with a simple JSON object indicating the presence of each item, for example: {\"charlotte\": true, \"bavette\": true, \"suit\": false}.";

    // 6. Make the API call to Gemini with the prompt and the image.
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const analysisText = response.text();

    // 7. Return the successful analysis to your frontend app.
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // This allows your frontend to call the function
        'Content-Type': 'application/json',
      },
      body: analysisText, // Gemini should return a string that is already valid JSON
    };

  } catch (error) {
    console.error("Error in function:", error);
    // Return an error message if something goes wrong.
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

      bb.on("close", () => resolve(fields));
      bb.on("error", err => reject(new Error(`Error parsing form: ${err.message}`)));

      bb.end(Buffer.from(event.body, "base64"));
    } catch (err) {
      reject(err);
    }
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
          ppeItem: { type: Type.STRING, enum: Object.values(PpeType) },
          compliant: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
          boundingBox: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER },
            },
            required: ["x", "y", "width", "height"],
          },
        },
        required: ["ppeItem", "compliant", "reason", "boundingBox"],
      },
    },
    summary: { type: Type.STRING },
    overallCompliant: { type: Type.BOOLEAN },
  },
  required: ["findings", "summary", "overallCompliant"],
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const { API_KEY } = process.env;
  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key is not configured." }) };
  }

  try {
    const parsedForm = await parseMultipartForm(event);
    const imageFile = parsedForm.image;

    if (!imageFile || !imageFile.content) {
      return { statusCode: 400, body: JSON.stringify({ error: "No image file uploaded." }) };
    }
    
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: imageFile.mimeType, data: imageFile.content.toString("base64") } },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: ppeSchema,
      },
    });

    const jsonText = response.text.trim();
    JSON.parse(jsonText);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: jsonText,
    };

  } catch (error) {
    console.error("Error processing request:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    const statusCode = error.name === 'SyntaxError' ? 502 : 500;
    return {
      statusCode,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};
