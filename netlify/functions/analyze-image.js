const { GoogleGenerativeAI } = require("@google/generative-ai");
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
      console.error('GEMINI_API_KEY not found in environment');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    console.log('API Key found, length:', apiKey.length);

    const parsedForm = await parseMultipartForm(event);
    const imageFile = parsedForm.image;

    if (!imageFile || !imageFile.content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image file uploaded' })
      };
    }

    console.log('Image received:', imageFile.filename, 'Type:', imageFile.mimeType);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an HSE inspector specialized in pharmaceutical manufacturing. Analyze this image and check PPE compliance.

Check for these items worn correctly:
1. Hairnet (Charlotte) - غطاء الشعر
2. Face Mask (Bavette) - الكمامة  
3. Protective Suit - البذلة الواقية
4. Gloves - القفازات
5. Safety Shoes - حذاء السلامة

Return JSON in this exact format:
{
  "findings": [
    {
      "ppeItem": "Hairnet",
      "compliant": true,
      "reason": "السبب بالعربية",
      "boundingBox": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}
    }
  ],
  "summary": "ملخص عام بالعربية",
  "overallCompliant": true
}

Use these exact values for ppeItem: "Hairnet", "Mask", "Protective suit", "Gloves", "Safety shoes"`;

    const imagePart = {
      inlineData: {
        data: imageFile.content.toString('base64'),
        mimeType: imageFile.mimeType
      }
    };

    console.log('Calling Gemini API...');
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();
    
    console.log('Gemini response received, length:', text.length);

    let analysisJson;
    try {
      const cleanText = text.replace(/``````
?/g, '').trim();
      analysisJson = JSON.parse(cleanText);
      
      if (!analysisJson.findings || !Array.isArray(analysisJson.findings)) {
        analysisJson.findings = [];
      }
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      analysisJson = {
        findings: [
          {
            ppeItem: "Hairnet",
            compliant: false,
            reason: "تعذر تحليل الصورة",
            boundingBox: { x: 0, y: 0, width: 1, height: 1 }
          }
        ],
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
    console.error('Function error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
        type: error.constructor.name,
        timestamp: new Date().toISOString()
      })
    };
  }
};
