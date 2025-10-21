const { GoogleGenerativeAI } = require("@google/generative-ai");
const busboy = require("busboy");

function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const bb = busboy({
      headers: {
        "content-type": event.headers["content-type"] || event.headers["Content-Type"]
      }
    });

    bb.on("file", (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      
      file.on("data", (chunk) => {
        chunks.push(chunk);
      });
      
      file.on("end", () => {
        fields[name] = {
          filename,
          mimeType,
          content: Buffer.concat(chunks)
        };
      });
    });

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("close", () => {
      resolve(fields);
    });

    bb.on("error", (err) => {
      reject(new Error("Error parsing form: " + err.message));
    });

    bb.end(Buffer.from(event.body, "base64"));
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "API key not configured" })
      };
    }

    const parsedForm = await parseMultipartForm(event);
    const imageFile = parsedForm.image;

    if (!imageFile || !imageFile.content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No image uploaded" })
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = "Analyze PPE compliance for pharmaceutical worker. Check: 1.Hairnet 2.Mask 3.Protective suit 4.Gloves 5.Safety shoes. Return valid JSON only: {findings:[{ppeItem:string,compliant:boolean,reason:string(Arabic),boundingBox:{x:number,y:number,width:number,height:number}}],summary:string(Arabic),overallCompliant:boolean}";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageFile.content.toString("base64"),
          mimeType: imageFile.mimeType
        }
      }
    ]);

    const text = result.response.text();
    let cleanText = text.trim();
    
    if (cleanText.startsWith("```")) {
      const lines = cleanText.split("
");
      lines.shift();
      if (lines[lines.length - 1].includes("```
        lines.pop();
      }
      cleanText = lines.join("
").trim();
    }
    
    let analysisJson;
    try {
      analysisJson = JSON.parse(cleanText);
      if (!analysisJson.findings) {
        analysisJson.findings = [];
      }
    } catch (parseError) {
      analysisJson = {
        findings: [{
          ppeItem: "Hairnet",
          compliant: false,
          reason: "فشل التحليل",
          boundingBox: { x: 0, y: 0, width: 1, height: 1 }
        }],
        summary: "حدث خطأ",
        overallCompliant: false
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analysisJson)
    };

  } catch (error) {
    console.error("Error:", error);
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
