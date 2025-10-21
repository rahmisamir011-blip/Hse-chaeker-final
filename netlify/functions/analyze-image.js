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
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'GEMINI_API_KEY not configured in Netlify environment' })
      };
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze PPE compliance. Check: Hairnet, Mask, Protective suit, Gloves, Safety shoes.

Return JSON:
{
  "findings": [{"ppeItem": "Hairnet", "compliant": true, "reason": "السبب", "boundingBox": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}}],
  "summary": "ملخص",
  "overallCompliant": true
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageFile.content.toString('base64'),
          mimeType: imageFile.mimeType
        }
      }
    ]);

    const text = result.response.text();
    const cleanText = text.replace(/``````
?/g, '').trim();
    
    let analysisJson;
    try {
      analysisJson = JSON.parse(cleanText);
      if (!analysisJson.findings) analysisJson.findings = [];
    } catch (e) {
      analysisJson = {
        findings: [{ppeItem: "Hairnet", compliant: false, reason: "تعذر التحليل", boundingBox: {x:0, y:0, width:1, height:1}}],
        summary: "حدث خطأ في التحليل",
        overallCompliant: false
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analysisJson)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
};
