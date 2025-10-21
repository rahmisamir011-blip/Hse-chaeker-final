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
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        fields[name] = {
          filename: info.filename,
          mimeType: info.mimeType,
          content: Buffer.concat(chunks)
        };
      });
    });

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("close", () => resolve(fields));
    bb.on("error", (err) => reject(err));
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
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API key missing" }) };
    }

    const parsedForm = await parseMultipartForm(event);
    const imageFile = parsedForm.image;

    if (!imageFile) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No image" }) };
    }

    const base64Image = imageFile.content.toString("base64");
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "You are an HSE inspector for pharmaceutical manufacturing. Analyze this image and check PPE compliance. Check these 5 items: 1.Hairnet 2.Mask 3.Protective suit 4.Gloves 5.Safety shoes. For EACH item, determine if compliant and provide reason in Arabic. Return ONLY valid JSON in this exact format: {\"findings\":[{\"ppeItem\":\"Hairnet\",\"compliant\":true,\"reason\":\"Ø§Ù„Ø³Ø¨Ø¨ Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©\",\"boundingBox\":{\"x\":0.1,\"y\":0.1,\"width\":0.2,\"height\":0.2}}],\"summary\":\"Ù…Ù„Ø®Øµ Ø¹Ø§Ù… Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©\",\"overallCompliant\":true}" },
              { inline_data: { mime_type: imageFile.mimeType, data: base64Image } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || "API error: " + JSON.stringify(data));
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    if (text.includes("```json")) {
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    let result;
    try {
      result = JSON.parse(text);
      if (!result.findings || !Array.isArray(result.findings)) {
        result.findings = [];
      }
    } catch (e) {
      result = {
        findings: [
          { ppeItem: "Hairnet", compliant: false, reason: "ÙØ´Ù„ Ø§Ù„ØªØ­Ù„ÙŠÙ„", boundingBox: { x: 0, y: 0, width: 1, height: 1 } },
          { ppeItem: "Mask", compliant: false, reason: "ÙØ´Ù„ Ø§Ù„ØªØ­Ù„ÙŠÙ„", boundingBox: { x: 0, y: 0, width: 1, height: 1 } },
          { ppeItem: "Protective suit", compliant: false, reason: "ÙØ´Ù„ Ø§Ù„ØªØ­Ù„ÙŠÙ„", boundingBox: { x: 0, y: 0, width: 1, height: 1 } },
          { ppeItem: "Gloves", compliant: false, reason: "ÙØ´Ù„ Ø§Ù„ØªØ­Ù„ÙŠÙ„", boundingBox: { x: 0, y: 0, width: 1, height: 1 } },
          { ppeItem: "Safety shoes", compliant: false, reason: "ÙØ´Ù„ Ø§Ù„ØªØ­Ù„ÙŠÙ„", boundingBox: { x: 0, y: 0, width: 1, height: 1 } }
        ],
        summary: "Ø­Ø¯Ø« Ø®Ø·Ø£ ÙÙŠ ØªØ­Ù„ÙŠÙ„ Ø§Ù„ØµÙˆØ±Ø©",
        overallCompliant: false
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, timestamp: new Date().toISOString() })
    };
  }
};
