const { GoogleGenAI, Type } = require("@google/genai");
const busboy = require("busboy");

const PpeType = {
  HAIRNET: 'Hairnet',
  MASK: 'Mask',
  SUIT: 'Protective suit',
  GLOVES: 'Gloves',
  SHOES: 'Safety shoes',
};

const parseMultipartForm = (event) => {
  return new Promise((resolve, reject) => {
    const fields = {};
    try {
      const bb = busboy({
        headers: {
          "content-type": event.headers["content-type"] || event.headers["Content-Type"],
        },
      });

      bb.on("file", (name, file, info) => {
        const { mimeType } = info;
        const chunks = [];
        file.on("data", (chunk) => chunks.push(chunk));
        file.on("end", () => {
          fields[name] = {
            mimeType,
            content: Buffer.concat(chunks),
          };
        });
      });

      bb.on("field", (name, val) => {
        fields[name] = val;
      });

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
