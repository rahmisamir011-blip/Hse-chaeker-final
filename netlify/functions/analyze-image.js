const { GoogleGenerativeAI } = require("@google/genai");
const busboy = require('busboy');

function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const bb = busboy({
      headers: {
        'content-type': event.headers['content-type'] || event.headers['Content-Type']
      }
    });

    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      file.on('end', () => {
        fields[name] = {
          filename,
          mimeType,
          content: Buffer.concat(chunks)
        };
      });
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('close', () => {
      resolve(fields);
    });

    bb.on('error', (err) => {
      reject(new Error(`Error parsing form: ${err.message}`));
    });

    bb.end(Buffer.from(event.body, 'base64'));
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    const parsedForm = await parseMultipartForm(event);
    const imageFile = parsedForm.image;

    if (!imageFile || !imageFile.content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image file uploaded' })
      };
    }

    // FIXED: Correct initialization for @google/genai v1.x
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // FIXED: Use gemini-1.5-flash (stable model that supports vision)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash'
    });

    const imagePart = {
      inlineData: {
        data: imageFile.content.toString('base64'),
        mimeType: imageFile.mimeType
      }
    };

    const prompt = `أنت مفتش متخصص في الصحة والسلامة والبيئة (HSE) في مصانع الأدوية. 
    مهمتك هي تحليل الصورة المقدمة للتحقق من امتثال العامل لمعدات الوقاية الشخصية (PPE).
    
    تحقق من وجود وارتداء العناصر التالية بشكل صحيح:
    1. غطاء الشعر (Charlotte) - Hairnet
    2. الكمامة (Bavette) - Mask  
    3. البذلة الواقية - Protective suit
    4. القفازات - Gloves
    5. حذاء السلامة - Safety shoes
    
    قدم النتائج بتنسيق JSON التالي بالضبط:
    {
      "findings": [
        {
          "ppeItem": "Hairnet",
          "compliant": true أو false,
          "reason": "السبب بالعربية",
          "boundingBox": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}
        }
      ],
      "summary": "ملخص عام بالعربية",
      "overallCompliant": true أو false
    }
    
    استخدم هذه القيم بالضبط لـ ppeItem: "Hairnet", "Mask", "Protective suit", "Gloves", "Safety shoes"`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const analysisText = response.text();

    let analysisJson;
    try {
      // Clean the response text
      const cleanText = analysisText.replace(/``````
?/g, '').trim();
      analysisJson = JSON.parse(cleanText);
      
      // Ensure findings array exists
      if (!analysisJson.findings || !Array.isArray(analysisJson.findings)) {
        analysisJson.findings = [];
      }
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', analysisText);
      
      analysisJson = {
        findings: [
          {
            ppeItem: "Hairnet",
            compliant: false,
            reason: "لم يتمكن النظام من تحليل الصورة",
            boundingBox: { x: 0, y: 0, width: 1, height: 1 }
          }
        ],
        rawResponse: analysisText,
        overallCompliant: false,
        summary: 'تعذر تحليل الاستجابة. يرجى المحاولة مرة أخرى.'
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analysisJson)
    };

  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'An error occurred',
        details: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
};
    bb.on('error', (err) => {
      reject(new Error(`Error parsing form: ${err.message}`));
    });

    bb.end(Buffer.from(event.body, 'base64'));
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    const parsedForm = await parseMultipartForm(event);
    const imageFile = parsedForm.image;

    if (!imageFile || !imageFile.content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image file uploaded' })
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const imagePart = {
      inlineData: {
        data: imageFile.content.toString('base64'),
        mimeType: imageFile.mimeType
      }
    };

    const prompt = `أنت مفتش متخصص في الصحة والسلامة والبيئة (HSE) في مصانع الأدوية. 
    مهمتك هي تحليل الصورة المقدمة للتحقق من امتثال العامل لمعدات الوقاية الشخصية (PPE).
    
    تحقق من وجود وارتداء العناصر التالية بشكل صحيح:
    1. غطاء الشعر (Charlotte)
    2. الكمامة (Bavette)
    3. البذلة الواقية
    4. القفازات
    5. حذاء السلامة
    
    قدم النتائج بتنسيق JSON مع:
    - findings: قائمة بكل عنصر PPE مع حالة الامتثال والسبب وإحداثيات bounding box (نسبية 0-1)
    - summary: ملخص عام بالعربية
    - overallCompliant: true إذا كانت جميع العناصر موجودة، false خلاف ذلك`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const analysisText = response.text();

    let analysisJson;
    try {
      analysisJson = JSON.parse(analysisText);
    } catch (parseError) {
      analysisJson = {
        findings: [],
        rawResponse: analysisText,
        overallCompliant: false,
        summary: 'تعذر تحليل الاستجابة بشكل صحيح'
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analysisJson)
    };

  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
